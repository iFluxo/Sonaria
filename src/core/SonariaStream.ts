import type { ChildProcess } from "node:child_process";
import { spawn, spawnSync } from "node:child_process";
import type { Readable } from "node:stream";
import { AudioBitrate, AudioChannels, AudioSampleRate } from "../constant";
import type { Sonaria } from "../Sonaria";
import { SonariaError } from "../struct/SonariaError";
import { TypedEmitter } from "../struct/TypedEmitter";
import type { Awaitable, FFmpegArg, FFmpegOptions } from "../type";
import { Events } from "../type";
import { demuxOggOpus } from "../voice/media/ogg";
import type { VoicePlaybackSource } from "../voice/media/playback";

/**
 * Options for {@link SonariaStream}
 */
export interface StreamOptions {
  /**
   * FFmpeg options
   */
  ffmpeg: FFmpegOptions;
  /**
   * Seek time (in seconds).
   * @default 0
   */
  seek?: number;
  /**
   * Volume percentage (`0`-`100`).
   * @default 100
   */
  volume?: number;
  /**
   * Comma-joined FFmpeg audio filters to apply.
   */
  filters?: string;
}

let checked = process.env.NODE_ENV === "test";
export const checkFFmpeg = (sonaria: Sonaria) => {
  if (checked) return;
  const path = sonaria.options.ffmpeg.path;
  const debug = (str: string) => sonaria.emit(Events.FfmpegDebug, str);
  try {
    debug(`[test] spawn ffmpeg at '${path}' path`);
    const proc = spawnSync(path, ["-h"], {
      windowsHide: true,
      encoding: "utf-8",
    });
    if (proc.error) throw proc.error;
    if (proc.stderr && !proc.stdout) throw new Error(proc.stderr);

    const result = proc.output.join("\n");
    const version = /ffmpeg version (\S+)/iu.exec(result)?.[1];
    if (!version) throw new Error("Invalid FFmpeg version");
    debug(`[test] ffmpeg version: ${version}`);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? (e.stack ?? e.message) : String(e);
    debug(`[test] failed to spawn ffmpeg at '${path}': ${errorMessage}`);
    throw new SonariaError("FfmpegNotInstalled", path);
  }
  checked = true;
};

/**
 * Convert a volume percentage into the FFmpeg `volume` filter multiplier.
 */
export function volumeToMultiplier(volume: number): number {
  return (volume / 100) ** (0.5 / Math.log10(2));
}

const serializeFFmpegArgs = (opts: FFmpegArg): string[] => {
  const args: string[] = [];
  for (const [key, value] of Object.entries(opts)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null) continue;
        args.push(`-${key}`, String(item));
      }
    } else if (value === true) {
      args.push(`-${key}`);
    } else if (value != null && value !== false) {
      args.push(`-${key}`, String(value));
    }
  }
  args.push("pipe:1");
  return args;
};

/**
 * Create a stream to play with {@link SonariaVoice}
 *
 * FFmpeg decodes the source and encodes it to a stereo Ogg Opus stream that is
 * demuxed into Opus packets for the native voice implementation.
 */
export class SonariaStream extends TypedEmitter<{
  debug: (debug: string) => Awaitable;
  error: (error: Error) => Awaitable;
}> {
  #ffmpegPath: string;
  #opts: string[];
  process?: ChildProcess;
  /**
   * The raw Ogg Opus output of the FFmpeg process.
   */
  stdout?: Readable;
  /**
   * The seek time in seconds that this stream started from
   */
  readonly seekTime: number;
  /**
   * Create a SonariaStream to play with {@link SonariaVoice}
   * @param url     - Stream URL
   * @param options - Stream options
   */
  constructor(url: string, options: StreamOptions) {
    super();
    const { ffmpeg, seek } = options;
    this.seekTime = typeof seek === "number" && seek > 0 ? seek : 0;
    const input: FFmpegArg = {
      reconnect: 1,
      reconnect_streamed: 1,
      reconnect_delay_max: 5,
      analyzeduration: 0,
      hide_banner: true,
      ...ffmpeg.args.global,
      ...ffmpeg.args.input,
    };
    if (this.seekTime > 0) input.ss = this.seekTime.toString();
    input.i = url;

    const audioFilters: string[] = [];
    if (typeof options.volume === "number" && !Number.isNaN(options.volume)) {
      audioFilters.push(`volume=${volumeToMultiplier(options.volume)}`);
    }
    if (options.filters) audioFilters.push(options.filters);

    const opts: FFmpegArg = {
      ...input,
      ar: AudioSampleRate,
      ac: AudioChannels,
      ...ffmpeg.args.output,
      "c:a": "libopus",
      "b:a": AudioBitrate,
      f: "ogg",
      ...(audioFilters.length ? { af: audioFilters.join(",") } : {}),
    };

    const fileUrl = new URL(url);
    if (fileUrl.protocol === "file:") {
      opts.reconnect = null;
      opts.reconnect_streamed = null;
      opts.reconnect_delay_max = null;
      opts.i = fileUrl.hostname + fileUrl.pathname;
    }

    this.#ffmpegPath = ffmpeg.path;
    this.#opts = serializeFFmpegArgs(opts);
  }

  /**
   * Spawn the FFmpeg process that produces the Ogg Opus output.
   */
  spawn() {
    if (this.process) return;
    this.debug(`[process] spawn: ${this.#ffmpegPath} ${this.#opts.join(" ")}`);
    this.process = spawn(this.#ffmpegPath, this.#opts, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    })
      .on("error", err => {
        this.debug(`[process] error: ${err.message}`);
        this.emit("error", err);
      })
      .on("exit", (code, signal) => {
        this.debug(`[process] exit: code=${code ?? "unknown"} signal=${signal ?? "unknown"}`);
        if (!code || [0, 255].includes(code)) return;
        this.debug(`[process] error: ffmpeg exited with code ${code}`);
        this.emit("error", new SonariaError("FfmpegExited", code));
      });

    if (!this.process.stdout || !this.process.stderr) {
      this.kill();
      throw new Error("Failed to create ffmpeg process");
    }

    this.stdout = this.process.stdout;
    this.process.stderr.setEncoding("utf8").on("data", (data: string) => {
      const lines = data.split(/\r\n|\r|\n/u);
      for (const line of lines) {
        if (/^\s*$/.test(line)) continue;
        this.debug(`[ffmpeg] log: ${line}`);
      }
    });
  }

  /**
   * The demuxed Opus packet source to play.
   */
  get source(): VoicePlaybackSource {
    if (!this.stdout) throw new Error("The FFmpeg process has not been spawned");
    return demuxOggOpus(this.stdout);
  }

  private debug(debug: string) {
    this.emit("debug", debug);
  }

  /**
   * Terminate the FFmpeg process.
   */
  kill() {
    const proc = this.process;
    this.process = undefined;
    this.stdout = undefined;
    proc?.stdout?.destroy();
    proc?.kill();
    if (proc && !proc.killed) {
      // Ensure the child process is not left running if it ignored SIGTERM.
      proc.kill("SIGKILL");
    }
  }
}
