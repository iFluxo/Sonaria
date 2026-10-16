import type {
  AllGuildTextableChannels,
  AllGuildVoiceChannels,
  Client,
  Guild,
  GuildMember,
  Interaction,
  Message,
  VoiceState,
} from "seyfert";
import type {
  ExtractorPlugin,
  InfoExtractorPlugin,
  PlayableExtractorPlugin,
  Playlist,
  Queue,
  SonariaError,
  SonariaVoice,
  Song,
} from ".";
import type { VoiceManager } from "./voice/manager";

/**
 * A Seyfert client with the Sonaria voice plugin installed.
 *
 * Install the plugin with `new Client({ plugins: [voice()] })` before creating
 * a {@link Sonaria} instance, otherwise the voice manager property is missing.
 */
export type SonariaClient = Client & { voice: VoiceManager };

export type Awaitable<T = any> = T | PromiseLike<T>;

export enum Events {
  Error = "error",
  AddList = "addList",
  AddSong = "addSong",
  PlaySong = "playSong",
  FinishSong = "finishSong",
  Finish = "finish",
  InitQueue = "initQueue",
  NoRelated = "noRelated",
  Disconnect = "disconnect",
  DeleteQueue = "deleteQueue",
  FfmpegDebug = "ffmpegDebug",
  Debug = "debug",
}

export type SonariaEvents = {
  [Events.AddList]: [queue: Queue, playlist: Playlist];
  [Events.AddSong]: [queue: Queue, song: Song];
  [Events.DeleteQueue]: [queue: Queue];
  [Events.Disconnect]: [queue: Queue];
  [Events.Error]: [error: Error, queue: Queue, song: Song | undefined];
  [Events.FfmpegDebug]: [debug: string];
  [Events.Debug]: [debug: string];
  [Events.Finish]: [queue: Queue];
  [Events.FinishSong]: [queue: Queue, song: Song];
  [Events.InitQueue]: [queue: Queue];
  [Events.NoRelated]: [queue: Queue, error: SonariaError];
  [Events.PlaySong]: [queue: Queue, song: Song];
};

export type TypedSonariaEvents = {
  [K in keyof SonariaEvents]: (...args: SonariaEvents[K]) => Awaitable;
};

export type SonariaVoiceEvents = {
  disconnect: (error?: Error) => Awaitable;
  error: (error: Error) => Awaitable;
  finish: () => Awaitable;
};

/**
 * An FFmpeg audio filter object.
 * ```ts
 * {
 *   name:  "bassboost",
 *   value: "bass=g=10"
 * }
 * ```
 */
export interface Filter {
  /**
   * Name of the filter.
   */
  name: string;
  /**
   * FFmpeg audio filter argument.
   */
  value: string;
}

/**
 * Data that resolves to an FFmpeg audio filter. This can be:
 * - A name of a default or custom filter (`string`)
 * - A {@link Filter} object
 *
 * @see {@link defaultFilters}
 * @see {@link SonariaOptions.customFilters}
 */
export type FilterResolvable = string | Filter;

/**
 * FFmpeg filters.
 * ```ts
 * {
 *   "Filter Name": "Filter Value",
 *   "bassboost":   "bass=g=10"
 * }
 * ```
 *
 * @see {@link defaultFilters}
 */
export type Filters = Record<string, string>;

/**
 * Sonaria options.
 */
export type SonariaOptions = {
  /**
   * Sonaria plugins.
   * The order affects the priority of the plugins when verifying the input.
   */
  plugins?: SonariaPlugin[];
  /**
   * Whether or not to emit the {@link Events.PlaySong} event when looping a
   * song or when the next song is the same as the previous one.
   */
  emitNewSongOnly?: boolean;
  /**
   * Whether or not to save the previous songs of the queue and enable the
   * {@link Sonaria.previous} method. Disabling it may help reduce memory usage.
   */
  savePreviousSongs?: boolean;
  /**
   * Override {@link defaultFilters} or add more FFmpeg filters.
   */
  customFilters?: Filters;
  /**
   * Whether or not to play age-restricted content and disable safe search in
   * non-NSFW channels.
   */
  nsfw?: boolean;
  /**
   * Whether or not to emit the `addSong` event when creating a new queue.
   */
  emitAddSongWhenCreatingQueue?: boolean;
  /**
   * Whether or not to emit the `addList` event when creating a new queue.
   */
  emitAddListWhenCreatingQueue?: boolean;
  /**
   * Whether or not to join the new voice channel when using {@link Sonaria.play}.
   */
  joinNewVoiceChannel?: boolean;
  /**
   * FFmpeg options.
   */
  ffmpeg?: {
    /**
     * FFmpeg path.
     */
    path?: string;
    /**
     * FFmpeg default arguments.
     */
    args?: Partial<FFmpegArgs>;
  };
};

/**
 * Data that can be resolved to a guild id string. This can be:
 * - A guild id string
 * - A {@link Guild}
 * - A {@link Message}
 * - A guild textable channel
 * - A guild voice channel
 * - A {@link VoiceState}
 * - A {@link GuildMember}
 * - An {@link Interaction}
 * - A {@link SonariaVoice}
 * - A {@link Queue}
 */
export type GuildIdResolvable =
  | Queue
  | SonariaVoice
  | string
  | Message
  | AllGuildTextableChannels
  | AllGuildVoiceChannels
  | VoiceState
  | Guild
  | GuildMember
  | Interaction;

export interface SongInfo {
  plugin: SonariaPlugin | null;
  source: string;
  playFromSource: boolean;
  id: string;
  name?: string;
  isLive?: boolean;
  duration?: number;
  url?: string;
  thumbnail?: string;
  views?: number;
  likes?: number;
  dislikes?: number;
  reposts?: number;
  uploader?: {
    name?: string;
    url?: string;
  };
  ageRestricted?: boolean;
}

export interface PlaylistInfo {
  source: string;
  songs: Song[];
  id?: string;
  name?: string;
  url?: string;
  thumbnail?: string;
}

export type RelatedSong = Omit<Song, "related">;

export type PlayHandlerOptions = {
  /**
   * [Default: false] Skip the playing song (if it exists) and play the added
   * playlist instantly.
   */
  skip?: boolean;
  /**
   * [Default: 0] Position of the song/playlist to add to the queue, \<= 0 to add
   * to the end of the queue.
   */
  position?: number;
  /**
   * The default text channel of the queue.
   */
  textChannel?: AllGuildTextableChannels;
};

export interface JumpOptions {
  /**
   * [Default: false] Whether or not skipped songs are added to the end of the
   * queue.
   */
  requeue?: boolean;
}

export interface PlayOptions<T = unknown> extends PlayHandlerOptions, ResolveOptions<T> {
  /**
   * Called message (for built-in search events).
   */
  message?: Message;
}

export interface ResolveOptions<T = unknown> {
  /**
   * Requested user.
   */
  member?: GuildMember;
  /**
   * Metadata.
   */
  metadata?: T;
}

export interface ResolvePlaylistOptions<T = unknown> extends ResolveOptions<T> {
  /**
   * Source of the playlist.
   */
  source?: string;
}

export interface CustomPlaylistOptions {
  /**
   * A guild member creating the playlist.
   */
  member?: GuildMember;
  /**
   * Whether or not to fetch the songs in parallel.
   */
  parallel?: boolean;
  /**
   * Metadata.
   */
  metadata?: any;
  /**
   * Playlist name.
   */
  name?: string;
  /**
   * Playlist source.
   */
  source?: string;
  /**
   * Playlist url.
   */
  url?: string;
  /**
   * Playlist thumbnail.
   */
  thumbnail?: string;
}

/**
 * The repeat mode of a {@link Queue}
 * - `Disabled` = 0
 * - `Song` = 1
 * - `Queue` = 2
 */
export enum RepeatMode {
  Disabled,
  Song,
  Queue,
}

/**
 * All available plugin types:
 * - `Extractor` = `"Extractor"`: {@link ExtractorPlugin}
 * - `InfoExtractor` = `"InfoExtractor"`: {@link InfoExtractorPlugin}
 * - `PlayableExtractor` = `"PlayableExtractor"`: {@link PlayableExtractorPlugin}
 */
export enum PluginType {
  Extractor = "Extractor",
  InfoExtractor = "InfoExtractor",
  PlayableExtractor = "PlayableExtractor",
}

export type SonariaPlugin = ExtractorPlugin | InfoExtractorPlugin | PlayableExtractorPlugin;

export type FFmpegArg = Record<string, string | number | boolean | Array<string | null | undefined> | null | undefined>;

/**
 * FFmpeg arguments for different use cases.
 */
export type FFmpegArgs = {
  global: FFmpegArg;
  input: FFmpegArg;
  output: FFmpegArg;
};

/**
 * FFmpeg options.
 */
export type FFmpegOptions = {
  /**
   * Path to the ffmpeg executable.
   */
  path: string;
  /**
   * Arguments.
   */
  args: FFmpegArgs;
};
