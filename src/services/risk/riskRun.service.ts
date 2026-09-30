/**
 * P1 — Risk Run Service
 *
 * Manages the lifecycle of a RiskRun record.
 * Enforces the state machine: QUEUED → RUNNING → SUCCEEDED | FAILED → STALE
 *
 * Never deletes or overwrites historical runs.
 */

import { prisma } from "../../config/db";
import type { RiskRunStatus } from "@prisma/client";
import { hashRiskResult } from "../provenance/canonicalHash.service";
import { InvalidStateTransitionError, RiskRunNotFoundError } from "./errors";
import type { EvidenceContext } from "./evidenceContext.service";

// ---------------------------------------------------------------------------
// State machine (P1.10)
//
//   QUEUED -> RUNNING
//   RUNNING -> SUCCEEDED
//   RUNNING -> FAILED
//   SUCCEEDED -> STALE
//
// No other transition is legal. Historical runs are never overwritten.
// ---------------------------------------------------------------------------

export const RISK_RUN_TRANSITIONS: Readonly<Record<RiskRunStatus, readonly RiskRunStatus[]>> = {
  QUEUED: ["RUNNING"],
  RUNNING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: ["STALE"],
  FAILED: [],
  STALE: [],
};

/** Throws InvalidStateTransitionError when `to` is not reachable from `from`. */
export function assertValidTransition(from: RiskRunStatus, to: RiskRunStatus): void {
  if (!RISK_RUN_TRANSITIONS[from].includes(to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateRiskRunOptions {
  organizationId: string;
  scopeType?: string;
  scopeId?: string;
  asOf?: Date;
  triggeredBy?: string;
  triggerReason?: string;
  riskEngineVersion?: string;
  parameterVersion?: string;
  modelBundleVersion?: string;
  featureSetVersion?: string;
  simulationConfigVersion?: string;
  inputStateHash: string;
  coverageState: object;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function createRiskRun(opts: CreateRiskRunOptions) {
  const now = new Date();
  return prisma.riskRun.create({
    data: {
      organizationId: opts.organizationId,
      scopeType: opts.scopeType ?? "ENTERPRISE",
      scopeId: opts.scopeId ?? opts.organizationId,
      asOf: opts.asOf ?? now,
      status: "QUEUED",
      riskEngineVersion: opts.riskEngineVersion ?? "deterministic-baseline-v0",
      parameterVersion: opts.parameterVersion ?? "params-2026-09",
      modelBundleVersion: opts.modelBundleVersion ?? "deterministic-baseline-v0",
      featureSetVersion: opts.featureSetVersion ?? "features-v1",
      simulationConfigVersion: opts.simulationConfigVersion ?? "mc-config-v1",
      inputStateHash: opts.inputStateHash,
      coverageState: opts.coverageState,
      triggeredBy: opts.triggeredBy ?? "system",
      triggerReason: opts.triggerReason ?? "MANUAL",
    },
  });
}

/**
 * Perform a guarded, atomic state transition.
 *
 * The `where.status` filter makes the check-and-set atomic at the database
 * level, so concurrent transitions cannot both succeed.  If no row matches,
 * the current status is re-read to raise a precise domain error.
 */
async function transition(
  riskRunId: string,
  from: RiskRunStatus,
  to: RiskRunStatus,
  data: Record<string, unknown> = {}
) {
  assertValidTransition(from, to);

  const { count } = await prisma.riskRun.updateMany({
    where: { id: riskRunId, status: from },
    data: { status: to, ...data },
  });

  if (count === 0) {
    const current = await prisma.riskRun.findUnique({
      where: { id: riskRunId },
      select: { status: true },
    });
    if (!current) throw new RiskRunNotFoundError(riskRunId);
    throw new InvalidStateTransitionError(current.status, to);
  }

  return prisma.riskRun.findUniqueOrThrow({ where: { id: riskRunId } });
}

export async function markRiskRunRunning(riskRunId: string) {
  return transition(riskRunId, "QUEUED", "RUNNING", { startedAt: new Date() });
}

export async function markRiskRunSucceeded(riskRunId: string, result: unknown) {
  const resultHash = hashRiskResult(result);
  return transition(riskRunId, "RUNNING", "SUCCEEDED", {
    resultHash,
    completedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  });
}

export async function markRiskRunFailed(
  riskRunId: string,
  errorCode: string,
  errorMessage: string
) {
  return transition(riskRunId, "RUNNING", "FAILED", {
    errorCode,
    errorMessage,
    completedAt: new Date(),
  });
}

/** Mark all SUCCEEDED runs for an org as STALE (except the given current one). */
export async function staleOlderRuns(organizationId: string, keepRiskRunId: string) {
  return prisma.riskRun.updateMany({
    where: {
      organizationId,
      status: "SUCCEEDED",
      id: { not: keepRiskRunId },
    },
    data: { status: "STALE" },
  });
}

export async function getLatestSucceededRun(organizationId: string) {
  return prisma.riskRun.findFirst({
    where: { organizationId, status: "SUCCEEDED" },
    orderBy: { completedAt: "desc" },
    include: { assessments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

/**
 * Fetch a single historical assessment, strictly scoped to the caller's
 * organisation.  Returns null when the assessment does not exist *or* belongs
 * to another tenant — callers must not distinguish the two (no data leakage).
 */
export async function getAssessmentById(organizationId: string, assessmentId: string) {
  return prisma.riskAssessment.findFirst({
    where: { id: assessmentId, organizationId },
    include: { riskRun: true },
  });
}

/** List assessment history for an organisation, newest first. */
export async function listAssessments(organizationId: string, take = 20) {
  return prisma.riskAssessment.findMany({
    where: { organizationId },
    orderBy: { computedAt: "desc" },
    take,
  });
}

/**
 * Persist a RiskAssessment result for a completed run.
 * Every call creates a NEW record — results are never overwritten.
 */
export async function persistRiskAssessment(
  riskRun: Awaited<ReturnType<typeof createRiskRun>>,
  evidenceCtx: EvidenceContext,
  result: {
    totalFinancialExposureInr: bigint;
    expectedAnnualLossInr: bigint;
    valueAtRisk95Inr: bigint;
    averageLikelihood: number;
    controlEffectiveness: number;
    riskScore: number;
    drivers: unknown;
    topDrivers: unknown;
    assumptions: unknown;
  }
) {
  const resultHash = hashRiskResult(result);
  return prisma.riskAssessment.create({
    data: {
      riskRunId: riskRun.id,
      organizationId: riskRun.organizationId,
      scopeType: riskRun.scopeType,
      scopeId: riskRun.scopeId,
      asOf: riskRun.asOf,
      totalFinancialExposureInr: result.totalFinancialExposureInr,
      expectedAnnualLossInr: result.expectedAnnualLossInr,
      valueAtRisk95Inr: result.valueAtRisk95Inr,
      averageLikelihood: result.averageLikelihood,
      controlEffectiveness: result.controlEffectiveness,
      riskScore: result.riskScore,
      drivers: result.drivers as object,
      topDrivers: result.topDrivers as object,
      assumptions: result.assumptions as object,
      riskEngineVersion: riskRun.riskEngineVersion,
      parameterVersion: riskRun.parameterVersion,
      modelBundleVersion: riskRun.modelBundleVersion,
      inputStateHash: riskRun.inputStateHash,
      resultHash,
    },
  });
}

/** Append-only audit event for PS 26105 risk operations. */
export async function appendRiskAuditEvent(opts: {
  organizationId: string;
  riskRunId?: string;
  actor?: string;
  action: "RISK_RUN_CREATED" | "RISK_RUN_COMPLETED" | "RISK_RUN_FAILED" | "RISK_ASSESSMENT_PERSISTED";
  inputStateHash?: string;
  resultHash?: string;
  metadata?: object;
}) {
  return prisma.riskAuditEvent.create({ data: opts });
}
