import type {
  AllGuildTextableChannels,
  AllGuildVoiceChannels,
  GuildMember,
  Message,
  UsingClient,
  VoiceState,
} from "seyfert";
import { SonariaError } from "./struct/SonariaError";
import type { GuildIdResolvable, SonariaClient } from "./type";

const SnowflakePattern = /^\d{17,20}$/;

const formatInt = (int: number) => (int < 10 ? `0${int}` : int);

/**
 * Format duration to string
 * @param sec - Duration in seconds
 */
export function formatDuration(sec: number): string {
  if (!sec || !Number(sec)) return "00:00";
  const seconds = Math.floor(sec % 60);
  const minutes = Math.floor((sec % 3600) / 60);
  const hours = Math.floor(sec / 3600);
  if (hours > 0) return `${formatInt(hours)}:${formatInt(minutes)}:${formatInt(seconds)}`;
  if (minutes > 0) return `${formatInt(minutes)}:${formatInt(seconds)}`;
  return `00:${formatInt(seconds)}`;
}
const SupportedProtocol = ["https:", "http:", "file:"] as const;
/**
 * Check if the string is an URL
 * @param input - input
 */
export function isURL(input: unknown): input is `${(typeof SupportedProtocol)[number]}//${string}` {
  if (typeof input !== "string" || input.includes(" ")) return false;
  try {
    const url = new URL(input);
    if (!SupportedProtocol.some(p => p === url.protocol)) return false;
  } catch {
    return false;
  }
  return true;
}

/**
 * Check whether the Sonaria voice plugin is installed on a Seyfert client.
 *
 * The plugin is installed with `new Client({ plugins: [voice()] })` and exposes
 * the {@link VoiceManager} as `client.voice`.
 */
export function isVoicePluginInstalled(client: unknown): client is SonariaClient {
  if (!isObject(client)) return false;
  const voice = (client as Partial<SonariaClient>).voice;
  return (
    isObject(voice) &&
    typeof (voice as { connect?: unknown }).connect === "function" &&
    typeof (voice as { disconnect?: unknown }).disconnect === "function"
  );
}

/**
 * Throw a {@link SonariaError} when the voice plugin is not installed.
 * @throws {@link SonariaError}
 * @param client - Seyfert client
 */
export function checkVoicePlugin(client: unknown): asserts client is SonariaClient {
  if (!isVoicePluginInstalled(client)) throw new SonariaError("VoicePluginMissing");
}

/**
 * Check if the voice channel the given voice state belongs to has no members
 * other than bots.
 * @param voiceState - The voice state to inspect
 */
export function isVoiceChannelEmpty(voiceState: VoiceState): boolean {
  const client: UsingClient | undefined = voiceState.client;
  const guildId = voiceState.guildId;
  if (!client || !guildId) return false;
  const channelId = voiceState.channelId ?? client.cache.voiceStates?.get(client.botId, guildId)?.channelId;
  if (!channelId) return false;
  const states = client.cache.voiceStates?.values(guildId) ?? [];
  const members = states.filter(state => {
    if (state.channelId !== channelId) return false;
    const member = client.cache.members?.get(state.userId, guildId);
    return !member?.user.bot;
  });
  return members.length === 0;
}

/**
 * Check if the input is a valid Discord snowflake string.
 */
export function isSnowflake(id: unknown): id is string {
  return typeof id === "string" && SnowflakePattern.test(id);
}

export function isMemberInstance(member: any): member is GuildMember {
  return (
    isObject(member) &&
    isSnowflake(member.id) &&
    isSnowflake(member.guildId) &&
    isObject(member.user) &&
    isSnowflake(member.user.id) &&
    member.id === member.user.id
  );
}

export function isTextChannelInstance(channel: any): channel is AllGuildTextableChannels {
  if (!isObject(channel) || !isSnowflake(channel.id) || !isSnowflake(channel.guildId)) return false;
  if (typeof channel.isGuildTextable === "function" && channel.isGuildTextable()) return true;
  return typeof channel.isStage === "function" && channel.isStage();
}

export function isMessageInstance(message: any): message is Message {
  return (
    isObject(message) &&
    isSnowflake(message.id) &&
    isSnowflake(message.guildId) &&
    isSnowflake(message.channelId) &&
    isMemberInstance(message.member) &&
    message.member.id === message.author?.id
  );
}

export function isSupportedVoiceChannel(channel: any): channel is AllGuildVoiceChannels {
  return (
    isObject(channel) &&
    isSnowflake(channel.id) &&
    isSnowflake(channel.guildId) &&
    ((typeof channel.isVoice === "function" && channel.isVoice()) ||
      (typeof channel.isStage === "function" && channel.isStage()))
  );
}

export function isGuildInstance(guild: any): boolean {
  return isObject(guild) && isSnowflake(guild.id) && typeof guild.name === "string";
}

export function resolveGuildId(resolvable: GuildIdResolvable): string {
  let guildId: string | undefined;
  if (typeof resolvable === "string") {
    guildId = resolvable;
  } else if (isObject(resolvable)) {
    const candidate = resolvable as {
      guildId?: unknown;
      id?: unknown;
      guild?: unknown;
    };
    if (typeof candidate.guildId === "string") {
      guildId = candidate.guildId;
    } else if (isGuildInstance(resolvable)) {
      guildId = typeof candidate.id === "string" ? candidate.id : undefined;
    } else if (isGuildInstance(candidate.guild)) {
      guildId = (candidate.guild as { id: string }).id;
    }
  }
  if (!isSnowflake(guildId)) throw new SonariaError("InvalidType", "GuildIdResolvable", resolvable);
  return guildId;
}

export function isClientInstance(client: any): client is SonariaClient {
  return (
    isObject(client) &&
    typeof (client as { cache?: unknown }).cache === "object" &&
    typeof (client as { rest?: unknown }).rest === "object" &&
    typeof (client as { gateway?: unknown }).gateway === "object"
  );
}

export function checkInvalidKey(
  target: Record<string, any>,
  source: Record<string, any> | string[],
  sourceName: string,
) {
  if (!isObject(target)) throw new SonariaError("InvalidType", "object", target, sourceName);
  const sourceKeys = Array.isArray(source) ? source : objectKeys(source);
  const invalidKey = objectKeys(target).find(key => !sourceKeys.includes(key));
  if (invalidKey) throw new SonariaError("InvalidKey", sourceName, invalidKey);
}

export function isObject(obj: any): obj is Record<string, any> {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

export type KeyOf<T> = T extends object ? (keyof T)[] : [];
export function objectKeys<T>(obj: T): KeyOf<T> {
  if (!isObject(obj)) return [] as KeyOf<T>;
  return Object.keys(obj) as KeyOf<T>;
}

/**
 * Whether the given channel is age-restricted. Threads inherit the NSFW state
 * of their parent channel.
 */
export function isNsfwChannel(channel?: unknown): boolean {
  if (!isObject(channel)) return false;
  const candidate = channel as {
    client?: UsingClient;
    isThread?: () => boolean;
    parentId?: string;
    nsfw?: unknown;
  };
  if (typeof candidate.isThread === "function" && candidate.isThread()) {
    if (!candidate.parentId) return false;
    const parent = candidate.client?.cache.channels?.get(candidate.parentId);
    return Boolean(parent && "nsfw" in parent && (parent as { nsfw: boolean }).nsfw);
  }
  return typeof candidate.nsfw === "boolean" ? candidate.nsfw : false;
}
