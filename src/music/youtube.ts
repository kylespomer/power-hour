import { type MusicSource, loadScript } from './types';

/**
 * Extracts a YouTube playlist ID from a URL or returns the input if it already
 * looks like an ID. Works for youtube.com and music.youtube.com links.
 */
export function parseYouTubePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('list');
  } catch {
    return /^[A-Za-z0-9_-]{10,}$/.test(trimmed) ? trimmed : null;
  }
}

let apiReady: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  apiReady ??= new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    loadScript('https://www.youtube.com/iframe_api').catch(reject);
  });
  return apiReady;
}

/**
 * Plays a public/unlisted YouTube (or YouTube Music) playlist through the
 * official IFrame Player API. No account or API key needed.
 */
export class YouTubeSource implements MusicSource {
  readonly id = 'youtube';
  readonly label = 'YouTube playlist';
  onTrackChange?: MusicSource['onTrackChange'];

  private player: YT.Player | null = null;
  private started = false;
  private shuffled = false;
  /** Set when we changed track and still need to apply the start offset. */
  private pendingSeek = false;

  constructor(
    private readonly playlistId: string,
    private readonly mount: HTMLElement,
    private readonly startOffsetSec = 0,
  ) {}

  async prepare() {
    await loadYouTubeApi();
    if (this.player) return;
    const el = document.createElement('div');
    this.mount.replaceChildren(el);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('YouTube player did not load.')), 15_000);
      this.player = new YT.Player(el, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            clearTimeout(timeout);
            resolve();
          },
          onStateChange: (e) => this.handleState(e.data),
          // 100/101/150 = removed or not embeddable. Just move on.
          onError: () => this.skip(),
        },
      });
    });
  }

  private handleState(state: YT.PlayerState) {
    const p = this.player;
    if (!p || state !== YT.PlayerState.PLAYING) return;

    // Shuffle only works once the playlist has loaded, i.e. on first playback.
    if (!this.shuffled) {
      this.shuffled = true;
      p.setShuffle(true);
      const len = p.getPlaylist()?.length ?? 0;
      if (len > 1) {
        this.pendingSeek = true;
        p.playVideoAt(Math.floor(Math.random() * len));
        return;
      }
    }

    if (this.pendingSeek) {
      this.pendingSeek = false;
      const offset = this.startOffsetSec;
      if (offset > 0 && p.getDuration() > offset + 60 && p.getCurrentTime() < offset) {
        p.seekTo(offset, true);
      }
    }

    const data = (p as unknown as { getVideoData?: () => { title: string; author: string } }).getVideoData?.();
    if (data?.title) this.onTrackChange?.({ title: data.title, artist: data.author });
  }

  private skip() {
    this.pendingSeek = true;
    this.player?.nextVideo();
  }

  async play() {
    const p = this.player;
    if (!p) return;
    if (!this.started) {
      this.started = true;
      this.pendingSeek = true;
      p.loadPlaylist({ list: this.playlistId, listType: 'playlist' });
      return;
    }
    p.playVideo();
  }

  async pause() {
    this.player?.pauseVideo();
  }

  async next() {
    this.skip();
  }

  async setVolume(volume: number) {
    this.player?.setVolume(Math.round(volume * 100));
  }

  dispose() {
    this.player?.destroy();
    this.player = null;
    this.mount.replaceChildren();
  }
}
