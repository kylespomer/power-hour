import './style.css';
import {
  type AlertSound,
  notify,
  playAlertSound,
  requestNotificationPermission,
  speak,
  unlockAudio,
  vibrate,
} from './alert';
import { PowerHourGame, formatClock } from './game';
import { LocalFilesSource } from './music/local';
import { SpotifySource, parseSpotifyContextUri } from './music/spotify';
import * as spotifyAuth from './music/spotify-auth';
import { type MusicSource, SilentSource, type TrackInfo } from './music/types';
import { YouTubeSource, parseYouTubePlaylistId } from './music/youtube';
import {
  type GameMode,
  type ModeId,
  type Settings,
  type SourceId,
  clampInt,
  loadSettings,
  resolveMode,
  saveSettings,
} from './settings';
import { acquireWakeLock, releaseWakeLock } from './wakelock';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
  setup: $('setup'),
  game: $('game'),
  done: $('done'),
  banner: $('banner'),
  sourceRadios: [...document.querySelectorAll<HTMLInputElement>('input[name="source"]')],
  sourcePanels: [...document.querySelectorAll<HTMLElement>('.source-panel')],
  spotifyLink: $<HTMLInputElement>('spotify-link'),
  spotifyStatus: $('spotify-status'),
  spotifyLogin: $<HTMLButtonElement>('spotify-login'),
  spotifyClientId: $<HTMLInputElement>('spotify-client-id'),
  redirectUri: $('redirect-uri'),
  youtubeLink: $<HTMLInputElement>('youtube-link'),
  localFiles: $<HTMLInputElement>('local-files'),
  localCount: $('local-count'),
  modeRadios: [...document.querySelectorAll<HTMLInputElement>('input[name="mode"]')],
  modeSummary: $('mode-summary'),
  customOnly: [...document.querySelectorAll<HTMLElement>('[data-custom-only]')],
  doneTitle: $('done-title'),
  rounds: $<HTMLInputElement>('rounds'),
  interval: $<HTMLInputElement>('interval'),
  alertSound: $<HTMLSelectElement>('alert-sound'),
  offset: $<HTMLInputElement>('offset'),
  changeSong: $<HTMLInputElement>('change-song'),
  voice: $<HTMLInputElement>('voice'),
  testAlert: $<HTMLButtonElement>('test-alert'),
  start: $<HTMLButtonElement>('start'),
  ring: $<SVGCircleElement & HTMLElement>('ring'),
  countdown: $('countdown'),
  drinkCount: $('drink-count'),
  drinkTotal: $('drink-total'),
  elapsed: $('elapsed'),
  remaining: $('remaining'),
  totalBar: $('total-bar'),
  nowPlaying: $('now-playing'),
  npArt: $<HTMLImageElement>('np-art'),
  npTitle: $('np-title'),
  npArtist: $('np-artist'),
  videoMount: $('video-mount'),
  pause: $<HTMLButtonElement>('pause'),
  skip: $<HTMLButtonElement>('skip'),
  stop: $<HTMLButtonElement>('stop'),
  doneSummary: $('done-summary'),
  again: $<HTMLButtonElement>('again'),
  flash: $('flash'),
  flashSub: $('flash-sub'),
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 90;
const MUSIC_VOLUME = 0.8;
const DUCKED_VOLUME = 0.15;

let settings: Settings = loadSettings();
let game: PowerHourGame | null = null;
let mode: GameMode = resolveMode(settings);
let music: MusicSource = new SilentSource();
let loop: number | undefined;
let flashTimer: number | undefined;

// ---------- Setup screen ----------

function showBanner(message: string | null, kind: 'error' | 'info' = 'error') {
  ui.banner.hidden = !message;
  ui.banner.textContent = message ?? '';
  ui.banner.dataset.kind = kind;
}

function renderSetup() {
  for (const r of ui.sourceRadios) r.checked = r.value === settings.source;
  for (const p of ui.sourcePanels) p.hidden = p.dataset.source !== settings.source;
  ui.spotifyLink.value = settings.spotifyLink;
  ui.youtubeLink.value = settings.youtubeLink;
  for (const r of ui.modeRadios) r.checked = r.value === settings.mode;
  ui.rounds.value = String(settings.rounds);
  ui.interval.value = String(settings.intervalSec);
  ui.alertSound.value = settings.alertSound;
  ui.offset.value = String(settings.startOffsetSec);
  ui.changeSong.checked = settings.changeSongEachDrink;
  ui.voice.checked = settings.voice;
  ui.spotifyClientId.value = spotifyAuth.getClientId();
  ui.redirectUri.textContent = spotifyAuth.redirectUri();
  renderSpotifyStatus();
  renderMode();
}

function renderMode() {
  const m = resolveMode(settings);
  for (const el of ui.customOnly) el.hidden = settings.mode !== 'custom';
  const perDrink = m.intervalSec === 60 ? 'every minute' : `every ${m.intervalSec} seconds`;
  ui.modeSummary.textContent = `${m.rounds} drinks, one ${perDrink} — ${formatClock(m.rounds * m.intervalSec * 1000)} total.`;
  ui.start.textContent = `Start ${m.name}`;
}

function renderSpotifyStatus() {
  const loggedIn = spotifyAuth.isLoggedIn();
  ui.spotifyStatus.textContent = loggedIn ? '✓ Logged in' : 'Not logged in';
  ui.spotifyLogin.textContent = loggedIn ? 'Log out' : 'Log in to Spotify';
}

function readSetup(): Settings {
  const checked = ui.sourceRadios.find((r) => r.checked);
  const checkedMode = ui.modeRadios.find((r) => r.checked);
  settings = {
    source: (checked?.value as SourceId) ?? settings.source,
    mode: (checkedMode?.value as ModeId) ?? settings.mode,
    spotifyLink: ui.spotifyLink.value.trim(),
    youtubeLink: ui.youtubeLink.value.trim(),
    rounds: clampInt(ui.rounds.value, 1, 200, 60),
    intervalSec: clampInt(ui.interval.value, 5, 600, 60),
    alertSound: ui.alertSound.value as AlertSound,
    startOffsetSec: clampInt(ui.offset.value, 0, 240, 0),
    changeSongEachDrink: ui.changeSong.checked,
    voice: ui.voice.checked,
  };
  saveSettings(settings);
  return settings;
}

ui.setup.addEventListener('change', () => {
  readSetup();
  for (const p of ui.sourcePanels) p.hidden = p.dataset.source !== settings.source;
  renderMode();
});

ui.localFiles.addEventListener('change', () => {
  const n = ui.localFiles.files?.length ?? 0;
  ui.localCount.textContent = n ? `${n} song${n === 1 ? '' : 's'} selected. Files are shuffled.` : 'Works offline. Files are shuffled.';
});

ui.spotifyClientId.addEventListener('change', () => spotifyAuth.setClientId(ui.spotifyClientId.value));

ui.spotifyLogin.addEventListener('click', async () => {
  if (spotifyAuth.isLoggedIn()) {
    spotifyAuth.logout();
    renderSpotifyStatus();
    return;
  }
  readSetup();
  spotifyAuth.setClientId(ui.spotifyClientId.value);
  try {
    await spotifyAuth.beginLogin();
  } catch (e) {
    showBanner((e as Error).message);
    (ui.spotifyClientId.closest('details') as HTMLDetailsElement).open = true;
  }
});

ui.testAlert.addEventListener('click', () => {
  readSetup();
  unlockAudio();
  void playAlertSound(settings.alertSound);
  if (settings.voice) speak('Drink!');
  vibrate();
});

function buildSource(s: Settings): MusicSource {
  switch (s.source) {
    case 'spotify': {
      if (!spotifyAuth.isLoggedIn()) throw new Error('Log in to Spotify first.');
      const uri = parseSpotifyContextUri(s.spotifyLink);
      if (!uri) throw new Error('Paste a Spotify playlist, album or artist link.');
      const src = new SpotifySource(uri, s.startOffsetSec);
      src.onError = (m) => showToast(m);
      return src;
    }
    case 'youtube': {
      const id = parseYouTubePlaylistId(s.youtubeLink);
      if (!id) throw new Error('Paste a YouTube playlist link (it should contain “list=”).');
      return new YouTubeSource(id, ui.videoMount, s.startOffsetSec);
    }
    case 'local':
      return new LocalFilesSource([...(ui.localFiles.files ?? [])], s.startOffsetSec);
    case 'none':
      return new SilentSource();
  }
}

ui.start.addEventListener('click', async () => {
  // Anything that needs a user gesture must happen before the first await.
  unlockAudio();
  const s = readSetup();
  showBanner(null);

  let source: MusicSource;
  try {
    source = buildSource(s);
  } catch (e) {
    showBanner((e as Error).message);
    return;
  }

  ui.start.disabled = true;
  ui.start.textContent = 'Getting ready…';
  ui.videoMount.hidden = s.source !== 'youtube';
  try {
    void requestNotificationPermission();
    await source.prepare();
    source.onTrackChange = renderTrack;
    await source.setVolume(MUSIC_VOLUME);
    await source.play();
  } catch (e) {
    source.dispose();
    ui.videoMount.hidden = true;
    showBanner((e as Error).message);
    return;
  } finally {
    ui.start.disabled = false;
    renderMode();
  }

  music.dispose();
  music = source;
  startGame(s);
});

// ---------- Game ----------

function show(screen: 'setup' | 'game' | 'done') {
  ui.setup.hidden = screen !== 'setup';
  ui.game.hidden = screen !== 'game';
  ui.done.hidden = screen !== 'done';
}

function startGame(s: Settings) {
  mode = resolveMode(s);
  game = new PowerHourGame({ rounds: mode.rounds, intervalMs: mode.intervalSec * 1000 });
  game.start();
  ui.drinkTotal.textContent = String(mode.rounds);
  ui.pause.textContent = 'Pause';
  renderTrack(null);
  show('game');
  void acquireWakeLock();
  if (s.voice) speak(`Let's go! ${mode.name === 'Custom game' ? 'The game' : mode.name} starts now.`);
  clearInterval(loop);
  loop = window.setInterval(tick, 200);
  tick();
}

function tick() {
  if (!game) return;
  const { snapshot, newDrinks, justFinished } = game.update();

  ui.countdown.textContent = formatClock(snapshot.msUntilNextDrink);
  ui.ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * snapshot.roundProgress);
  ui.drinkCount.textContent = String(snapshot.drinksTaken);
  ui.elapsed.textContent = formatClock(snapshot.elapsedMs);
  ui.remaining.textContent = formatClock(game.totalMs - snapshot.elapsedMs);
  ui.totalBar.style.width = `${snapshot.totalProgress * 100}%`;
  document.title =
    snapshot.status === 'running' ? `${formatClock(snapshot.msUntilNextDrink)} · ${mode.name}` : 'Power Hour';

  // If the tab was throttled and several drinks became due at once, only alert once.
  if (newDrinks.length) void drinkTime(newDrinks[newDrinks.length - 1], justFinished);
  if (justFinished) finishGame();
}

async function drinkTime(n: number, isLast: boolean) {
  const total = game?.config.rounds ?? settings.rounds;
  const sub = isLast ? 'Last one!' : `${n} of ${total}`;

  ui.flashSub.textContent = sub;
  ui.flash.hidden = false;
  ui.flash.classList.remove('pulse');
  void ui.flash.offsetWidth; // restart animation
  ui.flash.classList.add('pulse');
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (ui.flash.hidden = true), 3000);

  vibrate();
  notify('🍺 DRINK!', sub);

  await music.setVolume(DUCKED_VOLUME).catch(() => {});
  if (settings.voice) speak(isLast ? 'Last drink! Finish it!' : `Drink! ${n}`);
  await playAlertSound(settings.alertSound);
  if (settings.changeSongEachDrink && !isLast) await music.next().catch((e) => showToast(String(e.message ?? e)));
  await music.setVolume(MUSIC_VOLUME).catch(() => {});
}

function finishGame() {
  clearInterval(loop);
  releaseWakeLock();
  const g = game!;
  ui.doneTitle.textContent = mode.name === 'Centurion' ? 'Centurion conquered!' : 'You made it!';
  ui.doneSummary.textContent = `${g.config.rounds} drinks in ${formatClock(g.totalMs)}. Legendary.`;
  setTimeout(() => show('done'), 3000);
}

function endGame() {
  clearInterval(loop);
  game = null;
  music.dispose();
  music = new SilentSource();
  ui.videoMount.hidden = true;
  ui.flash.hidden = true;
  releaseWakeLock();
  document.title = 'Power Hour';
  show('setup');
}

ui.pause.addEventListener('click', async () => {
  if (!game) return;
  const { status } = game.update().snapshot;
  if (status === 'running') {
    game.pause();
    ui.pause.textContent = 'Resume';
    await music.pause().catch(() => {});
  } else if (status === 'paused') {
    game.start();
    ui.pause.textContent = 'Pause';
    await music.play().catch(() => {});
  }
  tick();
});

ui.skip.addEventListener('click', () => void music.next().catch((e) => showToast(String(e.message ?? e))));

ui.stop.addEventListener('click', () => {
  if (game?.update().snapshot.status === 'running' && !confirm(`End this ${mode.name}?`)) return;
  endGame();
});

ui.again.addEventListener('click', endGame);

function renderTrack(track: TrackInfo | null) {
  ui.nowPlaying.hidden = !track;
  if (!track) return;
  ui.npTitle.textContent = track.title;
  ui.npArtist.textContent = track.artist ?? '';
  ui.npArt.hidden = !track.artworkUrl;
  if (track.artworkUrl) ui.npArt.src = track.artworkUrl;
}

function showToast(message: string) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// Guard against accidentally closing the tab mid-game.
window.addEventListener('beforeunload', (e) => {
  if (game?.update().snapshot.status === 'running') e.preventDefault();
});

// ---------- Boot ----------

renderSetup();
spotifyAuth.handleRedirect().then(
  (err) => {
    if (err) showBanner(err);
    else if (spotifyAuth.isLoggedIn() && settings.source === 'spotify') showBanner('Logged in to Spotify 🎉', 'info');
    renderSpotifyStatus();
  },
  (e: Error) => showBanner(e.message),
);
