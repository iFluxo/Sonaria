import { VoiceError } from "./errors";
import type { VoiceConnectOptions, VoiceSelfStateOptions } from "./types";

const MaxTimerDelayMs = 2_147_483_647;

export function assertSnowflake(value: unknown, field: string): asserts value is string {
  try {
    if (typeof value !== "string") throw new TypeError();
    BigInt(value);
  } catch {
    throw new VoiceError("VoiceInvalidArgument", {
      metadata: {
        detail: `${field} must be a valid Discord snowflake.`,
        field,
        received: value,
      },
    });
  }
}

export function resolveOperationTimeout(value: unknown): number {
  if (value === undefined) return 30_000;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MaxTimerDelayMs) {
    throw new VoiceError("VoiceInvalidArgument", {
      metadata: {
        detail: `operationTimeoutMs must be greater than 0 and at most ${MaxTimerDelayMs}.`,
        field: "operationTimeoutMs",
        received: value,
      },
    });
  }
  return value;
}

export function resolveConnectInput(options: VoiceConnectOptions): VoiceConnectOptions {
  if (!options || typeof options !== "object") {
    throw new VoiceError("VoiceInvalidArgument", {
      metadata: { detail: "Voice connection options must be an object.", field: "options", received: options },
    });
  }

  assertSnowflake(options.guildId, "guildId");
  assertSnowflake(options.channelId, "channelId");
  assertOptionalBoolean(options.selfMute, "selfMute");
  assertOptionalBoolean(options.selfDeaf, "selfDeaf");
  assertOptionalBoolean(options.move, "move");
  return options;
}

export function resolveSelfStateInput(options: VoiceSelfStateOptions): VoiceSelfStateOptions {
  if (!options || typeof options !== "object") {
    throw new VoiceError("VoiceInvalidArgument", {
      metadata: { detail: "Self voice state options must be an object.", field: "options", received: options },
    });
  }

  if (options.selfMute === undefined && options.selfDeaf === undefined) {
    throw new VoiceError("VoiceInvalidArgument", {
      metadata: { detail: "At least one of selfMute or selfDeaf is required.", field: "options" },
    });
  }

  assertOptionalBoolean(options.selfMute, "selfMute");
  assertOptionalBoolean(options.selfDeaf, "selfDeaf");
  return options;
}

function assertOptionalBoolean(value: unknown, field: string): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== "boolean") {
    throw new VoiceError("VoiceInvalidArgument", {
      metadata: { detail: `${field} must be a boolean.`, field, received: value },
    });
  }
}
