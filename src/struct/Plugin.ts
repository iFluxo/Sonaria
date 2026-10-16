import type { Sonaria } from "../Sonaria";
import type { Awaitable, PluginType } from "../type";
import type { Song } from "./Song";

/**
 * A Sonaria plugin.
 */
export abstract class Plugin {
  /**
   * Type of the plugin
   */
  abstract readonly type: PluginType;
  /**
   * The Sonaria instance that owns this plugin
   */
  sonaria!: Sonaria;
  /**
   * Bind this plugin to a {@link Sonaria} instance
   * @param sonaria - The Sonaria instance
   */
  init(sonaria: Sonaria) {
    this.sonaria = sonaria;
  }
  /**
   * Get related songs from a supported url.
   * @param song - Input song
   */
  abstract getRelatedSongs(song: Song): Awaitable<Song[]>;
}
