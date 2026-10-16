import { SeyfertError, type SeyfertErrorCode } from "seyfert";

export type VoiceErrorCode =
  | "VoiceInvalidArgument"
  | "VoiceNotConnected"
  | "VoiceMoveRequired"
  | "VoiceOperationConflict"
  | "VoiceOperationTimeout"
  | "VoiceConnectionDestroyed"
  | "VoiceConnectionFailed"
  | "VoiceProtocolError"
  | "VoiceRuntimeUnsupported"
  | "VoiceVerificationUnavailable";

export interface VoiceErrorOptions {
  metadata?: Record<string, unknown>;
  cause?: unknown;
}

export class VoiceError<Code extends VoiceErrorCode = VoiceErrorCode> extends SeyfertError {
  override name = "VoiceError";
  declare code: Code;

  constructor(code: Code, options?: VoiceErrorOptions) {
    super(code, options);
    this.code = code;
    Error.captureStackTrace?.(this, VoiceError);
  }

  static override is(error: unknown): error is VoiceError;
  static override is<Code extends SeyfertErrorCode>(
    error: unknown,
    code: Code,
  ): error is VoiceError & { code: Extract<Code, VoiceErrorCode> };
  static override is(error: unknown, code?: SeyfertErrorCode): error is VoiceError {
    return error instanceof VoiceError && (code === undefined || error.code === code);
  }
}
