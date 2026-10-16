import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Sonaria, SonariaVoice } from "../../../src";
import { Events, Queue, QueueManager, RepeatMode, SonariaError } from "../../../src";

const BOT_ID = "732441066992566304";
const GUILD_ID = "737499502763704370";
const VOICE_CHANNEL_ID = "853225781604646933";
const TEXT_CHANNEL_ID = "737499503384461325";

type MockVoice = {
  id: string;
  volume: number;
  channel: { id: string; guildId: string };
  join: ReturnType<typeof mock>;
  play: ReturnType<typeof mock>;
  stop: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
  off: ReturnType<typeof mock>;
};

const createVoice = (): MockVoice => ({
  id: GUILD_ID,
  volume: 50,
  channel: { id: VOICE_CHANNEL_ID, guildId: GUILD_ID },
  join: mock(async () => undefined),
  play: mock(async () => undefined),
  stop: mock(async () => undefined),
  on: mock(() => undefined),
  off: mock(() => undefined),
});

const createSonaria = (voice: MockVoice, optionOverrides: Record<string, unknown> = {}) => {
  const sonaria = {
    options: {
      savePreviousSongs: true,
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
      ...optionOverrides,
    },
    client: { botId: BOT_ID, cache: { members: { get: () => undefined } } },
    emit: mock(() => true),
    emitError: mock(() => true),
    debug: mock(() => undefined),
    handler: { attachStreamInfo: mock(async () => undefined) },
    voices: { create: mock(() => voice) },
    filters: {},
    plugins: [],
    queues: undefined as unknown,
  } as unknown as Sonaria & { queues: QueueManager };
  return sonaria;
};

const setup = (optionOverrides: Record<string, unknown> = {}) => {
  const voice = createVoice();
  const sonaria = createSonaria(voice, optionOverrides);
  const manager = new QueueManager(sonaria);
  sonaria.queues = manager;
  return { manager, sonaria, voice };
};

const voiceChannel = { id: VOICE_CHANNEL_ID, guildId: GUILD_ID };
const textChannel = { id: TEXT_CHANNEL_ID, guildId: GUILD_ID };

const song = (id: string, overrides: Record<string, unknown> = {}) =>
  ({
    id,
    duration: 100,
    stream: { playFromSource: true, url: `https://example.com/${id}` },
    ...overrides,
  }) as never;

afterEach(() => {
  mock.restore();
});

describe("QueueManager#create()", () => {
  test("creates and registers a queue", async () => {
    const { manager, sonaria, voice } = setup();
    const queue = await manager.create(voiceChannel as never, textChannel as never);

    expect(manager.has(GUILD_ID)).toBe(true);
    expect(manager.get(GUILD_ID)).toBe(queue);
    expect(voice.join).toHaveBeenCalledTimes(1);
    expect(sonaria.emit).toHaveBeenCalledWith(Events.InitQueue, queue);
    expect(voice.on).toHaveBeenCalledWith("finish", expect.any(Function));
    expect(voice.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(voice.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });

  test("throws when a queue already exists", async () => {
    const { manager } = setup();
    await manager.create(voiceChannel as never, textChannel as never);
    await expect(manager.create(voiceChannel as never, textChannel as never)).rejects.toThrow(SonariaError);
  });
});

describe("QueueManager#handleSongFinish()", () => {
  test("plays the next song when a song finishes", async () => {
    const { manager, sonaria, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    const songA = song("a");
    const songB = song("b");
    queue.songs = [songA, songB];

    await manager.handleSongFinish(queue);

    expect(sonaria.emit).toHaveBeenCalledWith(Events.FinishSong, queue, songA);
    expect(queue.songs).toEqual([songB]);
    expect(queue.previousSongs).toEqual([songA]);
    expect(voice.play).toHaveBeenCalledTimes(1);
  });

  test("does not shift when _manualUpdate is set", async () => {
    const { manager, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    queue.songs = [song("a")];
    queue._manualUpdate = true;

    await manager.handleSongFinish(queue);

    expect(queue._manualUpdate).toBe(false);
    expect(queue.songs).toHaveLength(1);
    expect(voice.play).toHaveBeenCalledTimes(1);
  });

  test("repeats the song in Song repeat mode", async () => {
    const { manager, sonaria, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    const songA = song("a");
    queue.songs = [songA];
    queue.repeatMode = RepeatMode.Song;

    await manager.handleSongFinish(queue);

    expect(queue.songs).toEqual([songA]);
    expect(queue.previousSongs).toEqual([]);
    expect(sonaria.emit).toHaveBeenCalledWith(Events.FinishSong, queue, songA);
  });

  test("removes the queue when it becomes empty", async () => {
    const { manager, sonaria, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    queue.songs = [song("a")];

    await manager.handleSongFinish(queue);

    expect(sonaria.emit).toHaveBeenCalledWith(Events.Finish, queue);
    expect(sonaria.emit).toHaveBeenCalledWith(Events.DeleteQueue, queue);
    expect(queue.stopped).toBe(true);
    expect(manager.has(GUILD_ID)).toBe(false);
  });

  test("adds a related song when autoplay is enabled", async () => {
    const { manager, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    const related = song("related");
    const songA = song("a", { plugin: { getRelatedSongs: async () => [related] } });
    queue.songs = [songA];
    queue.autoplay = true;

    await manager.handleSongFinish(queue);

    expect(queue.songs).toEqual([related]);
    expect(voice.play).toHaveBeenCalledTimes(1);
  });

  test("emits NoRelated when autoplay cannot find a related song", async () => {
    const { manager, sonaria, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    queue.songs = [song("a", { plugin: null })];
    queue.autoplay = true;

    await manager.handleSongFinish(queue);

    expect(sonaria.emit).toHaveBeenCalledWith(Events.NoRelated, queue, expect.any(SonariaError));
    expect(manager.has(GUILD_ID)).toBe(false);
  });
});

describe("QueueManager#playSong()", () => {
  test("plays the stream of the first song", async () => {
    const { manager, sonaria, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    const songA = song("a");
    queue.songs = [songA];

    await manager.playSong(queue);

    expect(voice.play).toHaveBeenCalledTimes(1);
    expect(sonaria.emit).toHaveBeenCalledWith(Events.PlaySong, queue, songA);
  });

  test("stops the queue when there is nothing to play", async () => {
    const { manager, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    queue.songs = [];

    await manager.playSong(queue);

    expect(voice.stop).toHaveBeenCalledTimes(1);
  });

  test("handles a playing error by moving to the next song", async () => {
    const { manager, sonaria, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    const broken = song("broken", { stream: { playFromSource: true } });
    const next = song("next");
    queue.songs = [broken, next];

    await manager.playSong(queue);

    expect(sonaria.emitError).toHaveBeenCalledWith(expect.any(Error), queue, broken);
    expect(queue.songs).toEqual([next]);
    expect(voice.play).toHaveBeenCalledTimes(1);
  });

  test("stops the queue when a playing error empties it", async () => {
    const { manager, voice } = setup();
    const queue = new Queue(manager.sonaria, voice as unknown as SonariaVoice);
    queue.songs = [song("broken", { stream: { playFromSource: true } })];

    await manager.playSong(queue);

    expect(queue.stopped).toBe(true);
    expect(voice.stop).toHaveBeenCalledTimes(1);
  });
});

describe("QueueManager#create() invalid", () => {
  test("propagates voice join failures", async () => {
    const { manager, voice } = setup();
    voice.join.mockImplementationOnce(async () => {
      throw new Error("join failed");
    });
    await expect(manager.create(voiceChannel as never, textChannel as never)).rejects.toThrow("join failed");
    expect(manager.has(GUILD_ID)).toBe(false);
  });
});
