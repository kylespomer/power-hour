import { type MusicSource, shuffle } from './types';

/** Plays audio files the user picks from their device. Works fully offline. */
export class LocalFilesSource implements MusicSource {
  readonly id = 'local';
  readonly label = 'Files on this device';
  onTrackChange?: MusicSource['onTrackChange'];

  private audio = new Audio();
  private queue: File[] = [];
  private index = -1;
  private url: string | null = null;

  constructor(files: File[], private readonly startOffsetSec = 0) {
    this.queue = shuffle(files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(f.name)));
    this.audio.addEventListener('ended', () => void this.next());
    this.audio.addEventListener('error', () => void this.next());
  }

  async prepare() {
    if (this.queue.length === 0) throw new Error('Pick at least one audio file.');
  }

  async play() {
    if (this.index < 0) return this.next();
    await this.audio.play();
  }

  async pause() {
    this.audio.pause();
  }

  async next() {
    if (this.queue.length === 0) return;
    this.index = (this.index + 1) % this.queue.length;
    const file = this.queue[this.index];
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(file);
    this.audio.src = this.url;

    if (this.startOffsetSec > 0) {
      this.audio.addEventListener(
        'loadedmetadata',
        () => {
          // Only skip ahead if the song is long enough to still give us a full minute.
          if (this.audio.duration > this.startOffsetSec + 60) {
            this.audio.currentTime = this.startOffsetSec;
          }
        },
        { once: true },
      );
    }
    this.onTrackChange?.({ title: file.name.replace(/\.[^.]+$/, '') });
    await this.audio.play();
  }

  async setVolume(volume: number) {
    this.audio.volume = volume;
  }

  dispose() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    if (this.url) URL.revokeObjectURL(this.url);
  }
}
