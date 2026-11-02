import { getAccessToken } from './spotify-auth';
import { type MusicSource, loadScript } from './types';

/**
 * Accepts open.spotify.com links (playlist / album / artist) or spotify: URIs
 * and returns a context URI suitable for the Web API.
 */
export function parseSpotifyContextUri(input: string): string | null {
  const trimmed = input.trim();
  const uri = /^spotify:(playlist|album|artist):([A-Za-z0-9]+)$/.exec(trimmed);
  if (uri) return trimmed;
  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith('spotify.com')) return null;
    const m = /\/(playlist|album|artist)\/([A-Za-z0-9]+)/.exec(url.pathname);
    return m ? `spotify:${m[1]}:${m[2]}` : null;
  } catch {
    return null;
  }
}

let sdkReady: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  sdkReady ??= new Promise<void>((resolve, reject) => {
    if (window.Spotify?.Player) return resolve();
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    loadScript('https://sdk.scdn.co/spotify-player.js').catch(reject);
  });
  return sdkReady;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok && res.status !== 204) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).error?.message ?? msg;
    } catch {
      /* empty body */
    }
    throw new Error(`Spotify: ${msg}`);
  }
  return res;
}

/**
 * Turns this browser tab into a Spotify Connect device using the Web Playback
 * SDK, then plays the chosen playlist on it. Requires Spotify Premium.
 */
export class SpotifySource implements MusicSource {
  readonly id = 'spotify';
  readonly label = 'Spotify';
  onTrackChange?: MusicSource['onTrackChange'];
  /** Surfaced to the UI for errors that happen after prepare(). */
  onError?: (message: string) => void;

  private player: Spotify.Player | null = null;
  private deviceId: string | null = null;
  private started = false;
  private currentTrackId: string | null = null;
  private pendingSeek = false;

  constructor(
    private readonly contextUri: string,
    private readonly startOffsetSec = 0,
  ) {}

  async prepare() {
    await loadSdk();
    if (this.player) return;

    const player = new Spotify.Player({
      name: 'Power Hour',
      getOAuthToken: (cb) => {
        getAccessToken().then(cb, (e: Error) => this.onError?.(e.message));
      },
      volume: 0.8,
    });
    this.player = player;

    // Needed for autoplay on iOS / Safari; we're inside the Start click handler.
    void player.activateElement();

    player.addListener('player_state_changed', (state) => this.handleState(state));
    player.addListener('account_error', () => this.onError?.('Spotify Premium is required for in-browser playback.'));
    player.addListener('playback_error', ({ message }) => this.onError?.(`Spotify playback error: ${message}`));

    this.deviceId = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Spotify player did not become ready.')), 20_000);
      const fail = ({ message }: Spotify.Error) => {
        clearTimeout(timeout);
        reject(new Error(message));
      };
      player.addListener('ready', ({ device_id }) => {
        clearTimeout(timeout);
        resolve(device_id);
      });
      player.addListener('initialization_error', fail);
      player.addListener('authentication_error', fail);
      player.addListener('account_error', () => fail({ message: 'Spotify Premium is required for in-browser playback.' }));
      void player.connect();
    });
  }

  private handleState(state: Spotify.PlaybackState | null) {
    const track = state?.track_window.current_track;
    if (!track || !this.player) return;
    if (track.id === this.currentTrackId) return;
    this.currentTrackId = track.id;

    if (this.pendingSeek) {
      this.pendingSeek = false;
      const offsetMs = this.startOffsetSec * 1000;
      if (offsetMs > 0 && track.duration_ms > offsetMs + 60_000 && state!.position < offsetMs) {
        void this.player.seek(offsetMs);
      }
    }

    this.onTrackChange?.({
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      artworkUrl: track.album.images[0]?.url,
    });
  }

  async play() {
    if (!this.player || !this.deviceId) return;
    if (this.started) return this.player.resume();
    this.started = true;

    const device = encodeURIComponent(this.deviceId);
    await api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [this.deviceId], play: false }) });
    await api(`/me/player/shuffle?state=true&device_id=${device}`, { method: 'PUT' });
    this.pendingSeek = true;
    await api(`/me/player/play?device_id=${device}`, {
      method: 'PUT',
      body: JSON.stringify({ context_uri: this.contextUri }),
    });
  }

  async pause() {
    await this.player?.pause();
  }

  async next() {
    this.pendingSeek = true;
    await this.player?.nextTrack();
  }

  async setVolume(volume: number) {
    await this.player?.setVolume(Math.max(0.01, volume));
  }

  dispose() {
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
  }
}
