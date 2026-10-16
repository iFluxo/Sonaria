import { defaultOptions } from "../constant";
import { SonariaError } from "../struct/SonariaError";
import type { FFmpegArgs, FFmpegOptions, Filters, SonariaOptions, SonariaPlugin } from "../type";
import { checkInvalidKey } from "../util";

export class Options {
  plugins: SonariaPlugin[];
  emitNewSongOnly: boolean;
  savePreviousSongs: boolean;
  customFilters?: Filters;
  nsfw: boolean;
  emitAddSongWhenCreatingQueue: boolean;
  emitAddListWhenCreatingQueue: boolean;
  joinNewVoiceChannel: boolean;
  ffmpeg: FFmpegOptions;
  constructor(options: SonariaOptions) {
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new SonariaError("InvalidType", "object", options, "SonariaOptions");
    }
    const opts = { ...defaultOptions, ...options };
    this.plugins = opts.plugins;
    this.emitNewSongOnly = opts.emitNewSongOnly;
    this.savePreviousSongs = opts.savePreviousSongs;
    this.customFilters = opts.customFilters;
    this.nsfw = opts.nsfw;
    this.emitAddSongWhenCreatingQueue = opts.emitAddSongWhenCreatingQueue;
    this.emitAddListWhenCreatingQueue = opts.emitAddListWhenCreatingQueue;
    this.joinNewVoiceChannel = opts.joinNewVoiceChannel;
    this.ffmpeg = this.#ffmpegOption(options);
    checkInvalidKey(opts, this, "SonariaOptions");
    this.#validateOptions();
  }

  #validateOptions(options = this) {
    const booleanOptions = new Set([
      "emitNewSongOnly",
      "savePreviousSongs",
      "joinNewVoiceChannel",
      "nsfw",
      "emitAddSongWhenCreatingQueue",
      "emitAddListWhenCreatingQueue",
    ]);
    const numberOptions = new Set();
    const stringOptions = new Set();
    const objectOptions = new Set(["customFilters", "ffmpeg"]);
    const optionalOptions = new Set(["customFilters"]);
    for (const key of objectKeysOf(options)) {
      const value = (options as Record<string, unknown>)[key];
      if (value === undefined && optionalOptions.has(key)) continue;
      if (key === "plugins" && !Array.isArray(value)) {
        throw new SonariaError("InvalidType", "Array<Plugin>", value, `SonariaOptions.${key}`);
      } else if (booleanOptions.has(key)) {
        if (typeof value !== "boolean") {
          throw new SonariaError("InvalidType", "boolean", value, `SonariaOptions.${key}`);
        }
      } else if (numberOptions.has(key)) {
        if (typeof value !== "number" || Number.isNaN(value)) {
          throw new SonariaError("InvalidType", "number", value, `SonariaOptions.${key}`);
        }
      } else if (stringOptions.has(key)) {
        if (typeof value !== "string") {
          throw new SonariaError("InvalidType", "string", value, `SonariaOptions.${key}`);
        }
      } else if (objectOptions.has(key)) {
        if (typeof value !== "object" || Array.isArray(value)) {
          throw new SonariaError("InvalidType", "object", value, `SonariaOptions.${key}`);
        }
      }
    }
  }

  #ffmpegOption(opts: SonariaOptions) {
    const args: FFmpegArgs = { global: {}, input: {}, output: {} };
    if (opts.ffmpeg?.args) {
      if (opts.ffmpeg.args.global) args.global = opts.ffmpeg.args.global;
      if (opts.ffmpeg.args.input) args.input = opts.ffmpeg.args.input;
      if (opts.ffmpeg.args.output) args.output = opts.ffmpeg.args.output;
    }
    const path = opts.ffmpeg?.path ?? "ffmpeg";
    if (typeof path !== "string") {
      throw new SonariaError("InvalidType", "string", path, "SonariaOptions.ffmpeg.path");
    }
    for (const key of objectKeysOf(args)) {
      const value = (args as Record<string, unknown>)[key];
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new SonariaError("InvalidType", "object", value, `SonariaOptions.ffmpeg.${key}`);
      }
      for (const argKey of objectKeysOf(value)) {
        const argValue = (value as Record<string, unknown>)[argKey];
        if (
          typeof argValue !== "string" &&
          typeof argValue !== "number" &&
          typeof argValue !== "boolean" &&
          !Array.isArray(argValue) &&
          argValue !== null &&
          argValue !== undefined
        ) {
          throw new SonariaError(
            "InvalidType",
            ["string", "number", "boolean", "Array<string | null | undefined>", "null", "undefined"],
            argValue,
            `SonariaOptions.ffmpeg.${key}.${argKey}`,
          );
        }
      }
    }
    return { path, args };
  }
}

const objectKeysOf = (value: object): string[] => Object.keys(value);
