import { HTTP_REDIRECT_CODES, MAX_REDIRECT_DEPTH } from "../constant";
import type { ExtractorPlugin } from "../struct/ExtractorPlugin";
import type { InfoExtractorPlugin } from "../struct/InfoExtractorPlugin";
import type { PlayableExtractorPlugin } from "../struct/PlayableExtractorPlugin";
import { Playlist } from "../struct/Playlist";
import { SonariaError } from "../struct/SonariaError";
import { Song } from "../struct/Song";
import type { ResolveOptions, SonariaPlugin } from "../type";
import { PluginType } from "../type";
import { isURL } from "../util";
import { SonariaBase } from "./SonariaBase";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " + "Chrome/129.0.0.0 Safari/537.3";

/** Maps a {@link PluginType} to the plugin class implementing it. */
export type PluginOfType<T extends PluginType> = T extends PluginType.EXTRACTOR
  ? ExtractorPlugin
  : T extends PluginType.INFO_EXTRACTOR
    ? InfoExtractorPlugin
    : T extends PluginType.PLAYABLE_EXTRACTOR
      ? PlayableExtractorPlugin
      : SonariaPlugin;

export class SonariaHandler extends SonariaBase {
  resolve<T = unknown>(song: Song<T>, options?: ResolveOptions): Promise<Song<T>>;
  resolve<T = unknown>(song: Playlist<T>, options?: ResolveOptions): Promise<Playlist<T>>;
  resolve<T = unknown>(song: string, options?: ResolveOptions<T>): Promise<Song<T> | Playlist<T>>;
  resolve<T = unknown>(song: Song, options: ResolveOptions<T>): Promise<Song<T>>;
  resolve<T = unknown>(song: Playlist, options: ResolveOptions<T>): Promise<Playlist<T>>;
  resolve(song: string | Song | Playlist, options?: ResolveOptions): Promise<Song | Playlist>;
  /**
   * Resolve a url or a supported object to a {@link Song} or {@link Playlist}
   * @throws {@link SonariaError}
   * @param input   - Resolvable input
   * @param options - Optional options
   * @returns Resolved
   */
  async resolve(input: string | Song | Playlist, options: ResolveOptions = {}): Promise<Song | Playlist> {
    if (input instanceof Song || input instanceof Playlist) {
      if ("metadata" in options) input.metadata = options.metadata;
      if ("member" in options) input.member = options.member;
      return input;
    }
    if (typeof input === "string") {
      if (isURL(input)) {
        const plugin =
          (await this._getPluginFromURL(input)) ||
          (await this._getPluginFromURL((input = await this.followRedirectLink(input))));
        if (!plugin) throw new SonariaError("NOT_SUPPORTED_URL");
        this.debug(`[${plugin.constructor.name}] Resolving from url: ${input}`);
        return plugin.resolve(input, options);
      }
      try {
        const song = await this.#searchSong(input, options);
        if (song) return song;
      } catch {
        throw new SonariaError("NO_RESULT", input);
      }
    }
    throw new SonariaError("CANNOT_RESOLVE_SONG", input);
  }

  async _getPluginFromURL(url: string): Promise<SonariaPlugin | null> {
    for (const plugin of this.plugins) if (await plugin.validate(url)) return plugin;
    return null;
  }

  _getPluginFromSong(song: Song): Promise<SonariaPlugin | null>;
  _getPluginFromSong<T extends PluginType>(song: Song, types: T[], validate?: boolean): Promise<PluginOfType<T> | null>;
  async _getPluginFromSong(song: Song, types?: PluginType[], validate = true): Promise<SonariaPlugin | null> {
    if (!types || types.includes(song.plugin?.type as PluginType)) return song.plugin;
    if (!song.url) return null;
    for (const plugin of this.plugins) {
      if (types.includes(plugin.type) && (!validate || (await plugin.validate(song.url)))) return plugin;
    }
    return null;
  }

  async #searchSong(query: string, options: ResolveOptions = {}, getStreamURL = false): Promise<Song | null> {
    const plugins = this.plugins.filter((p): p is ExtractorPlugin => p.type === PluginType.EXTRACTOR);
    if (!plugins.length) throw new SonariaError("NO_EXTRACTOR_PLUGIN");
    for (const plugin of plugins) {
      this.debug(`[${plugin.constructor.name}] Searching for song: ${query}`);
      const result = await plugin.searchSong(query, options);
      if (result) {
        if (getStreamURL && result.stream.playFromSource) result.stream.url = await plugin.getStreamURL(result);
        return result;
      }
    }
    return null;
  }

  /**
   * Get {@link Song}'s stream info and attach it to the song.
   * @param song - A Song
   */
  async attachStreamInfo(song: Song) {
    if (song.stream.playFromSource) {
      if (song.stream.url) return;
      this.debug(`[SonariaHandler] Getting stream info: ${song}`);
      const plugin = await this._getPluginFromSong(song, [PluginType.EXTRACTOR, PluginType.PLAYABLE_EXTRACTOR]);
      if (!plugin) throw new SonariaError("NOT_SUPPORTED_SONG", song.toString());
      this.debug(`[${plugin.constructor.name}] Getting stream URL: ${song}`);
      song.stream.url = await plugin.getStreamURL(song);
      if (!song.stream.url) throw new SonariaError("CANNOT_GET_STREAM_URL", song.toString());
    } else {
      if (song.stream.song?.stream?.playFromSource && song.stream.song.stream.url) return;
      this.debug(`[SonariaHandler] Getting stream info: ${song}`);
      const plugin = await this._getPluginFromSong(song, [PluginType.INFO_EXTRACTOR]);
      if (!plugin) throw new SonariaError("NOT_SUPPORTED_SONG", song.toString());
      this.debug(`[${plugin.constructor.name}] Creating search query for: ${song}`);
      const query = await plugin.createSearchQuery(song);
      if (!query) throw new SonariaError("CANNOT_GET_SEARCH_QUERY", song.toString());
      const altSong = await this.#searchSong(query, { metadata: song.metadata, member: song.member }, true);
      if (!altSong || !altSong.stream.playFromSource) throw new SonariaError("NO_RESULT", query || song.toString());
      song.stream.song = altSong;
    }
  }

  async followRedirectLink(url: string, maxRedirect = MAX_REDIRECT_DEPTH): Promise<string> {
    if (maxRedirect === 0) return url;
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "user-agent": USER_AGENT },
    });
    if (HTTP_REDIRECT_CODES.has(res.status)) {
      const location = res.headers.get("location");
      if (!location) return url;
      return this.followRedirectLink(new URL(location, url).toString(), maxRedirect - 1);
    }
    return url;
  }
}
