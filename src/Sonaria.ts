import type { AllGuildTextableChannels, AllGuildVoiceChannels, Message } from "seyfert";
import { defaultFilters, version } from "./constant";
import { QueueManager } from "./core/manager/QueueManager";
import { SonariaVoiceManager } from "./core/manager/SonariaVoiceManager";
import { SonariaHandler } from "./core/SonariaHandler";
import { Options } from "./core/SonariaOptions";
import { Playlist } from "./struct/Playlist";
import type { Queue } from "./struct/Queue";
import { SonariaError } from "./struct/SonariaError";
import { Song } from "./struct/Song";
import { TypedEmitter } from "./struct/TypedEmitter";
import type {
  CustomPlaylistOptions,
  Filters,
  GuildIdResolvable,
  JumpOptions,
  PlayOptions,
  SonariaClient,
  SonariaOptions,
  SonariaPlugin,
  TypedSonariaEvents,
} from "./type";
import { Events, type RepeatMode } from "./type";
import {
  checkVoicePlugin,
  isClientInstance,
  isMemberInstance,
  isMessageInstance,
  isNsfwChannel,
  isObject,
  isSupportedVoiceChannel,
  isTextChannelInstance,
  isURL,
} from "./util";

/**
 * Sonaria class
 */
export class Sonaria extends TypedEmitter<TypedSonariaEvents> {
  /**
   * Sonaria internal handler
   */
  readonly handler: SonariaHandler;
  /**
   * Sonaria options
   */
  readonly options: Options;
  /**
   * The Seyfert client that owns this instance
   */
  readonly client: SonariaClient;
  /**
   * Sonaria queue manager
   */
  readonly queues: QueueManager;
  /**
   * Sonaria voice connection manager
   */
  readonly voices: SonariaVoiceManager;
  /**
   * Sonaria plugins
   */
  readonly plugins: SonariaPlugin[];
  /**
   * Sonaria FFmpeg filters
   */
  readonly filters: Filters;
  constructor(client: SonariaClient, options: SonariaOptions = {}) {
    super();
    this.setMaxListeners(1);
    if (!isClientInstance(client)) throw new SonariaError("INVALID_TYPE", "Client", client, "client");
    this.client = client;
    checkVoicePlugin(client);
    this.options = new Options(options);
    this.voices = new SonariaVoiceManager(this);
    this.handler = new SonariaHandler(this);
    this.queues = new QueueManager(this);
    this.filters = { ...defaultFilters, ...this.options.customFilters };
    this.plugins = [...this.options.plugins];
    for (const plugin of this.plugins) plugin.init(this);
  }

  /**
   * The current Sonaria version
   */
  static get version() {
    return version;
  }

  /**
   * The current Sonaria version
   */
  get version() {
    return version;
  }

  /**
   * The text channel of a message, resolved from the client cache.
   */
  #textChannelFromMessage(message: Message): AllGuildTextableChannels | undefined {
    const channel = this.client.cache.channels?.get(message.channelId);
    return isTextChannelInstance(channel) ? channel : undefined;
  }

  /**
   * Play a song or a playlist in a voice channel.
   * @param voiceChannel - The voice channel to play in
   * @param song         - URL | Search string | {@link Song} | {@link Playlist}
   * @param options      - Optional options
   */
  async play<T = unknown>(
    voiceChannel: AllGuildVoiceChannels,
    song: string | Song | Playlist,
    options: PlayOptions<T> = {},
  ): Promise<void> {
    if (!isSupportedVoiceChannel(voiceChannel)) {
      throw new SonariaError("INVALID_TYPE", "BaseGuildVoiceChannel", voiceChannel, "voiceChannel");
    }
    if (!isObject(options)) throw new SonariaError("INVALID_TYPE", "object", options, "options");

    const { textChannel: providedTextChannel, member: providedMember, skip = false, message, metadata } = options;
    const member = providedMember ?? this.client.cache.members?.get(this.client.botId, voiceChannel.guildId);
    const textChannel = providedTextChannel ?? (message ? this.#textChannelFromMessage(message) : undefined);
    const position = Number(options.position) || (skip ? 1 : 0);

    if (message && !isMessageInstance(message)) {
      throw new SonariaError("INVALID_TYPE", ["Message", "a falsy value"], message, "options.message");
    }
    if (textChannel && !isTextChannelInstance(textChannel)) {
      throw new SonariaError("INVALID_TYPE", "AllGuildTextableChannels", textChannel, "options.textChannel");
    }
    if (member && !isMemberInstance(member)) {
      throw new SonariaError("INVALID_TYPE", "GuildMember", member, "options.member");
    }

    const queue = this.getQueue(voiceChannel) || (await this.queues.create(voiceChannel, textChannel));
    await queue._taskQueue.queuing(true);
    try {
      this.debug(`[${queue.id}] Playing input: ${song}`);
      const resolved = await this.handler.resolve(song, { member, metadata });
      const isNsfw = isNsfwChannel(queue.textChannel || textChannel);
      const isFirstSong = queue.songs.length === 0;
      if (resolved instanceof Playlist) {
        if (!this.options.nsfw && !isNsfw) {
          resolved.songs = resolved.songs.filter(s => !s.ageRestricted);
          if (!resolved.songs.length) throw new SonariaError("EMPTY_FILTERED_PLAYLIST");
        }
        if (!resolved.songs.length) throw new SonariaError("EMPTY_PLAYLIST");
        this.debug(`[${queue.id}] Adding playlist to queue: ${resolved.songs.length} songs`);
        queue.addToQueue(resolved.songs, position);
        if (!isFirstSong || this.options.emitAddListWhenCreatingQueue) this.emit(Events.ADD_LIST, queue, resolved);
      } else {
        if (!this.options.nsfw && resolved.ageRestricted && !isNsfw) {
          throw new SonariaError("NON_NSFW");
        }
        this.debug(`[${queue.id}] Adding song to queue: ${resolved}`);
        queue.addToQueue(resolved, position);
        if (!isFirstSong || this.options.emitAddSongWhenCreatingQueue) this.emit(Events.ADD_SONG, queue, resolved);
      }

      if (isFirstSong) await queue.play();
      else if (skip) await queue.skip();
    } finally {
      queue._taskQueue.resolve();
    }
  }

  /**
   * Create a custom playlist
   * @param songs   - URLs | {@link Song}s
   * @param options - Optional options
   */
  async createCustomPlaylist(songs: (string | Song)[], options: CustomPlaylistOptions = {}): Promise<Playlist> {
    const { member, parallel, metadata, name, source, url, thumbnail } = options;
    if (!Array.isArray(songs)) {
      throw new SonariaError("INVALID_TYPE", "Array<Song | string>", songs, "songs");
    }
    if (!songs.length) throw new SonariaError("EMPTY_ARRAY", "songs");
    if (member && !isMemberInstance(member)) {
      throw new SonariaError("INVALID_TYPE", "GuildMember", member, "options.member");
    }
    const validSongs = songs.filter((song): song is Song | string => song instanceof Song || isURL(song));
    if (!validSongs.length) throw new SonariaError("NO_VALID_SONG");
    const resolvedSongs: Song[] = [];
    if (parallel === false) {
      for (const song of validSongs) {
        const resolved = await this.handler.resolve(song, { member, metadata }).catch(() => undefined);
        if (resolved instanceof Song) resolvedSongs.push(resolved);
      }
    } else {
      const resolved = await Promise.all(
        validSongs.map(song => this.handler.resolve(song, { member, metadata }).catch(() => undefined)),
      );
      for (const song of resolved) if (song instanceof Song) resolvedSongs.push(song);
    }
    return new Playlist(
      {
        source: source ?? "custom",
        songs: resolvedSongs,
        name,
        url,
        thumbnail: thumbnail ?? resolvedSongs.find(s => s.thumbnail)?.thumbnail,
      },
      { member, metadata },
    );
  }

  /**
   * Get the queue of a guild
   * @param guild - The guild id resolvable
   */
  getQueue(guild: GuildIdResolvable): Queue | undefined {
    return this.queues.get(guild);
  }

  #getQueue(guild: GuildIdResolvable): Queue {
    const queue = this.getQueue(guild);
    if (!queue) throw new SonariaError("NO_QUEUE");
    return queue;
  }

  /**
   * Pause the guild stream
   * @deprecated Use `sonaria.getQueue(guild).pause()` instead. Will be removed in v6.0.
   */
  pause(guild: GuildIdResolvable): Promise<Queue> {
    return this.#getQueue(guild).pause();
  }

  /**
   * Resume the guild stream
   * @deprecated Use `sonaria.getQueue(guild).resume()` instead. Will be removed in v6.0.
   */
  resume(guild: GuildIdResolvable): Promise<Queue> {
    return this.#getQueue(guild).resume();
  }

  /**
   * Stop the guild stream
   * @deprecated Use `sonaria.getQueue(guild).stop()` instead. Will be removed in v6.0.
   */
  stop(guild: GuildIdResolvable): Promise<void> {
    return this.#getQueue(guild).stop();
  }

  /**
   * Set the guild stream's volume
   * @deprecated Use `sonaria.getQueue(guild).setVolume(percent)` instead. Will be removed in v6.0.
   */
  setVolume(guild: GuildIdResolvable, percent: number): Queue {
    return this.#getQueue(guild).setVolume(percent);
  }

  /**
   * Skip the playing song
   * @deprecated Use `sonaria.getQueue(guild).skip(options)` instead. Will be removed in v6.0.
   */
  skip(guild: GuildIdResolvable, options?: JumpOptions): Promise<Song> {
    return this.#getQueue(guild).skip(options);
  }

  /**
   * Play the previous song
   * @deprecated Use `sonaria.getQueue(guild).previous()` instead. Will be removed in v6.0.
   */
  previous(guild: GuildIdResolvable): Promise<Song> {
    return this.#getQueue(guild).previous();
  }

  /**
   * Shuffle the guild queue songs
   * @deprecated Use `sonaria.getQueue(guild).shuffle()` instead. Will be removed in v6.0.
   */
  shuffle(guild: GuildIdResolvable): Promise<Queue> {
    return this.#getQueue(guild).shuffle();
  }

  /**
   * Jump to the song number in the queue
   * @deprecated Use `sonaria.getQueue(guild).jump(num, options)` instead. Will be removed in v6.0.
   */
  jump(guild: GuildIdResolvable, num: number, options?: JumpOptions): Promise<Song> {
    return this.#getQueue(guild).jump(num, options);
  }

  /**
   * Set the repeat mode of the guild queue
   * @deprecated Use `sonaria.getQueue(guild).setRepeatMode(mode)` instead. Will be removed in v6.0.
   */
  setRepeatMode(guild: GuildIdResolvable, mode?: RepeatMode): RepeatMode {
    return this.#getQueue(guild).setRepeatMode(mode);
  }

  /**
   * Toggle autoplay mode
   * @deprecated Use `sonaria.getQueue(guild).toggleAutoplay()` instead. Will be removed in v6.0.
   */
  toggleAutoplay(guild: GuildIdResolvable): boolean {
    return this.#getQueue(guild).toggleAutoplay();
  }

  /**
   * Add a related song to the queue
   * @deprecated Use `sonaria.getQueue(guild).addRelatedSong()` instead. Will be removed in v6.0.
   */
  addRelatedSong(guild: GuildIdResolvable): Promise<Song> {
    return this.#getQueue(guild).addRelatedSong();
  }

  /**
   * Seek to a position in the playing song
   * @deprecated Use `sonaria.getQueue(guild).seek(time)` instead. Will be removed in v6.0.
   */
  seek(guild: GuildIdResolvable, time: number): Promise<Queue> {
    return this.#getQueue(guild).seek(time);
  }

  /**
   * Emit an error event
   */
  emitError(error: Error, queue: Queue, song?: Song): void {
    this.emit(Events.ERROR, error, queue, song);
  }

  /**
   * Emit a debug event
   */
  debug(message: string): void {
    this.emit(Events.DEBUG, message);
  }
}

export default Sonaria;
