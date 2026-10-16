import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { SonariaError } from "../../src/struct/SonariaError";

function createFakeProcess(): unknown {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: Readable;
    stderr: Readable;
    killed: boolean;
    kill: ReturnType<typeof mock>;
  };
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.killed = false;
  proc.kill = mock(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}

const spawnMock = mock((_path: string, _args: string[]) => createFakeProcess());
const spawnSyncMock = mock(() => ({ error: null, stdout: "ffmpeg version 5.0", stderr: "", output: ["", "", ""] }));
mock.module("node:child_process", () => ({ spawn: spawnMock, spawnSync: spawnSyncMock }));

const { SonariaStream, volumeToMultiplier } = await import("../../src/core/SonariaStream");

beforeEach(() => {
  spawnMock.mockClear();
});

describe("volumeToMultiplier()", () => {
  test("returns 1 at full volume", () => {
    expect(volumeToMultiplier(100)).toBe(1);
  });

  test("scales non-linearly", () => {
    expect(volumeToMultiplier(0)).toBe(0);
    expect(volumeToMultiplier(50)).toBeCloseTo(0.31622776601683794, 10);
    expect(volumeToMultiplier(25)).toBeLessThan(volumeToMultiplier(50));
  });
});

describe("SonariaStream", () => {
  test("stores the seek time", () => {
    const stream = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
      seek: 30,
    });
    expect(stream.seekTime).toBe(30);
    const noSeek = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
      seek: -1,
    });
    expect(noSeek.seekTime).toBe(0);
  });

  test("throws when reading the source before spawning", () => {
    const stream = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
    });
    expect(() => stream.source).toThrow("has not been spawned");
  });

  test("spawns FFmpeg with volume and filters", () => {
    const stream = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "/usr/bin/ffmpeg", args: { global: {}, input: {}, output: {} } },
      volume: 50,
      filters: "bass=g=10",
    });

    stream.spawn();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [path, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(path).toBe("/usr/bin/ffmpeg");
    expect(args).toContain("-i");
    expect(args).toContain("https://example.com/audio");
    expect(args).toContain("-af");
    expect(args).toContain(`volume=${volumeToMultiplier(50)},bass=g=10`);
    expect(args).toContain("libopus");
    expect(args.at(-1)).toBe("pipe:1");
    expect(stream.process).toBeDefined();
    expect(stream.stdout).toBeDefined();
  });

  test("handles file URLs", () => {
    const stream = new SonariaStream("file:///tmp/audio.ogg", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
    });
    stream.spawn();
    const args = (spawnMock.mock.calls[0] as [string, string[]])[1];
    expect(args).toContain("/tmp/audio.ogg");
    expect(args).not.toContain("https://example.com/audio");
  });

  test("does not spawn twice", () => {
    const stream = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
    });
    stream.spawn();
    stream.spawn();
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  test("forwards FFmpeg process errors", () => {
    const stream = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
    });
    let received: Error | undefined;
    stream.on("error", error => {
      received = error;
    });
    stream.spawn();
    (stream.process as unknown as EventEmitter).emit("error", new Error("boom"));
    expect(received?.message).toBe("boom");
  });

  test("emits on unexpected exit codes", () => {
    const stream = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
    });
    let received: Error | undefined;
    stream.on("error", error => {
      received = error;
    });
    stream.spawn();
    (stream.process as unknown as EventEmitter).emit("exit", 1, null);
    expect(received).toBeInstanceOf(SonariaError);
  });

  test("kills the process and clears streams", () => {
    const stream = new SonariaStream("https://example.com/audio", {
      ffmpeg: { path: "ffmpeg", args: { global: {}, input: {}, output: {} } },
    });
    stream.spawn();
    const proc = stream.process as unknown as { kill: ReturnType<typeof mock> };
    stream.kill();
    expect(proc.kill).toHaveBeenCalled();
    expect(stream.process).toBeUndefined();
    expect(stream.stdout).toBeUndefined();
  });
});
