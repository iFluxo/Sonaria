import type { GuildMember } from "seyfert";
import type { ResolveOptions, SonariaPlugin, SongInfo } from "../type";
import { formatDuration, isMemberInstance } from "../util";
import { Playlist } from "./Playlist";
import { SonariaError } from "./SonariaError";

/**
 * Class representing a song.
 */
export class Song<T = unknown> {
  /**
   * The source of this song info
   */
  source: string;
  /**
   * Song ID.
   */
  id: string;
  /**
   * Song name.
   */
  name?: string;
  /**
   * Indicates if the song is an active live.
   */
  isLive?: boolean;
  /**
   * Song duration.
   */
  duration: number;
  /**
   * Formatted duration string (`hh:mm:ss`, `mm:ss` or `Live`).
   */
  formattedDuration: string;
  /**
   * Song URL.
   */
  url?: string;
  /**
   * Song thumbnail.
   */
  thumbnail?: string;
  /**
   * Song view count
   */
  views?: number;
  /**
   * Song like count
   */
  likes?: number;
  /**
   * Song dislike count
   */
  dislikes?: number;
  /**
   * Song repost (share) count
   */
  reposts?: number;
  /**
   * Song uploader
   */
  uploader: {
    name?: string;
    url?: string;
  };
  /**
   * Whether or not an age-restricted content
   */
  ageRestricted?: boolean;
  /**
   * Stream info
   */
  stream:
    | {
        /**
         * The stream of this song will be played from source
         */
        playFromSource: true;
        /**
         * Stream URL of this song
         */
        url?: string;
      }
    | {
        /**
         * The stream of this song will be played from another song
         */
        playFromSource: false;
        /**
         * The song that this song will be played from
         */
        song?: Song<T>;
      };
  /**
   * The plugin that created this song
   */
  plugin: SonariaPlugin | null;
  #metadata!: T;
  #member?: GuildMember;
  #playlist?: Playlist;
  /**
   * Create a Song
   *
   * @param info      - Raw song info
   * @param options   - Optional data
   */
  constructor(info: SongInfo, { member, metadata }: ResolveOptions<T> = {}) {
    this.source = info.source.toLowerCase();
    this.metadata = <T>metadata;
    this.member = member;
    this.id = info.id;
    this.name = info.name;
    this.isLive = info.isLive;
    this.duration = this.isLive || !info.duration ? 0 : info.duration;
    this.formattedDuration = this.isLive ? "Live" : formatDuration(this.duration);
    this.url = info.url;
    this.thumbnail = info.thumbnail;
    this.views = info.views;
    this.likes = info.likes;
    this.dislikes = info.dislikes;
    this.reposts = info.reposts;
    this.uploader = {
      name: info.uploader?.name,
      url: info.uploader?.url,
    };
    this.ageRestricted = info.ageRestricted;
    this.stream = { playFromSource: info.playFromSource };
    this.plugin = info.plugin;
  }

  /**
   * The playlist this song belongs to
   */
  get playlist() {
    return this.#playlist;
  }

  set playlist(playlist: Playlist | undefined) {
    if (!(playlist instanceof Playlist)) {
      throw new SonariaError("InvalidType", "Playlist", playlist, "Song#playlist");
    }
    this.#playlist = playlist;
  }

  /**
   * User requested.
   */
  get member() {
    return this.#member;
  }

  set member(member: GuildMember | undefined) {
    if (!isMemberInstance(member)) return;
    this.#member = member;
  }

  /**
   * User requested.
   */
  get user() {
    return this.member?.user;
  }

  /**
   * Optional metadata that can be used to identify the song.
   */
  get metadata() {
    return this.#metadata;
  }

  set metadata(metadata: T) {
    this.#metadata = metadata;
  }

  toString() {
    return this.name || this.url || this.id || "Unknown";
  }
}
