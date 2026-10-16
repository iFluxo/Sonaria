import type { GuildMember } from "seyfert";
import type { PlaylistInfo, ResolveOptions } from "../type";
import { formatDuration, isMemberInstance } from "../util";
import { SonariaError } from "./SonariaError";
import type { Song } from "./Song";

/**
 * Class representing a playlist.
 */
export class Playlist<T = unknown> implements PlaylistInfo {
  /**
   * Playlist source.
   */
  source: string;
  /**
   * Songs in the playlist.
   */
  songs: Song[];
  /**
   * Playlist id.
   */
  id?: string;
  /**
   * Playlist name.
   */
  name?: string;
  /**
   * Playlist url.
   */
  url?: string;
  /**
   * Playlist thumbnail.
   */
  thumbnail?: string;
  #metadata!: T;
  #member?: GuildMember;
  /**
   * Create a Playlist
   *
   * @param info    - Raw playlist info
   * @param options - Optional data
   */
  constructor(info: PlaylistInfo, { member, metadata }: ResolveOptions<T> = {}) {
    if (!Array.isArray(info.songs) || !info.songs.length) throw new SonariaError("EMPTY_PLAYLIST");
    this.source = info.source.toLowerCase();
    this.songs = info.songs;
    this.id = info.id;
    this.name = info.name;
    this.url = info.url;
    this.thumbnail = info.thumbnail;
    this.member = member;
    this.songs.forEach(s => (s.playlist = this));
    this.metadata = metadata as T;
  }

  /**
   * Playlist duration in second.
   */
  get duration() {
    return this.songs.reduce((prev, next) => prev + next.duration, 0);
  }

  /**
   * Formatted duration string `hh:mm:ss`.
   */
  get formattedDuration() {
    return formatDuration(this.duration);
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
    this.songs.forEach(s => (s.member = this.member));
  }

  /**
   * User requested.
   */
  get user() {
    return this.member?.user;
  }

  /**
   * Optional metadata that can be used to identify the playlist.
   */
  get metadata() {
    return this.#metadata;
  }

  set metadata(metadata: T) {
    this.#metadata = metadata;
    this.songs.forEach(s => (s.metadata = metadata));
  }

  toString() {
    return `${this.name} (${this.songs.length} songs)`;
  }
}
