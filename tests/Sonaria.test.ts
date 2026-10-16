import { describe, expect, mock, spyOn, test } from "bun:test";
import SonariaDefault, { Events, Playlist, PluginType, Sonaria, SonariaError, Song, version } from "../src";

const BOT_ID = "732441066992566304";
const GUILD_ID = "737499502763704370";
const VOICE_CHANNEL_ID = "853225781604646933";
const TEXT_CHANNEL_ID = "737499503384461325";

const makeSong = (overrides: Record<string, unknown> = {}) =>
  new Song({
    source: "test",
    id: "id",
    name: "Song",
    duration: 100,
    url: "https://example.com/song",
    playFromSource: true,
    ...overrides,
  } as never);

const makeVoiceChannel = (overrides: Record<string, unknown> = {}) =>
  ({
    id: VOICE_CHANNEL_ID,
    guildId: GUILD_ID,
    client: { botId: BOT_ID },
    isVoice: () => true,
    isStage: () => false,
    ...overrides,
  }) as never;

const makeTextChannel = (nsfw = false) =>
  ({
    id: TEXT_CHANNEL_ID,
    guildId: GUILD_ID,
    client: { botId: BOT_ID },
    nsfw,
    isGuildTextable: () => true,
    isStage: () => false,
  }) as never;

const createConnection = () => ({
  guildId: GUILD_ID,
  channelId: VOICE_CHANNEL_ID,
  state: { status: "ready", channelId: VOICE_CHANNEL_ID },
  play: mock(() => ({
    playedDurationMs: 0,
    stop: mock(async () => undefined),
    done: Promise.resolve(),
  })),
  setSelfState: mock(async () => undefined),
});

const createClient = () => ({
  botId: BOT_ID,
  cache: {
    channels: { get: () => undefined },
    members: { get: () => undefined },
    voiceStates: { get: () => undefined },
  },
  rest: {},
  gateway: {},
  voice: {
    connections: new Map<string, unknown>(),
    connect: mock(async () => createConnection()),
    disconnect: mock(async () => undefined),
    on: mock(() => () => undefined),
    off: mock(() => undefined),
  },
});

const createPlugin = (overrides: Record<string, unknown> = {}) => ({
  type: PluginType.Extractor,
  sonaria: undefined as unknown,
  init(sonaria: Sonaria) {
    this.sonaria = sonaria;
  },
  validate: mock(async () => true),
  resolve: mock(async (url: string) => makeSong({ url })),
  searchSong: mock(async (query: string) => makeSong({ url: query })),
  getStreamURL: mock(async () => "https://example.com/stream.opus"),
  getRelatedSongs: mock(async () => []),
  ...overrides,
});

const createSonaria = (plugin = createPlugin(), options: Record<string, unknown> = {}) => {
  const client = createClient();
  const sonaria = new Sonaria(client as never, { plugins: [plugin as never], ...options });
  const playSong = spyOn(sonaria.queues, "playSong").mockImplementation(async () => undefined);
  return { sonaria, client, plugin, playSong };
};

describe("Sonaria constructor", () => {
  test("validates the client", () => {
    expect(() => new Sonaria({} as never)).toThrow(SonariaError);
  });

  test("requires the voice plugin", () => {
    const client = createClient();
    delete (client as { voice?: unknown }).voice;
    expect(() => new Sonaria(client as never)).toThrow(SonariaError);
  });

  test("initializes managers, options, filters and plugins", () => {
    const plugin = createPlugin();
    const { sonaria } = createSonaria(plugin);
    expect(sonaria.queues).toBeDefined();
    expect(sonaria.voices).toBeDefined();
    expect(sonaria.handler).toBeDefined();
    expect(sonaria.options).toBeDefined();
    expect(sonaria.plugins).toEqual([plugin as never]);
    expect(plugin.sonaria).toBe(sonaria);
  });

  test("merges custom filters", () => {
    const { sonaria } = createSonaria(createPlugin(), { customFilters: { custom: "custom=1" } });
    expect(sonaria.filters.custom).toBe("custom=1");
  });

  test("exposes the version statically and per-instance", () => {
    const { sonaria } = createSonaria();
    expect(Sonaria.version).toBe(version);
    expect(sonaria.version).toBe(version);
    expect(SonariaDefault).toBe(Sonaria);
  });
});

describe("Sonaria#getQueue() and deprecated proxies", () => {
  test("returns undefined for unknown guilds", () => {
    const { sonaria } = createSonaria();
    expect(sonaria.getQueue(GUILD_ID)).toBeUndefined();
  });

  test("throws when the queue does not exist", () => {
    const { sonaria } = createSonaria();
    expect(() => sonaria.pause(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.resume(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.stop(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.skip(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.previous(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.shuffle(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.jump(GUILD_ID, 1)).toThrow(SonariaError);
    expect(() => sonaria.seek(GUILD_ID, 1)).toThrow(SonariaError);
    expect(() => sonaria.addRelatedSong(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.setVolume(GUILD_ID, 50)).toThrow(SonariaError);
    expect(() => sonaria.setRepeatMode(GUILD_ID)).toThrow(SonariaError);
    expect(() => sonaria.toggleAutoplay(GUILD_ID)).toThrow(SonariaError);
  });
});

describe("Sonaria#createCustomPlaylist()", () => {
  test("resolves valid urls into a playlist", async () => {
    const { sonaria } = createSonaria();
    const playlist = await sonaria.createCustomPlaylist(["https://example.com/a", "https://example.com/b"]);
    expect(playlist).toBeInstanceOf(Playlist);
    expect(playlist.source).toBe("custom");
    expect(playlist.songs).toHaveLength(2);
    expect(playlist.name).toBeUndefined();
  });

  test("supports sequential resolving", async () => {
    const plugin = createPlugin();
    const { sonaria } = createSonaria(plugin);
    await sonaria.createCustomPlaylist(["https://example.com/a", "https://example.com/b"], {
      parallel: false,
      name: "My playlist",
      thumbnail: "https://example.com/thumb.png",
    });
    expect(plugin.resolve).toHaveBeenCalledTimes(2);
  });

  test("skips inputs that cannot be resolved", async () => {
    const plugin = createPlugin();
    const { sonaria } = createSonaria(plugin);
    const song = makeSong({ url: "https://example.com/song" });
    const playlist = await sonaria.createCustomPlaylist([song, "not an url"]);
    expect(playlist.songs).toEqual([song]);
  });

  test("validates its input", async () => {
    const { sonaria } = createSonaria();
    await expect(sonaria.createCustomPlaylist(null as never)).rejects.toThrow(SonariaError);
    await expect(sonaria.createCustomPlaylist([])).rejects.toThrow(SonariaError);
    await expect(sonaria.createCustomPlaylist(["not an url"])).rejects.toThrow(SonariaError);
  });
});

describe("SonariaHandler#resolve()", () => {
  test("returns the same song instance and applies options", async () => {
    const { sonaria } = createSonaria();
    const song = makeSong();
    const resolved = await sonaria.handler.resolve(song, { metadata: { a: 1 } });
    expect(resolved).toBe(song);
    expect((resolved as Song).metadata).toEqual({ a: 1 });
  });

  test("searches with extractor plugins", async () => {
    const plugin = createPlugin();
    const { sonaria } = createSonaria(plugin);
    const resolved = await sonaria.handler.resolve("a search query");
    expect(plugin.searchSong).toHaveBeenCalledWith("a search query", expect.any(Object));
    expect(resolved).toBeInstanceOf(Song);
  });

  test("resolves urls with extractor plugins", async () => {
    const plugin = createPlugin();
    const { sonaria } = createSonaria(plugin);
    const resolved = await sonaria.handler.resolve("https://example.com/audio");
    expect(plugin.resolve).toHaveBeenCalledWith("https://example.com/audio", expect.any(Object));
    expect((resolved as Song).url).toBe("https://example.com/audio");
  });

  test("throws for unsupported input", async () => {
    const { sonaria } = createSonaria();
    await expect(sonaria.handler.resolve(1 as never)).rejects.toThrow(SonariaError);
  });

  test("throws when no extractor plugin is available", async () => {
    const client = createClient();
    const sonaria = new Sonaria(client as never);
    await expect(sonaria.handler.resolve("a search query")).rejects.toThrow(SonariaError);
  });
});

describe("SonariaHandler#attachStreamInfo()", () => {
  test("returns early when the stream url is already known", async () => {
    const plugin = createPlugin();
    const { sonaria } = createSonaria(plugin);
    const song = makeSong();
    (song.stream as { url?: string }).url = "https://example.com/known.opus";
    await sonaria.handler.attachStreamInfo(song);
    expect(plugin.getStreamURL).not.toHaveBeenCalled();
  });

  test("fetches the stream url from the plugin", async () => {
    const plugin = createPlugin();
    const { sonaria } = createSonaria(plugin);
    const song = makeSong({ url: undefined, plugin: plugin as never });
    await sonaria.handler.attachStreamInfo(song);
    expect(plugin.getStreamURL).toHaveBeenCalledWith(song);
    expect(song.stream).toEqual({ playFromSource: true, url: "https://example.com/stream.opus" });
  });

  test("throws when no plugin can provide the stream", async () => {
    const { sonaria } = createSonaria();
    const song = makeSong({ url: undefined });
    await expect(sonaria.handler.attachStreamInfo(song)).rejects.toThrow(SonariaError);
  });
});

describe("Sonaria#play()", () => {
  test("validates the voice channel", async () => {
    const { sonaria } = createSonaria();
    await expect(sonaria.play({} as never, "https://example.com/song")).rejects.toThrow(SonariaError);
  });

  test("creates a queue and plays the resolved song", async () => {
    const { sonaria, playSong } = createSonaria();
    await sonaria.play(makeVoiceChannel(), "https://example.com/song");
    const queue = sonaria.getQueue(GUILD_ID);
    expect(queue).toBeDefined();
    expect(queue?.songs).toHaveLength(1);
    expect(playSong).toHaveBeenCalledWith(queue, true);
  });

  test("emits addSong for the first song", async () => {
    const { sonaria } = createSonaria();
    const added = new Promise<Song>(resolve => {
      sonaria.on(Events.AddSong, (_queue, song) => resolve(song as Song));
    });
    await sonaria.play(makeVoiceChannel(), "https://example.com/song");
    expect(await added).toBeInstanceOf(Song);
  });

  test("filters age-restricted playlist songs", async () => {
    const restricted = makeSong({ ageRestricted: true });
    const normal = makeSong({ ageRestricted: false });
    const plugin = createPlugin({
      resolve: mock(async () => new Playlist({ source: "test", songs: [restricted, normal] })),
    });
    const { sonaria } = createSonaria(plugin);
    await sonaria.play(makeVoiceChannel(), "https://example.com/playlist");
    expect(sonaria.getQueue(GUILD_ID)?.songs).toEqual([normal]);
  });

  test("keeps age-restricted songs in an NSFW channel", async () => {
    const restricted = makeSong({ ageRestricted: true });
    const normal = makeSong({ ageRestricted: false });
    const plugin = createPlugin({
      resolve: mock(async () => new Playlist({ source: "test", songs: [restricted, normal] })),
    });
    const { sonaria } = createSonaria(plugin);
    await sonaria.play(makeVoiceChannel(), "https://example.com/playlist", {
      textChannel: makeTextChannel(true),
    });
    expect(sonaria.getQueue(GUILD_ID)?.songs).toHaveLength(2);
  });

  test("rejects a playlist that becomes empty after filtering", async () => {
    const plugin = createPlugin({
      resolve: mock(async () => new Playlist({ source: "test", songs: [makeSong({ ageRestricted: true })] })),
    });
    const { sonaria } = createSonaria(plugin);
    await expect(sonaria.play(makeVoiceChannel(), "https://example.com/playlist")).rejects.toThrow(SonariaError);
  });
});
