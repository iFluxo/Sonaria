import type { AllGuildTextableChannels, AllGuildVoiceChannels, GuildMember } from "seyfert";
import { DEFAULT_VOLUME } from "../constant";
import { FilterManager } from "../core/manager/FilterManager";
import { SonariaBase } from "../core/SonariaBase";
import type { SonariaVoice } from "../core/SonariaVoice";
import type { Sonaria } from "../Sonaria";
import type { FFmpegArgs, JumpOptions, SonariaVoiceEvents } from "../type";
import { Events, RepeatMode } from "../type";
import { formatDuration, objectKeys } from "../util";
import { SonariaError } from "./SonariaError";
import type { Song } from "./Song";
import { TaskQueue } from "./TaskQueue";

/**
 * Represents a queue.
 */
export class Queue extends SonariaBase {
  /**
   * Queue id (Guild id)
   */
  readonly id: string;
  /**
   * Voice connection of this queue.
   */
  voice: SonariaVoice;
  /**
   * List of songs in the queue (The first one is the playing song)
   */
  songs: Song[];
  /**
   * List of the previous songs.
   */
  previousSongs: Song[];
  /**
   * Whether stream is currently stopped.
   */
  stopped: boolean;
  /**
   * Whether or not the queue is active.
   *
   * Note: This remains `true` when paused. It only becomes `false` when stopped.
   * @deprecated Use `!queue.paused` to check if audio is playing. Will be removed in v6.0.
   */
  playing: boolean;
  /**
   * Whether or not the stream is currently paused.
   */
  paused: boolean;
  /**
   * Type of repeat mode (`0` is disabled, `1` is repeating a song, `2` is repeating
   * all the queue). Default value: `0` (disabled)
   */
  repeatMode: RepeatMode;
  /**
   * Whether or not the autoplay mode is enabled. Default value: `false`
   */
  autoplay: boolean;
  /**
   * FFmpeg arguments for the current queue. Default value is defined with
   * {@link SonariaOptions}.ffmpeg.args. `af` output argument will be replaced with
   * the {@link Queue#filters} manager.
   */
  ffmpegArgs: FFmpegArgs;
  /**
   * The text channel of the Queue. (Default: where the first command is called).
   */
  textChannel?: AllGuildTextableChannels;
  /**
   * What time in the song to begin (in seconds).
   * @internal
   */
  _beginTime: number;
  #filters: FilterManager;
  /**
   * Whether or not the queue is being updated manually (skip, jump, previous)
   * @internal
   */
  _manualUpdate: boolean;
  /**
   * Task queuing system
   * @internal
   */
  _taskQueue: TaskQueue;
  /**
   * {@link SonariaVoice} listener
   * @internal
   */
  _listeners?: SonariaVoiceEvents;
  /**
   * Create a queue for the guild
   * @param sonaria     - Sonaria
   * @param voice       - Voice connection
   * @param textChannel - Default text channel
   */
  constructor(sonaria: Sonaria, voice: SonariaVoice, textChannel?: AllGuildTextableChannels) {
    super(sonaria);
    this.voice = voice;
    this.id = voice.id;
    this.volume = DEFAULT_VOLUME;
    this.songs = [];
    this.previousSongs = [];
    this.stopped = false;
    this._manualUpdate = false;
    this.playing = false;
    this.paused = false;
    this.repeatMode = RepeatMode.DISABLED;
    this.autoplay = false;
    this.#filters = new FilterManager(this);
    this._beginTime = 0;
    this.textChannel = textChannel;
    this._taskQueue = new TaskQueue();
    this._listeners = undefined;
    this.ffmpegArgs = {
      global: { ...this.options.ffmpeg.args.global },
      input: { ...this.options.ffmpeg.args.input },
      output: { ...this.options.ffmpeg.args.output },
    };
  }

  #addToPreviousSongs(songs: Song | Song[]) {
    if (Array.isArray(songs)) {
      if (this.options.savePreviousSongs) this.previousSongs.push(...songs);
      else this.previousSongs.push(...songs.map(s => ({ id: s.id }) as Song));
    } else if (this.options.savePreviousSongs) {
      this.previousSongs.push(songs);
    } else {
      this.previousSongs.push({ id: songs.id } as Song);
    }
  }

  #stop() {
    this._manualUpdate = true;
    void this.voice.stop();
  }

  /**
   * The guild id of this queue
   */
  get guildId() {
    return this.id;
  }

  /**
   * The client user as a `GuildMember` of this queue's guild
   */
  get clientMember(): GuildMember | undefined {
    return this.client.cache.members?.get(this.client.botId, this.id);
  }

  /**
   * The filter manager of the queue
   */
  get filters() {
    return this.#filters;
  }

  /**
   * Formatted duration string.
   */
  get formattedDuration() {
    return formatDuration(this.duration);
  }

  /**
   * Queue's duration.
   */
  get duration() {
    return this.songs.length ? this.songs.reduce((prev, next) => prev + next.duration, 0) : 0;
  }

  /**
   * What time in the song is playing (in seconds).
   */
  get currentTime() {
    return this.voice.playbackTime;
  }

  /**
   * Formatted {@link Queue#currentTime} string.
   */
  get formattedCurrentTime() {
    return formatDuration(this.currentTime);
  }

  /**
   * The voice channel playing in.
   */
  get voiceChannel(): AllGuildVoiceChannels {
    return this.voice.channel;
  }

  /**
   * Get or set the stream volume. Default value: `50`.
   */
  get volume() {
    return this.voice.volume;
  }

  set volume(value: number) {
    this.voice.volume = value;
  }

  /**
   * @throws {SonariaError}
   * @param song     - Song to add
   * @param position - Position to add, \<= 0 to add to the end of the queue
   * @returns The guild queue
   */
  addToQueue(song: Song | Song[], position = 0): Queue {
    if (this.stopped) throw new SonariaError("QUEUE_STOPPED");
    if (!song || (Array.isArray(song) && !song.length)) {
      throw new SonariaError("INVALID_TYPE", ["Song", "Array<Song>"], song, "song");
    }
    if (position > 0) {
      if (Array.isArray(song)) this.songs.splice(position, 0, ...song);
      else this.songs.splice(position, 0, song);
    } else if (Array.isArray(song)) {
      this.songs.push(...song);
    } else {
      this.songs.push(song);
    }
    return this;
  }

  /**
   * @returns `true` if the queue is active
   * @deprecated Use `queue.paused` property instead. Will be removed in v6.0.
   */
  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * @returns `true` if the queue is paused
   * @deprecated Use `queue.paused` property instead. Will be removed in v6.0.
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Pause the guild stream
   * @returns The guild queue
   */
  async pause(): Promise<Queue> {
    await this._taskQueue.queuing();
    try {
      if (this.paused) throw new SonariaError("PAUSED");
      this.paused = true;
      this.voice.pause();
      return this;
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Resume the guild stream
   * @returns The guild queue
   */
  async resume(): Promise<Queue> {
    await this._taskQueue.queuing();
    try {
      if (!this.paused) throw new SonariaError("RESUMED");
      this.paused = false;
      this.voice.unpause();
      return this;
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Set the guild stream's volume
   * @param percent - The percentage of volume you want to set
   * @returns The guild queue
   */
  setVolume(percent: number): Queue {
    this.volume = percent;
    return this;
  }

  /**
   * Skip the playing song if there is a next song in the queue. <info>If
   * {@link Queue#autoplay} is `true` and there is no up next song, Sonaria will add
   * and play a related song.</info>
   * @param options - Skip options
   * @returns The song will skip to
   */
  async skip(options?: JumpOptions): Promise<Song> {
    return this.jump(1, options);
  }

  /**
   * Play the previous song if exists
   * @returns The guild queue
   */
  async previous(): Promise<Song> {
    await this._taskQueue.queuing();
    try {
      if (!this.options.savePreviousSongs) throw new SonariaError("DISABLED_OPTION", "savePreviousSongs");
      if (this.previousSongs.length === 0 && this.repeatMode !== RepeatMode.QUEUE) {
        throw new SonariaError("NO_PREVIOUS");
      }
      const song =
        this.repeatMode === RepeatMode.QUEUE && this.previousSongs.length === 0
          ? (this.songs[this.songs.length - 1] as Song)
          : (this.previousSongs.pop() as Song);
      this.songs.unshift(song);
      this.#stop();
      return song;
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Shuffle the queue's songs
   * @returns The guild queue
   */
  async shuffle(): Promise<Queue> {
    await this._taskQueue.queuing();
    try {
      const playing = this.songs.shift();
      if (playing === undefined) return this;
      for (let i = this.songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
      }
      this.songs.unshift(playing);
      return this;
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Jump to the song position in the queue. The next one is 1, 2,... The previous
   * one is -1, -2,...
   * @param position - The song position to play
   * @param options  - Skip options
   * @returns The new Song will be played
   */
  async jump(position: number, options?: JumpOptions): Promise<Song> {
    await this._taskQueue.queuing();
    try {
      if (typeof position !== "number") throw new SonariaError("INVALID_TYPE", "number", position, "position");
      if (!position || position > this.songs.length || -position > this.previousSongs.length) {
        throw new SonariaError("NO_SONG_POSITION");
      }
      if (position > 0) {
        if (position >= this.songs.length) {
          if (this.autoplay) {
            await this._addRelatedSong();
          } else {
            throw new SonariaError("NO_UP_NEXT");
          }
        }
        const skipped = this.songs.splice(0, position);
        if (options?.requeue) {
          this.songs.push(...skipped);
        } else {
          this.#addToPreviousSongs(skipped);
        }
      } else if (!this.options.savePreviousSongs) {
        throw new SonariaError("DISABLED_OPTION", "savePreviousSongs");
      } else {
        const skipped = this.previousSongs.splice(position);
        this.songs.unshift(...skipped);
      }
      this.#stop();
      return this.songs[0];
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Set the repeat mode of the guild queue.
   * Toggle mode `(Disabled -> Song -> Queue -> Disabled ->...)` if `mode` is `undefined`
   * @param mode - The repeat modes (toggle if `undefined`)
   * @returns The new repeat mode
   */
  setRepeatMode(mode?: RepeatMode): RepeatMode {
    if (mode !== undefined && !Object.values(RepeatMode).includes(mode)) {
      throw new SonariaError("INVALID_TYPE", ["RepeatMode", "undefined"], mode, "mode");
    }
    if (mode === undefined) this.repeatMode = (this.repeatMode + 1) % 3;
    else if (this.repeatMode === mode) this.repeatMode = RepeatMode.DISABLED;
    else this.repeatMode = mode;
    return this.repeatMode;
  }

  /**
   * Set the playing time to another position
   * @param time - Time in seconds
   * @returns The guild queue
   */
  async seek(time: number): Promise<Queue> {
    await this._taskQueue.queuing();
    try {
      if (typeof time !== "number") throw new SonariaError("INVALID_TYPE", "number", time, "time");
      if (Number.isNaN(time) || time < 0) {
        throw new SonariaError("NUMBER_COMPARE", "time", "bigger or equal to", 0);
      }
      this._beginTime = time;
      await this.play(false);
      return this;
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Add a related song of the playing song to the queue
   * @param song - The song to get related songs from. Defaults to the current playing song.
   * @returns The added song
   */
  async _addRelatedSong(song?: Song): Promise<Song> {
    const current = song ?? this.songs[0];
    if (!current) throw new SonariaError("NO_PLAYING_SONG");
    const nextSong = await this.#getRelatedSong(current);
    nextSong.metadata = current.metadata;
    nextSong.member = this.clientMember;
    this.addToQueue(nextSong);
    return nextSong;
  }

  /**
   * Find the first related song that has not been played in this queue.
   * @param song - The song to get related songs from
   */
  async #findRelatedSong(song: Song): Promise<Song | undefined> {
    const played = new Set(this.previousSongs.map(s => s.id));
    const candidates = await song.plugin?.getRelatedSongs(song);
    return candidates?.find(candidate => !played.has(candidate.id));
  }

  async #getRelatedSong(song: Song): Promise<Song> {
    this.debug(`[${this.id}] Getting related songs from: ${song}`);
    const relatedSong = await this.#findRelatedSong(song);
    if (relatedSong) return relatedSong;
    if (!song.stream.playFromSource) {
      const altSong = song.stream.song;
      if (altSong) {
        this.debug(`[${this.id}] Getting related songs from streamed song: ${altSong}`);
        const relatedAltSong = await this.#findRelatedSong(altSong);
        if (relatedAltSong) return relatedAltSong;
      }
    }
    throw new SonariaError("NO_RELATED");
  }

  /**
   * Add a related song of the playing song to the queue
   * @param song - The song to get related songs from. Defaults to the current playing song.
   * @returns The added song
   */
  async addRelatedSong(song?: Song): Promise<Song> {
    await this._taskQueue.queuing();
    try {
      return await this._addRelatedSong(song);
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Stop the guild stream and delete the queue
   */
  async stop() {
    await this._taskQueue.queuing();
    try {
      await this.voice.stop();
      this.remove();
    } finally {
      this._taskQueue.resolve();
    }
  }

  /**
   * Remove the queue from the manager
   */
  remove() {
    this.playing = false;
    this.paused = true;
    this.stopped = true;
    this.songs = [];
    this.previousSongs = [];
    if (this._listeners) for (const event of objectKeys(this._listeners)) this.voice.off(event, this._listeners[event]);
    this.queues.remove(this.id);
    this.emit(Events.DELETE_QUEUE, this);
  }

  /**
   * Toggle autoplay mode
   * @returns Autoplay mode state
   */
  toggleAutoplay(): boolean {
    this.autoplay = !this.autoplay;
    return this.autoplay;
  }

  /**
   * Play the first song in the queue
   * @param emitPlaySong - Whether or not emit {@link Events.PLAY_SONG} event
   */
  play(emitPlaySong = true) {
    if (this.stopped) throw new SonariaError("QUEUE_STOPPED");
    this.playing = true;
    return this.queues.playSong(this, emitPlaySong);
  }
}
