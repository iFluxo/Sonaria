import { inspect } from "node:util";

const ErrorMessages = {
  InvalidType: (expected: (number | string) | readonly (number | string)[], got: any, name?: string) =>
    `Expected ${
      Array.isArray(expected) ? expected.map(e => (typeof e === "number" ? e : `'${e}'`)).join(" or ") : `'${expected}'`
    }${name ? ` for '${name}'` : ""}, but got ${inspect(got)} (${typeof got})`,
  NumberCompare: (name: string, expected: string, value: number) => `'${name}' must be ${expected} ${value}`,
  EmptyArray: (name: string) => `'${name}' is empty`,
  EmptyString: (name: string) => `'${name}' is empty`,
  InvalidKey: (name: string, key: string) => `'${key}' is not a valid '${name}' option`,
  DisabledOption: (name: string) => `SonariaOptions.${name} is disabled`,
  EnabledOption: (name: string) => `SonariaOptions.${name} is enabled`,

  NotInVoice: "User is not in any voice channel",
  VoiceFull: "The voice channel is full",
  VoiceAlreadyCreated: "This guild already has a voice connection which is not managed by Sonaria",
  VoiceConnectFailed: (s: number) => `Cannot connect to the voice channel after ${s} seconds`,
  VoiceMissingPerms: "I do not have permission to join this voice channel",
  VoiceReconnectFailed: "Cannot reconnect to the voice channel",
  VoiceDifferentGuild: "Cannot join a voice channel in a different guild",
  VoiceDifferentClient: "Cannot join a voice channel created by a different client",
  VoicePluginMissing:
    "The Sonaria voice plugin is not installed on this client. Add `voice()` to your client plugins to enable voice support",

  FfmpegExited: (code: number) => `ffmpeg exited with code ${code}`,
  FfmpegNotInstalled: (path: string) => `ffmpeg was not found at '${path}'`,

  Paused: "The queue is already paused",
  Resumed: "The queue is already playing",
  NoQueue: "There is no active queue in this guild",
  QueueStopped: "The queue has been stopped",
  QueueExist: "This guild already has a queue",
  NoPrevious: "There is no previous song",
  NoUpNext: "There is no song up next",
  NoSongPosition: "There is no song at this position",
  NoPlayingSong: "There is no playing song",
  NoExtractorPlugin: "There is no extractor plugin in SonariaOptions.plugins, add one to search songs",
  NoRelated: "Cannot find any related song",
  CannotPlayRelated: "Cannot play the related song",
  UnavailableVideo: "This video is unavailable",
  UnplayableFormats: "No playable format found",
  NonNsfw: "Cannot play age-restricted content in a non-NSFW channel",
  NotSupportedUrl: "This url is not supported",
  NotSupportedSong: (song: string) => `No plugin supports this song (${song})`,
  NoValidSong: "'songs' array does not contain any valid Song or url",
  CannotResolveSong: (t: any) => `Cannot resolve ${inspect(t)} to a Song`,
  CannotGetStreamUrl: (song: string) => `Cannot get the stream url for this song (${song})`,
  CannotGetSearchQuery: (song: string) => `Cannot get the search query for this song (${song})`,
  NoResult: (query: string) => `Cannot find any song with this query (${query})`,
  NoStreamUrl: (song: string) => `No stream url attached (${song})`,

  EmptyFilteredPlaylist:
    "There is no valid video in the playlist\n" +
    "Maybe age-restricted content was filtered because you are in a non-NSFW channel",
  EmptyPlaylist: "There is no valid video in the playlist",
} as const;

type ErrorMessageMap = typeof ErrorMessages;
type ErrorCode = keyof ErrorMessageMap;
type StaticErrorCode = { [K in ErrorCode]-?: ErrorMessageMap[K] extends string ? K : never }[ErrorCode];
type TemplateErrorCode = Exclude<ErrorCode, StaticErrorCode>;

const haveCode = (code: string): code is ErrorCode => Object.hasOwn(ErrorMessages, code);
const parseMessage = (m: string | ((...x: any[]) => string), ...args: any) => (typeof m === "string" ? m : m(...args));
const getErrorMessage = (code: string, ...args: any): string =>
  haveCode(code) ? parseMessage(ErrorMessages[code], ...args) : args[0];

/**
 * A Sonaria error carrying a stable `errorCode`.
 */
export class SonariaError<T extends string = any> extends Error {
  errorCode: string;
  constructor(code: T extends StaticErrorCode ? T : never);
  constructor(code: T extends TemplateErrorCode ? T : never, ...args: Parameters<ErrorMessageMap[typeof code]>);
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
