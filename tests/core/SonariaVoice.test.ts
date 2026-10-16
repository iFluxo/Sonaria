import { describe, expect, mock, test } from "bun:test";
import type { Sonaria } from "../../src";
import { SonariaVoiceManager } from "../../src/core/manager/SonariaVoiceManager";
import { SonariaVoice } from "../../src/core/SonariaVoice";
import { SonariaError } from "../../src/struct/SonariaError";

const BOT_ID = "732441066992566304";
const GUILD_ID = "737499502763704370";
const VOICE_CHANNEL_ID = "853225781604646933";
const OTHER_GUILD_ID = "853225781604646999";

const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createPlayback = (playedDurationMs = 0) => {
  const done = deferred<void>();
  return {
    playedDurationMs,
    stop: mock(async () => undefined),
    done: done.promise,
    finish: () => done.resolve(),
    fail: (error: unknown) => done.reject(error),
  };
};

const createConnection = (status = "ready", playback = createPlayback()) => ({
  guildId: GUILD_ID,
  channelId: status === "destroyed" ? null : VOICE_CHANNEL_ID,
  state: { status, channelId: VOICE_CHANNEL_ID },
  play: mock(() => playback),
  setSelfState: mock(async () => undefined),
});

const makeChannel = (overrides: Record<string, unknown> = {}) =>
  ({
    id: VOICE_CHANNEL_ID,
    guildId: GUILD_ID,
    client: { botId: BOT_ID },
    isVoice: () => true,
    isStage: () => false,
    ...overrides,
  }) as never;

const createStream = (seekTime = 0) => ({
  seekTime,
  spawn: mock(() => undefined),
  kill: mock(() => undefined),
  on: mock(() => undefined),
  off: mock(() => undefined),
  source: (async function* () {
    yield {} as never;
  })(),
});

const setup = (options: { connections?: Map<string, unknown>; status?: string; playedDurationMs?: number } = {}) => {
  const playback = createPlayback(options.playedDurationMs ?? 0);
  const connection = createConnection(options.status ?? "ready", playback);
  const connections = options.connections ?? new Map<string, unknown>();
  const voiceClient = {
    connections,
    connect: mock(async () => connection),
    disconnect: mock(async () => undefined),
    on: mock((_event: string, _handler: unknown) => () => undefined),
    off: mock(() => undefined),
  };
  const sonaria = {
    client: {
      botId: BOT_ID,
      cache: { members: { get: () => undefined }, voiceStates: { get: () => undefined } },
      voice: voiceClient,
    },
    emit: mock(() => true),
    emitError: mock(() => true),
    debug: mock(() => undefined),
    handler: {},
    filters: {},
    plugins: [],
    queues: { playSong: mock(), remove: mock(() => true), get: mock(() => undefined) },
    voices: undefined as unknown,
  } as unknown as Sonaria;
  const manager = new SonariaVoiceManager(sonaria);
  (sonaria as unknown as { voices: SonariaVoiceManager }).voices = manager;
  return { manager, sonaria, voiceClient, connection, playback, channel: makeChannel() };
};

describe("SonariaVoiceManager#create()", () => {
  test("creates and registers a voice connection", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    expect(voice).toBeInstanceOf(SonariaVoice);
    expect(manager.get(GUILD_ID)).toBe(voice);
    expect(voice.id).toBe(GUILD_ID);
  });

  test("returns the existing connection and updates its channel", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    const newChannel = makeChannel({ id: "853225781604646999" });
    expect(manager.create(newChannel)).toBe(voice);
    expect(voice.channel.id).toBe("853225781604646999");
  });

  test("throws for an unsupported channel", () => {
    const { manager } = setup();
    expect(() => manager.create({ id: "1", guildId: GUILD_ID } as never)).toThrow(SonariaError);
  });

  test("throws when an unmanaged connection already exists", () => {
    const connections = new Map<string, unknown>();
    connections.set(GUILD_ID, { state: { status: "ready" } });
    const { manager, channel } = setup({ connections });
    expect(() => manager.create(channel)).toThrow(SonariaError);
  });
});

describe("SonariaVoiceManager#join()", () => {
  test("connects to the channel", async () => {
    const { manager, voiceClient, channel } = setup();
    const voice = await manager.join(channel);
    expect(voiceClient.connect).toHaveBeenCalledWith({
      guildId: GUILD_ID,
      channelId: VOICE_CHANNEL_ID,
      move: true,
      selfMute: false,
      selfDeaf: false,
    });
    expect(voice.channelId).toBe(VOICE_CHANNEL_ID);
  });

  test("reuses an existing connection", async () => {
    const { manager, voiceClient, channel } = setup();
    const voice = await manager.join(channel);
    await manager.join(makeChannel({ id: "853225781604646999" }));
    expect(voiceClient.connect).toHaveBeenCalledTimes(2);
    expect(manager.get(GUILD_ID)).toBe(voice);
  });
});

describe("SonariaVoiceManager#leave()", () => {
  test("leaves an existing managed connection", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    const leave = mock(() => undefined);
    voice.leave = leave;
    manager.leave(GUILD_ID);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  test("disconnects an unmanaged connection", () => {
    const connections = new Map<string, unknown>();
    connections.set(GUILD_ID, { state: { status: "ready" } });
    const { manager, voiceClient } = setup({ connections });
    manager.leave(GUILD_ID);
    expect(voiceClient.disconnect).toHaveBeenCalledWith(GUILD_ID);
  });

  test("does nothing when there is no connection", () => {
    const { manager, voiceClient } = setup();
    manager.leave(GUILD_ID);
    expect(voiceClient.disconnect).not.toHaveBeenCalled();
  });
});

describe("SonariaVoice#channel", () => {
  test("rejects channels of another guild", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    expect(() => {
      voice.channel = makeChannel({ guildId: OTHER_GUILD_ID });
    }).toThrow(SonariaError);
  });

  test("rejects channels of another client", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    expect(() => {
      voice.channel = makeChannel({ client: { botId: "1" } });
    }).toThrow(SonariaError);
  });

  test("rejects invalid channels", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    expect(() => {
      voice.channel = {} as never;
    }).toThrow(SonariaError);
  });
});

describe("SonariaVoice#join()", () => {
  test("reports a connection failure", async () => {
    const { manager, voiceClient, channel } = setup();
    voiceClient.connect.mockImplementationOnce(async () => {
      throw new Error("nope");
    });
    const voice = manager.create(channel);
    await expect(voice.join()).rejects.toThrow(SonariaError);
    expect(manager.get(GUILD_ID)).toBeUndefined();
  });
});

describe("SonariaVoice#play()", () => {
  test("throws when there is no ready connection", async () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    const stream = createStream();
    await expect(voice.play(stream as never)).rejects.toThrow(SonariaError);
    expect(stream.kill).toHaveBeenCalled();
  });

  test("spawns the stream and plays it", async () => {
    const { manager, channel, connection } = setup();
    const voice = await manager.join(channel);
    const stream = createStream();
    await voice.play(stream as never);
    expect(stream.spawn).toHaveBeenCalledTimes(1);
    expect(connection.play).toHaveBeenCalledTimes(1);
  });

  test("emits finish when playback completes", async () => {
    const { manager, channel, playback } = setup();
    const voice = await manager.join(channel);
    const finished = new Promise<void>(resolve => voice.on("finish", () => resolve()));
    await voice.play(createStream() as never);
    playback.finish();
    await finished;
  });

  test("emits error when playback fails", async () => {
    const { manager, channel, playback } = setup();
    const voice = await manager.join(channel);
    const errored = new Promise<Error>(resolve => voice.on("error", error => resolve(error as Error)));
    await voice.play(createStream() as never);
    playback.fail(new Error("playback failed"));
    expect((await errored).message).toBe("playback failed");
  });
});

describe("SonariaVoice#stop()", () => {
  test("stops playback and kills the stream", async () => {
    const { manager, channel, playback } = setup();
    const voice = await manager.join(channel);
    const stream = createStream();
    await voice.play(stream as never);
    await voice.stop();
    expect(playback.stop).toHaveBeenCalledTimes(1);
    expect(stream.kill).toHaveBeenCalledTimes(1);
    expect(voice.stream).toBeUndefined();
  });
});

describe("SonariaVoice#pause()/#unpause()", () => {
  test("gates the packet source while paused", async () => {
    const { manager, channel, connection } = setup();
    const voice = await manager.join(channel);
    const stream = createStream();
    stream.source = (async function* () {
      yield {} as never;
      yield {} as never;
    })();
    await voice.play(stream as never);

    const gated = (connection.play.mock.calls[0] as unknown[])[0] as AsyncIterable<unknown>;
    const iterator = gated[Symbol.asyncIterator]();
    voice.pause();
    let resolved = false;
    const pending = iterator.next().then(value => {
      resolved = true;
      return value;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    voice.unpause();
    const first = await pending;
    expect(first.done).toBe(false);
  });
});

describe("SonariaVoice#leave()", () => {
  test("emits disconnect and unregisters the connection", async () => {
    const { manager, channel, voiceClient } = setup();
    const voice = await manager.join(channel);
    const disconnected = new Promise<void>(resolve => voice.on("disconnect", () => resolve()));
    voice.leave();
    await disconnected;
    expect(voice.isDisconnected).toBe(true);
    expect(manager.get(GUILD_ID)).toBeUndefined();
    expect(voiceClient.off).toHaveBeenCalled();
  });
});

describe("SonariaVoice#volume", () => {
  test("gets and sets the volume", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    expect(voice.volume).toBe(100);
    voice.volume = 25;
    expect(voice.volume).toBe(25);
  });

  test("validates the volume", () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    expect(() => {
      voice.volume = Number.NaN;
    }).toThrow(SonariaError);
    expect(() => {
      voice.volume = -1;
    }).toThrow(SonariaError);
  });
});

describe("SonariaVoice#playbackTime", () => {
  test("accounts for seek offset and played duration", async () => {
    const { manager, channel } = setup({ playedDurationMs: 5000 });
    const voice = await manager.join(channel);
    await voice.play(createStream(30) as never);
    expect(voice.playbackDuration).toBe(5);
    expect(voice.playbackTime).toBe(35);
  });
});

describe("SonariaVoice#setSelfDeaf()/#setSelfMute()", () => {
  test("validates input", async () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    await expect(voice.setSelfDeaf("yes" as never)).rejects.toThrow(SonariaError);
    await expect(voice.setSelfMute("yes" as never)).rejects.toThrow(SonariaError);
  });

  test("returns false when not connected", async () => {
    const { manager, channel } = setup();
    const voice = manager.create(channel);
    expect(await voice.setSelfDeaf(true)).toBe(false);
    expect(await voice.setSelfMute(true)).toBe(false);
  });

  test("updates the self state when connected", async () => {
    const { manager, channel, connection } = setup();
    const voice = await manager.join(channel);
    expect(await voice.setSelfDeaf(true)).toBe(true);
    expect(await voice.setSelfMute(true)).toBe(true);
    expect(connection.setSelfState).toHaveBeenCalledWith({ selfDeaf: true });
    expect(connection.setSelfState).toHaveBeenCalledWith({ selfMute: true });
  });
});

describe("SonariaVoice#leave() from state change", () => {
  test("leaves when the connection is destroyed", async () => {
    const { manager, voiceClient, channel } = setup();
    const voice = await manager.join(channel);
    const onConnectionStateChange = voiceClient.on.mock.calls[0][1] as (
      connection: unknown,
      next: { status: string },
    ) => void;
    const disconnected = new Promise<void>(resolve => voice.on("disconnect", () => resolve()));
    onConnectionStateChange({ guildId: GUILD_ID }, { status: "destroyed" });
    await disconnected;
    expect(voice.isDisconnected).toBe(true);
  });
});
