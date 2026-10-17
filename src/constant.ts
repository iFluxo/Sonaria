import type { Filters, SonariaOptions } from "./type";

/**
 * The current Sonaria version.
 *
 * @remarks
 * Kept in sync with the `version` field of `package.json` by
 * `tests/constant.test.ts`.
 */
export const version = "0.2.1";

/**
 * Audio configuration constants.
 */
export const AudioSampleRate = 48_000;
export const AudioChannels = 2;
export const AudioBitrate = "128k";

/**
 * Default volume percentage (0-100).
 */
export const DefaultVolume = 100;

/**
 * Timeout constants (in milliseconds).
 */
export const JoinTimeoutMs = 30_000;
export const ReconnectTimeoutMs = 5_000;
export const ReconnectMaxAttempts = 5;

/**
 * HTTP redirect status codes.
 */
export const HttpRedirectCodes = new Set([301, 302, 303, 307, 308]);
export const MaxRedirectDepth = 5;

/**
 * Default Sonaria audio filters.
 */
export const defaultFilters: Filters = {
  "3d": "apulsator=hz=0.125",
  bassboost: "bass=g=10",
  echo: "aecho=0.8:0.9:1000:0.3",
  flanger: "flanger",
  gate: "agate",
  haas: "haas",
  karaoke: "stereotools=mlev=0.1",
  nightcore: "asetrate=48000*1.25,aresample=48000,bass=g=5",
  reverse: "areverse",
  vaporwave: "asetrate=48000*0.8,aresample=48000,atempo=1.1",
  mcompand: "mcompand",
  phaser: "aphaser",
  tremolo: "tremolo",
  surround: "surround",
  earwax: "earwax",
};

export const defaultOptions = {
  plugins: [],
  emitNewSongOnly: false,
  savePreviousSongs: true,
  nsfw: false,
  emitAddSongWhenCreatingQueue: true,
  emitAddListWhenCreatingQueue: true,
  joinNewVoiceChannel: true,
} satisfies SonariaOptions;
