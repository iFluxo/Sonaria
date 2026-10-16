import { describe, expect, test } from "bun:test";
import {
  checkInvalidKey,
  checkVoicePlugin,
  formatDuration,
  isClientInstance,
  isMemberInstance,
  isMessageInstance,
  isNsfwChannel,
  isSnowflake,
  isSupportedVoiceChannel,
  isTextChannelInstance,
  isURL,
  isVoiceChannelEmpty,
  isVoicePluginInstalled,
  resolveGuildId,
} from "../src";
import { SonariaError } from "../src/struct/SonariaError";

const GUILD_ID = "737499502763704370";
const VOICE_CHANNEL_ID = "853225781604646933";
const STAGE_CHANNEL_ID = "835876864458489857";
const TEXT_CHANNEL_ID = "737499503384461325";
const BOT_ID = "732441066992566304";
const USER_ID = "653848088280301571";

const expectError = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SonariaError);
    expect((error as SonariaError).errorCode).toBe(code);
    return;
  }
  throw new Error(`Expected ${code} to be thrown`);
};

const voiceChannel = {
  id: VOICE_CHANNEL_ID,
  guildId: GUILD_ID,
  nsfw: true,
  client: { botId: BOT_ID },
  isVoice: () => true,
  isStage: () => false,
};

const stageChannel = {
  id: STAGE_CHANNEL_ID,
  guildId: GUILD_ID,
  nsfw: false,
  client: { botId: BOT_ID },
  isVoice: () => false,
  isStage: () => true,
};

const textChannel = {
  id: TEXT_CHANNEL_ID,
  guildId: GUILD_ID,
  nsfw: false,
  client: { botId: BOT_ID },
  isGuildTextable: () => true,
  isStage: () => false,
};

const threadChannel = {
  id: "1098543313134563338",
  guildId: GUILD_ID,
  parentId: TEXT_CHANNEL_ID,
  client: { cache: { channels: { get: () => textChannel } } },
  isThread: () => true,
  nsfw: false,
};

const member = {
  id: BOT_ID,
  guildId: GUILD_ID,
  user: { id: BOT_ID, bot: true },
};

const message = {
  id: "863630752813285376",
  guildId: GUILD_ID,
  channelId: TEXT_CHANNEL_ID,
  member,
  author: { id: BOT_ID },
};

const guild = { id: GUILD_ID, name: "Test" };

const client = {
  cache: {},
  rest: {},
  gateway: {},
};

describe("isURL()", () => {
  test("accepts supported protocols", () => {
    expect(isURL("file://abc")).toBe(true);
    expect(isURL("http://example.com")).toBe(true);
    expect(isURL("https://example.com/audio?a=1")).toBe(true);
  });

  test("rejects invalid input", () => {
    expect(isURL(1)).toBe(false);
    expect(isURL("")).toBe(false);
    expect(isURL("not an url")).toBe(false);
    expect(isURL("https://")).toBe(false);
    expect(isURL("ftp://abc")).toBe(false);
    expect(isURL("sftp://abc")).toBe(false);
  });
});

describe("isSnowflake()", () => {
  test("validates snowflake strings", () => {
    expect(isSnowflake(BOT_ID)).toBe(true);
    expect(isSnowflake("123")).toBe(false);
    expect(isSnowflake(123 as unknown)).toBe(false);
    expect(isSnowflake("12345678901234567890123")).toBe(false);
  });
});

describe("isSupportedVoiceChannel()", () => {
  const testFn = isSupportedVoiceChannel;
  test("recognizes voice and stage channels", () => {
    expect(testFn(voiceChannel)).toBe(true);
    expect(testFn(stageChannel)).toBe(true);
  });
  test("rejects everything else", () => {
    expect(testFn(textChannel)).toBe(false);
    expect(testFn(threadChannel)).toBe(false);
    expect(testFn(message)).toBe(false);
    expect(testFn(guild)).toBe(false);
    expect(testFn(client)).toBe(false);
    expect(testFn(member)).toBe(false);
  });
});

describe("isMessageInstance()", () => {
  const testFn = isMessageInstance;
  test("recognizes messages", () => {
    expect(testFn(message)).toBe(true);
  });
  test("rejects everything else", () => {
    for (const value of [voiceChannel, stageChannel, textChannel, threadChannel, guild, client, member]) {
      expect(testFn(value)).toBe(false);
    }
  });
});

describe("isTextChannelInstance()", () => {
  const testFn = isTextChannelInstance;
  test("recognizes text channels and stages", () => {
    expect(testFn(textChannel)).toBe(true);
    expect(testFn(stageChannel)).toBe(true);
  });
  test("rejects everything else", () => {
    for (const value of [voiceChannel, threadChannel, message, guild, client, member]) {
      expect(testFn(value)).toBe(false);
    }
  });
});

describe("isMemberInstance()", () => {
  const testFn = isMemberInstance;
  test("recognizes guild members", () => {
    expect(testFn(member)).toBe(true);
  });
  test("rejects everything else", () => {
    for (const value of [voiceChannel, stageChannel, textChannel, threadChannel, message, guild, client]) {
      expect(testFn(value)).toBe(false);
    }
  });
});

describe("isClientInstance()", () => {
  const testFn = isClientInstance;
  test("recognizes a client-like object", () => {
    expect(testFn(client)).toBe(true);
  });
  test("rejects everything else", () => {
    for (const value of [voiceChannel, message, guild, member, undefined, null, 1]) {
      expect(testFn(value)).toBe(false);
    }
  });
});

describe("isNsfwChannel()", () => {
  const testFn = isNsfwChannel;
  test("reads the nsfw flag", () => {
    expect(testFn(voiceChannel)).toBe(true);
    expect(testFn(stageChannel)).toBe(false);
    expect(testFn(textChannel)).toBe(false);
  });
  test("inherits the parent state for threads", () => {
    const parent = { ...textChannel, nsfw: true, isThread: () => false };
    const thread = {
      id: "1098543313134563338",
      parentId: TEXT_CHANNEL_ID,
      client: { cache: { channels: { get: () => parent } } },
      isThread: () => true,
    };
    expect(testFn(thread)).toBe(true);
    const orphan = { isThread: () => true };
    expect(testFn(orphan)).toBe(false);
  });
  test("rejects non-channels", () => {
    expect(testFn(guild)).toBe(false);
    expect(testFn(undefined)).toBe(false);
  });
});

describe("resolveGuildId()", () => {
  const testFn = resolveGuildId;
  test("resolves from guildId-bearing objects", () => {
    expect(testFn(GUILD_ID)).toBe(GUILD_ID);
    expect(testFn(voiceChannel as never)).toBe(GUILD_ID);
    expect(testFn(stageChannel as never)).toBe(GUILD_ID);
    expect(testFn(textChannel as never)).toBe(GUILD_ID);
    expect(testFn(message as never)).toBe(GUILD_ID);
    expect(testFn(member as never)).toBe(GUILD_ID);
  });
  test("resolves from a guild", () => {
    expect(testFn(guild as never)).toBe(GUILD_ID);
    expect(testFn({ guild: { id: GUILD_ID, name: "X" } } as never)).toBe(GUILD_ID);
  });
  test("throws for invalid input", () => {
    expectError(() => testFn(client as never), "InvalidType");
    expectError(() => testFn(1 as never), "InvalidType");
  });
});

describe("isVoiceChannelEmpty()", () => {
  const botState = { userId: BOT_ID, channelId: VOICE_CHANNEL_ID };
  const userState = { userId: USER_ID, channelId: VOICE_CHANNEL_ID };
  const makeState = (states: { userId: string; channelId: string }[], members: Record<string, unknown>) => ({
    guildId: GUILD_ID,
    channelId: VOICE_CHANNEL_ID,
    client: {
      botId: BOT_ID,
      cache: {
        voiceStates: { values: () => states, get: () => botState },
        members: { get: (id: string) => members[id] },
      },
    },
  });

  test("returns false when the client is missing", () => {
    expect(isVoiceChannelEmpty({ guildId: GUILD_ID } as never)).toBe(false);
  });

  test("returns true when only bots are in the channel", () => {
    const state = makeState([botState], { [BOT_ID]: { user: { bot: true } } });
    expect(isVoiceChannelEmpty(state as never)).toBe(true);
  });

  test("returns false when a user is in the channel", () => {
    const state = makeState([botState, userState], {
      [BOT_ID]: { user: { bot: true } },
      [USER_ID]: { user: { bot: false } },
    });
    expect(isVoiceChannelEmpty(state as never)).toBe(false);
  });
});

describe("isVoicePluginInstalled() and checkVoicePlugin()", () => {
  const withVoice = { ...client, voice: { connect: () => undefined, disconnect: () => undefined } };
  test("detects the voice plugin", () => {
    expect(isVoicePluginInstalled(withVoice)).toBe(true);
    expect(isVoicePluginInstalled(client)).toBe(false);
  });
  test("throws when the plugin is missing", () => {
    expectError(() => checkVoicePlugin(client), "VoicePluginMissing");
    expect(() => checkVoicePlugin(withVoice)).not.toThrow();
  });
});

describe("formatDuration()", () => {
  test("formats durations", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(Number.NaN)).toBe("00:00");
    expect(formatDuration(5)).toBe("00:05");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3665)).toBe("01:01:05");
    expect(formatDuration(90061)).toBe("25:01:01");
  });
});

describe("checkInvalidKey()", () => {
  const target = { a: 0, b: 1 };
  const name = "target";
  test("throws for invalid argument keys", () => {
    expectError(() => checkInvalidKey(0 as never, [], name), "InvalidType");
    expectError(() => checkInvalidKey(target, ["b"], name), "InvalidKey");
    expectError(() => checkInvalidKey(target, { a: undefined }, name), "InvalidKey");
  });
  test("accepts valid keys", () => {
    expect(checkInvalidKey(target, { a: 0, b: 0, c: 0 }, name)).toBeUndefined();
    expect(checkInvalidKey(target, ["a", "b"], name)).toBeUndefined();
  });
});
