import { inspect } from "node:util";

const ERROR_MESSAGES = {
  INVALID_TYPE: (expected: (number | string) | readonly (number | string)[], got: any, name?: string) =>
    `Expected ${
      Array.isArray(expected) ? expected.map(e => (typeof e === "number" ? e : `'${e}'`)).join(" or ") : `'${expected}'`
    }${name ? ` for '${name}'` : ""}, but got ${inspect(got)} (${typeof got})`,
  NUMBER_COMPARE: (name: string, expected: string, value: number) => `'${name}' must be ${expected} ${value}`,
  EMPTY_ARRAY: (name: string) => `'${name}' is empty`,
  EMPTY_STRING: (name: string) => `'${name}' is empty`,
  INVALID_KEY: (name: string, key: string) => `'${key}' is not a valid '${name}' option`,
  DISABLED_OPTION: (name: string) => `SonariaOptions.${name} is disabled`,
  ENABLED_OPTION: (name: string) => `SonariaOptions.${name} is enabled`,

  NOT_IN_VOICE: "User is not in any voice channel",
  VOICE_FULL: "The voice channel is full",
  VOICE_ALREADY_CREATED: "This guild already has a voice connection which is not managed by Sonaria",
  VOICE_CONNECT_FAILED: (s: number) => `Cannot connect to the voice channel after ${s} seconds`,
  VOICE_MISSING_PERMS: "I do not have permission to join this voice channel",
  VOICE_RECONNECT_FAILED: "Cannot reconnect to the voice channel",
  VOICE_DIFFERENT_GUILD: "Cannot join a voice channel in a different guild",
  VOICE_DIFFERENT_CLIENT: "Cannot join a voice channel created by a different client",
  VOICE_PLUGIN_MISSING:
    "The Sonaria voice plugin is not installed on this client. Add `voice()` to your client plugins to enable voice support",

  FFMPEG_EXITED: (code: number) => `ffmpeg exited with code ${code}`,
  FFMPEG_NOT_INSTALLED: (path: string) => `ffmpeg was not found at '${path}'`,

  PAUSED: "The queue is already paused",
  RESUMED: "The queue is already playing",
  NO_QUEUE: "There is no active queue in this guild",
  QUEUE_STOPPED: "The queue has been stopped",
  QUEUE_EXIST: "This guild already has a queue",
  NO_PREVIOUS: "There is no previous song",
  NO_UP_NEXT: "There is no song up next",
  NO_SONG_POSITION: "There is no song at this position",
  NO_PLAYING_SONG: "There is no playing song",
  NO_EXTRACTOR_PLUGIN: "There is no extractor plugin in SonariaOptions.plugins, add one to search songs",
  NO_RELATED: "Cannot find any related song",
  CANNOT_PLAY_RELATED: "Cannot play the related song",
  UNAVAILABLE_VIDEO: "This video is unavailable",
  UNPLAYABLE_FORMATS: "No playable format found",
  NON_NSFW: "Cannot play age-restricted content in a non-NSFW channel",
  NOT_SUPPORTED_URL: "This url is not supported",
  NOT_SUPPORTED_SONG: (song: string) => `No plugin supports this song (${song})`,
  NO_VALID_SONG: "'songs' array does not contain any valid Song or url",
  CANNOT_RESOLVE_SONG: (t: any) => `Cannot resolve ${inspect(t)} to a Song`,
  CANNOT_GET_STREAM_URL: (song: string) => `Cannot get the stream url for this song (${song})`,
  CANNOT_GET_SEARCH_QUERY: (song: string) => `Cannot get the search query for this song (${song})`,
  NO_RESULT: (query: string) => `Cannot find any song with this query (${query})`,
  NO_STREAM_URL: (song: string) => `No stream url attached (${song})`,

  EMPTY_FILTERED_PLAYLIST:
    "There is no valid video in the playlist\n" +
    "Maybe age-restricted content was filtered because you are in a non-NSFW channel",
  EMPTY_PLAYLIST: "There is no valid video in the playlist",
} as const;

type ErrorMessages = typeof ERROR_MESSAGES;
type ErrorCode = keyof ErrorMessages;
type StaticErrorCode = { [K in ErrorCode]-?: ErrorMessages[K] extends string ? K : never }[ErrorCode];
type TemplateErrorCode = Exclude<ErrorCode, StaticErrorCode>;

const haveCode = (code: string): code is ErrorCode => Object.hasOwn(ERROR_MESSAGES, code);
const parseMessage = (m: string | ((...x: any[]) => string), ...args: any) => (typeof m === "string" ? m : m(...args));
const getErrorMessage = (code: string, ...args: any): string =>
  haveCode(code) ? parseMessage(ERROR_MESSAGES[code], ...args) : args[0];

/**
 * A Sonaria error carrying a stable `errorCode`.
 */
export class SonariaError<T extends string = any> extends Error {
  errorCode: string;
  constructor(code: T extends StaticErrorCode ? T : never);
  constructor(code: T extends TemplateErrorCode ? T : never, ...args: Parameters<ErrorMessages[typeof code]>);
  constructor(code: TemplateErrorCode, _: never);
  constructor(code: T extends ErrorCode ? never : T, message: string);
  constructor(code: string, ...args: any) {
    super(getErrorMessage(code, ...args));

    this.errorCode = code;
    Error.captureStackTrace?.(this, SonariaError);
  }

  override get name() {
    return "SonariaError";
  }

  get code() {
    return this.errorCode;
  }
}

export default SonariaError;
