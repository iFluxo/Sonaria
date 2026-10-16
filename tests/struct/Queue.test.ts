import { describe, expect, mock, test } from "bun:test";
import type { Sonaria, SonariaVoice, Song } from "../../src";
import { defaultFilters, Queue, RepeatMode, SonariaError } from "../../src";

const BOT_ID = "732441066992566304";
const GUILD_ID = "737499502763704370";
const VOICE_CHANNEL_ID = "853225781604646933";

type MockVoice = {
  id: string;
  volume: number;
  playbackTime: number;
  channel: { id: string; guildId: string };
  stop: ReturnType<typeof mock>;
  play: ReturnType<typeof mock>;
  pause: ReturnType<typeof mock>;
  unpause: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
  off: ReturnType<typeof mock>;
};

const createSonaria = (overrides: Record<string, unknown> = {}) =>
  ({
    options: {
      savePreviousSongs: true,
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
    },
    client: { botId: BOT_ID, cache: { members: { get: () => undefined } } },
    filters: defaultFilters,
    plugins: [],
    emit: mock(() => true),
    debug: mock(() => undefined),
    handler: { attachStreamInfo: mock() },
    queues: { playSong: mock(), remove: mock(() => true) },
    voices: { create: mock() },
    ...overrides,
  }) as unknown as Sonaria;

const createVoice = (overrides: Partial<MockVoice> = {}): MockVoice => ({
  id: GUILD_ID,
  volume: 100,
  playbackTime: 0,
  channel: { id: VOICE_CHANNEL_ID, guildId: GUILD_ID },
  stop: mock(async () => undefined),
  play: mock(async () => undefined),
  pause: mock(() => undefined),
  unpause: mock(() => undefined),
  on: mock(() => undefined),
  off: mock(() => undefined),
  ...overrides,
});

const createQueue = (sonariaOverrides: Record<string, unknown> = {}, voiceOverrides: Partial<MockVoice> = {}) => {
  const sonaria = createSonaria(sonariaOverrides);
  const voice = createVoice(voiceOverrides);
  const queue = new Queue(sonaria, voice as unknown as SonariaVoice);
  return { queue, sonaria, voice };
};

const song = (id: string, overrides: Record<string, unknown> = {}) => ({ id, ...overrides }) as unknown as Song;

describe("Queue", () => {
  describe("addToQueue", () => {
    test("adds a song to the end of the queue", () => {
      const { queue } = createQueue();
      const song1 = song("1");
      const song2 = song("2");
      queue.songs = [song1];
      queue.addToQueue(song2);
      expect(queue.songs).toEqual([song1, song2]);
    });

    test("adds a song at a specific position", () => {
      const { queue } = createQueue();
      const song1 = song("1");
      const song3 = song("3");
      queue.songs = [song1, song3];
      queue.addToQueue(song("2"), 1);
      expect(queue.songs.map(s => s.id)).toEqual(["1", "2", "3"]);
    });

    test("adds an array of songs", () => {
      const { queue } = createQueue();
      queue.songs = [song("1")];
      queue.addToQueue([song("2"), song("3")]);
      expect(queue.songs.map(s => s.id)).toEqual(["1", "2", "3"]);
    });

    test("throws for invalid songs and stopped queues", () => {
      const { queue } = createQueue();
      expect(() => queue.addToQueue(null as unknown as Song)).toThrow(SonariaError);
      expect(() => queue.addToQueue([] as unknown as Song[])).toThrow(SonariaError);
      queue.stopped = true;
      expect(() => queue.addToQueue(song("1"))).toThrow(SonariaError);
    });
  });

  describe("addRelatedSong", () => {
    test("adds a related song from the plugin and inherits metadata", async () => {
      const relatedSong = song("related");
      const plugin = { getRelatedSongs: mock(async () => [relatedSong]) };
      const current = song("current", { plugin, metadata: { value: 1 } });
      const { queue } = createQueue();
      queue.songs = [current];

      const result = await queue.addRelatedSong();

      expect(result).toBe(relatedSong);
      expect(queue.songs).toContain(relatedSong);
      expect(relatedSong.metadata).toEqual(current.metadata);
    });

    test("uses the provided song instead of the playing song", async () => {
      const related = song("related");
      const target = song("target", { plugin: { getRelatedSongs: async () => [related] } });
      const { queue } = createQueue();
      queue.songs = [song("current", { plugin: null })];

      const result = await queue.addRelatedSong(target);

      expect(result).toBe(related);
    });

    test("skips already played candidates", async () => {
      const played = song("played");
      const fresh = song("fresh");
      const plugin = { getRelatedSongs: async () => [played, fresh] };
      const current = song("current", { plugin });
      const { queue } = createQueue();
      queue.songs = [current];
      queue.previousSongs = [played];

      const result = await queue.addRelatedSong();

      expect(result).toBe(fresh);
    });

    test("falls back to the streamed song", async () => {
      const related = song("related");
      const altSong = song("alt", { plugin: { getRelatedSongs: async () => [related] } });
      const current = song("current", { plugin: null, stream: { playFromSource: false, song: altSong } });
      const { queue } = createQueue();
      queue.songs = [current];

      const result = await queue.addRelatedSong();

      expect(result).toBe(related);
    });

    test("throws when there is no playing song", async () => {
      const { queue } = createQueue();
      queue.songs = [];
      await expect(queue.addRelatedSong()).rejects.toThrow("There is no playing song");
    });

    test("throws when no related song can be found", async () => {
      const { queue } = createQueue();
      queue.songs = [song("current", { plugin: null, stream: { playFromSource: true } })];
      await expect(queue.addRelatedSong()).rejects.toThrow("Cannot find any related song");
    });
  });

  describe("skip/jump", () => {
    test("skip with requeue appends the skipped song to the end", async () => {
      const { queue } = createQueue();
      const song1 = song("1");
      const song2 = song("2");
      queue.songs = [song1, song2];

      await queue.skip({ requeue: true });

      expect(queue.songs).toEqual([song2, song1]);
      expect(queue._manualUpdate).toBe(true);
    });

    test("jump with requeue appends skipped songs to the end", async () => {
      const { queue } = createQueue();
      queue.songs = [song("1"), song("2"), song("3")];

      await queue.jump(2, { requeue: true });

      expect(queue.songs.map(s => s.id)).toEqual(["3", "1", "2"]);
      expect(queue.previousSongs).toEqual([]);
    });

    test("jump stores skipped songs as previous", async () => {
      const { queue } = createQueue();
      const song1 = song("1");
      const song2 = song("2");
      const song3 = song("3");
      queue.songs = [song1, song2, song3];

      const result = await queue.jump(2);

      expect(result).toBe(song3);
      expect(queue.previousSongs).toEqual([song1, song2]);
    });

    test("jump throws for invalid positions", async () => {
      const { queue } = createQueue();
      queue.songs = [song("1")];
      await expect(queue.jump(0)).rejects.toThrow("There is no song at this position");
      await expect(queue.jump(2)).rejects.toThrow("There is no song at this position");
    });
  });

  describe("previous", () => {
    test("plays the previous song", async () => {
      const { queue } = createQueue();
      const song1 = song("1");
      queue.songs = [song("2")];
      queue.previousSongs = [song1];

      expect(await queue.previous()).toBe(song1);
      expect(queue.songs[0]).toBe(song1);
    });

    test("throws when there is no previous song", async () => {
      const { queue } = createQueue();
      await expect(queue.previous()).rejects.toThrow("There is no previous song");
    });

    test("throws when saving previous songs is disabled", async () => {
      const { queue } = createQueue({ options: { savePreviousSongs: false, ffmpeg: { path: "ffmpeg", args: {} } } });
      await expect(queue.previous()).rejects.toThrow("is disabled");
    });
  });

  describe("seek", () => {
    test("sets _beginTime and replays without emitting", async () => {
      const { queue, sonaria } = createQueue();
      queue.songs = [song("1")];

      await queue.seek(30);

      expect(queue._beginTime).toBe(30);
      const playSong = (sonaria as unknown as { queues: { playSong: ReturnType<typeof mock> } }).queues.playSong;
      expect(playSong).toHaveBeenCalledWith(queue, false);
    });

    test("rejects invalid seek times", async () => {
      const { queue } = createQueue();
      queue.songs = [song("1")];
      await expect(queue.seek(-1)).rejects.toThrow("bigger or equal to");
      await expect(queue.seek(Number.NaN)).rejects.toThrow("bigger or equal to");
    });
  });

  describe("play", () => {
    test("delegates to the queue manager", () => {
      const { queue, sonaria } = createQueue();
      queue.songs = [song("1")];
      queue.play(true);
      queue.play(false);
      const playSong = (sonaria as unknown as { queues: { playSong: ReturnType<typeof mock> } }).queues.playSong;
      expect(playSong).toHaveBeenNthCalledWith(1, queue, true);
      expect(playSong).toHaveBeenNthCalledWith(2, queue, false);
    });

    test("throws when the queue is stopped", () => {
      const { queue } = createQueue();
      queue.stopped = true;
      expect(() => queue.play()).toThrow(SonariaError);
    });
  });

  describe("volume", () => {
    test("get/set delegates to the voice connection", () => {
      const { queue } = createQueue();
      expect(queue.volume).toBe(50);
      expect(queue.setVolume(75)).toBe(queue);
      expect(queue.volume).toBe(75);
    });
  });

  describe("repeat mode", () => {
    test("toggles through the repeat modes", () => {
      const { queue } = createQueue();
      expect(queue.repeatMode).toBe(RepeatMode.DISABLED);
      expect(queue.setRepeatMode()).toBe(RepeatMode.SONG);
      expect(queue.setRepeatMode()).toBe(RepeatMode.QUEUE);
      expect(queue.setRepeatMode()).toBe(RepeatMode.DISABLED);
    });

    test("sets a specific repeat mode and validates input", () => {
      const { queue } = createQueue();
      expect(queue.setRepeatMode(RepeatMode.QUEUE)).toBe(RepeatMode.QUEUE);
      expect(() => queue.setRepeatMode(99 as never)).toThrow(SonariaError);
    });
  });

  describe("autoplay", () => {
    test("toggles autoplay", () => {
      const { queue } = createQueue();
      expect(queue.autoplay).toBe(false);
      expect(queue.toggleAutoplay()).toBe(true);
      expect(queue.toggleAutoplay()).toBe(false);
    });
  });

  describe("getters", () => {
    test("computes duration and formatted duration", () => {
      const { queue } = createQueue();
      queue.songs = [song("1", { duration: 100 }), song("2", { duration: 200 })];
      expect(queue.duration).toBe(300);
      expect(queue.formattedDuration).toBe("05:00");
    });

    test("returns 0 duration for an empty queue", () => {
      const { queue } = createQueue();
      expect(queue.duration).toBe(0);
    });

    test("reads the current time from the voice connection", () => {
      const { queue } = createQueue({}, { playbackTime: 40 });
      expect(queue.currentTime).toBe(40);
      expect(queue.formattedCurrentTime).toBe("00:40");
    });

    test("exposes guild id and voice channel", () => {
      const { queue } = createQueue();
      expect(queue.id).toBe(GUILD_ID);
      expect(queue.guildId).toBe(GUILD_ID);
      expect(queue.voiceChannel.id).toBe(VOICE_CHANNEL_ID);
    });
  });

  describe("pause/resume", () => {
    test("pause and resume toggle the state", async () => {
      const { queue, voice } = createQueue();
      expect(await queue.pause()).toBe(queue);
      expect(queue.paused).toBe(true);
      expect(voice.pause).toHaveBeenCalled();

      expect(await queue.resume()).toBe(queue);
      expect(queue.paused).toBe(false);
      expect(voice.unpause).toHaveBeenCalled();
    });

    test("throws when pausing/resuming an invalid state", async () => {
      const { queue } = createQueue();
      queue.paused = true;
      await expect(queue.pause()).rejects.toThrow("already paused");
      queue.paused = false;
      await expect(queue.resume()).rejects.toThrow("already playing");
    });
  });

  describe("shuffle", () => {
    test("keeps the current song first", async () => {
      const { queue } = createQueue();
      const song1 = song("1");
      queue.songs = [song1, song("2"), song("3"), song("4")];
      expect(await queue.shuffle()).toBe(queue);
      expect(queue.songs[0]).toBe(song1);
      expect(queue.songs).toHaveLength(4);
    });

    test("is a no-op for an empty queue", async () => {
      const { queue } = createQueue();
      queue.songs = [];
      expect(await queue.shuffle()).toBe(queue);
    });
  });

  describe("stop/remove", () => {
    test("stop stops the voice connection and removes the queue", async () => {
      const { queue, voice, sonaria } = createQueue();
      await queue.stop();
      expect(voice.stop).toHaveBeenCalled();
      const remove = (sonaria as unknown as { queues: { remove: ReturnType<typeof mock> } }).queues.remove;
      expect(remove).toHaveBeenCalledWith(GUILD_ID);
      expect(queue.stopped).toBe(true);
      expect(queue.songs).toEqual([]);
    });

    test("remove marks the queue as stopped", () => {
      const { queue } = createQueue();
      queue.remove();
      expect(queue.stopped).toBe(true);
      expect(queue.playing).toBe(false);
      expect(queue.paused).toBe(true);
    });
  });

  describe("filters", () => {
    test("exposes the filter manager backed by default filters", () => {
      const { queue } = createQueue();
      queue.filters.add("3d");
      expect(queue.filters.has("3d")).toBe(true);
    });
  });

  describe("clientMember", () => {
    test("resolves the client member from the cache", () => {
      const member = { id: BOT_ID, guildId: GUILD_ID, user: { id: BOT_ID } };
      const { queue } = createQueue({ client: { botId: BOT_ID, cache: { members: { get: () => member } } } });
      expect(queue.clientMember).toBe(member as never);
    });
  });
});
