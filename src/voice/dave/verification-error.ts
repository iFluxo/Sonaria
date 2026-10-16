/** @internal */
export type DaveVerificationErrorReason = "ParticipantNotPresent" | "ParticipantChanged" | "DerivationFailed";

/** @internal */
export class DaveVerificationError extends Error {
  readonly reason: DaveVerificationErrorReason;

  constructor(reason: DaveVerificationErrorReason, options?: ErrorOptions) {
    super(verificationErrorMessage(reason), options);
    this.name = "DaveVerificationError";
    this.reason = reason;
    Error.captureStackTrace?.(this, DaveVerificationError);
  }
}

function verificationErrorMessage(reason: DaveVerificationErrorReason): string {
  switch (reason) {
    case "ParticipantNotPresent":
      return "The requested DAVE participant is unavailable.";
    case "ParticipantChanged":
      return "The requested DAVE participant changed during verification.";
    case "DerivationFailed":
      return "The DAVE verification code derivation failed.";
  }
}
