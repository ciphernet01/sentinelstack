/**
 * P1 — Typed errors for the PS 26105 risk domain.
 *
 * All risk-domain failures should be expressed as a RiskDomainError so that
 * controllers can map them to the correct HTTP status without leaking
 * internal details, and so audit/telemetry can key off a stable error code.
 */

export class RiskDomainError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "RiskDomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** The point-in-time evidence bundle could not be built for the requested scope. */
export class EvidenceContextError extends RiskDomainError {
  constructor(message: string) {
    super("EVIDENCE_CONTEXT_ERROR", message, 422);
    this.name = "EvidenceContextError";
  }
}

/** An illegal RiskRun state transition was attempted. */
export class InvalidStateTransitionError extends RiskDomainError {
  constructor(from: string, to: string) {
    super(
      "INVALID_STATE_TRANSITION",
      `Illegal RiskRun state transition: ${from} -> ${to}`,
      409
    );
    this.name = "InvalidStateTransitionError";
  }
}

/** The requested risk run does not exist, or is not visible to the caller's organisation. */
export class RiskRunNotFoundError extends RiskDomainError {
  constructor(riskRunId: string) {
    super("RISK_RUN_NOT_FOUND", `RiskRun ${riskRunId} was not found for this organisation.`, 404);
    this.name = "RiskRunNotFoundError";
  }
}

export function isRiskDomainError(err: unknown): err is RiskDomainError {
  return err instanceof RiskDomainError;
}
