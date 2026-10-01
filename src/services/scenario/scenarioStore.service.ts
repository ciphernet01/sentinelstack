/**
 * P4 — Scenario persistence and orchestration
 *
 * Persists scenario definitions, their declared changes, and immutable run
 * results. The engine itself lives in `scenarioRunner.service.ts`; this module
 * only handles loading, saving, and the baseline lifecycle around it.
 *
 * Tenancy is structural: `organizationId` is in every `where` clause, and a
 * scenario is only ever run against a baseline assessment that the calling
 * organisation actually owns (P4 spec §99).
 */

import { prisma } from "../../config/db";
import type { Prisma } from "@prisma/client";
import { RiskDomainError } from "../risk/errors";
import { appendRiskAuditEvent } from "../risk/riskRun.service";
import { buildRiskCalculationContext } from "../risk/riskContext.builder";
import { buildEvidenceContext } from "../risk/evidenceContext.service";
import { hashRiskInput } from "../provenance/canonicalHash.service";
import { calculateRisk, type RiskEngineResult } from "../risk/riskEngine.service";
import type { RiskCalculationContext } from "../risk/riskCalculationContext";
import {
  attributeDriversForAssessment,
  type AttributionResult,
} from "../risk/riskAttribution.service";
import {
  resolveScenarioState,
  type ScenarioChange,
  type ScenarioChangeType,
  type ScenarioValidationIssue,
} from "./scenarioState.service";
import {
  buildScenarioResult,
  ScenarioNotApplicableError,
  type ScenarioResult,
} from "./scenarioRunner.service";

export class ScenarioNotFoundError extends RiskDomainError {
  constructor(message = "Scenario not found") {
    super("SCENARIO_NOT_FOUND", message, 404);
    this.name = "ScenarioNotFoundError";
  }
}

export class ScenarioRunFailedError extends RiskDomainError {
  constructor(message: string) {
    super("SCENARIO_RUN_FAILED", message, 422);
    this.name = "ScenarioRunFailedError";
  }
}

export interface CreateScenarioInput {
  organizationId: string;
  name: string;
  description?: string;
  type: ScenarioChangeType;
  baselineRiskAssessmentId: string;
  createdById?: string;
  changes: Array<Omit<ScenarioChange, "id">>;
}

export interface PersistedScenario {
  id: string;
  organizationId: string;
  name: string;
  type: ScenarioChangeType;
  status: string;
  baselineRiskAssessmentId: string;
  baselineRiskRunId: string;
  baselineInputStateHash: string;
  scenarioStateHash: string | null;
  changeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Map a stored change row back to the engine's change shape. */
function toEngineChange(row: {
  id: string;
  targetType: string;
  targetId: string;
  fieldPath: string;
  operation: string;
  newValue: unknown;
  sourceDriverId: string | null;
  investmentOptionId: string | null;
  reason: string | null;
  sequence: number;
}): ScenarioChange {
  return {
    id: row.id,
    targetType: row.targetType as ScenarioChange["targetType"],
    targetId: row.targetId,
    fieldPath: row.fieldPath,
    operation: row.operation as ScenarioChange["operation"],
    newValue: row.newValue,
    sourceDriverId: row.sourceDriverId ?? undefined,
    investmentOptionId: row.investmentOptionId ?? undefined,
    reason: row.reason ?? undefined,
    sequence: row.sequence,
  };
}

/**
 * Load the baseline for a scenario: its assessment, its run, and the input
 * context to calculate against.
 *
 * A subtle point: the context is rebuilt from *current* state, because the
 * engine takes a context rather than a stored blob. If the rebuilt context's
 * input hash no longer matches the baseline's, production has moved on since the
 * assessment was written. That is a stale baseline, and it is surfaced rather
 * than papered over (P4 spec §32, §83).
 */
async function loadBaseline(organizationId: string, assessmentId: string) {
  const assessment = await prisma.riskAssessment.findFirst({
    where: { id: assessmentId, organizationId },
    select: {
      id: true,
      riskRunId: true,
      inputStateHash: true,
      expectedAnnualLossInr: true,
      valueAtRisk95Inr: true,
      totalFinancialExposureInr: true,
      riskScore: true,
      asOf: true,
      scopeType: true,
      scopeId: true,
      riskRun: {
        select: {
          riskEngineVersion: true,
          parameterVersion: true,
          modelBundleVersion: true,
          simulationConfigVersion: true,
        },
      },
    },
  });

  if (!assessment) {
    throw new ScenarioNotFoundError(
      `Baseline assessment ${assessmentId} was not found for this organisation.`
    );
  }

  const context = await buildRiskCalculationContext({
    organizationId,
    scopeType: assessment.scopeType as RiskCalculationContext["scopeType"],
    scopeId: assessment.scopeId,
    asOf: assessment.asOf,
    inputStateHash: assessment.inputStateHash,
  });

  // `buildRiskCalculationContext` cannot produce a live hash — it takes one as
  // input. So recompute the canonical hash from current production state and
  // compare it to the hash stored on the assessment. Comparing the stored hash
  // to itself would always match, and a drifted baseline would be silently
  // reported as fresh (P4 spec §32, §83).
  const currentInputStateHash = await computeLiveInputStateHash({
    organizationId,
    scopeType: assessment.scopeType as RiskCalculationContext["scopeType"],
    scopeId: assessment.scopeId,
    asOf: assessment.asOf,
  });

  // `null` means staleness could not be determined (a scope the evidence bundle
  // cannot evidence). That is reported as "unknown", never as "fresh".
  const isStaleBaseline =
    currentInputStateHash === null
      ? null
      : currentInputStateHash !== assessment.inputStateHash;

  return {
    assessment,
    context,
    currentInputStateHash,
    isStaleBaseline,
  };
}

/**
 * Recompute the canonical input hash from live data.
 *
 * The assessment's own `asOf` is reused so the comparison isolates evidence
 * drift: a different evaluation timestamp would otherwise show up as a false
 * positive on every single run.
 */
async function computeLiveInputStateHash(options: {
  organizationId: string;
  scopeType: RiskCalculationContext["scopeType"];
  scopeId: string;
  asOf: Date;
}): Promise<string | null> {
  // The evidence bundle is keyed by organisation, not scope, so it only accepts
  // the scopes it can actually evidence. A SERVICE-scoped baseline is not one of
  // them, and forcing it through would emit a hash for a bundle that was never
  // really built. Returning null lets the caller disclose rather than guess.
  if (options.scopeType === "SERVICE") return null;

  const { bundle, inputStateHash } = await buildEvidenceContext({
    organizationId: options.organizationId,
    scopeType: options.scopeType,
    scopeId: options.scopeId,
    asOf: options.asOf,
  });
  return inputStateHash ?? hashRiskInput(bundle);
}

/** Recalculate the baseline with the current engine rather than trusting the row. */
async function calculateBaseline(
  context: RiskCalculationContext
): Promise<RiskEngineResult> {
  return calculateRisk(context);
}

/** Create a scenario and its declared changes. */
export async function createScenario(
  input: CreateScenarioInput
): Promise<PersistedScenario> {
  const { organizationId, baselineRiskAssessmentId, changes } = input;

  const { assessment } = await loadBaseline(organizationId, baselineRiskAssessmentId);

  // Reject duplicate sequence positions before the database has to.
  const sequences = new Set<number>();
  for (const change of changes) {
    if (sequences.has(change.sequence)) {
      throw new RiskDomainError(
        "SCENARIO_DUPLICATE_SEQUENCE",
        `Two changes share sequence ${change.sequence}; application order must be unambiguous.`,
        400
      );
    }
    sequences.add(change.sequence);
  }

  const created = await prisma.scenario.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description ?? null,
      type: input.type as never,
      // A scenario with declared changes is ready to run; one without is a draft.
      status: changes.length > 0 ? "READY" : "DRAFT",
      baselineRiskAssessmentId: baselineRiskAssessmentId,
      baselineRiskRunId: assessment.riskRunId,
      baselineInputStateHash: assessment.inputStateHash,
      createdById: input.createdById ?? null,
      changes: {
        create: changes.map((change) => ({
          targetType: change.targetType as never,
          targetId: change.targetId,
          fieldPath: change.fieldPath,
          operation: change.operation as never,
          newValue: change.newValue as Prisma.InputJsonValue,
          reason: change.reason ?? null,
          sourceDriverId: change.sourceDriverId ?? null,
          investmentOptionId: change.investmentOptionId ?? null,
          sequence: change.sequence,
        })),
      },
    },
    include: { changes: { select: { id: true } } },
  });

  await appendRiskAuditEvent({
    organizationId,
    riskRunId: assessment.riskRunId,
    actor: input.createdById ?? "system",
    action: "SCENARIO_CREATED",
    inputStateHash: assessment.inputStateHash,
    metadata: { scenarioId: created.id, changeCount: created.changes.length },
  });

  return {
    id: created.id,
    organizationId: created.organizationId,
    name: created.name,
    type: created.type as ScenarioChangeType,
    status: created.status,
    baselineRiskAssessmentId: created.baselineRiskAssessmentId,
    baselineRiskRunId: created.baselineRiskRunId,
    baselineInputStateHash: created.baselineInputStateHash,
    scenarioStateHash: created.scenarioStateHash,
    changeCount: created.changes.length,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/** List scenarios for an organisation, newest first. */
export async function listScenarios(
  organizationId: string,
  options: { status?: string; take?: number } = {}
) {
  const scenarios = await prisma.scenario.findMany({
    where: {
      // Tenant boundary. Not optional.
      organizationId,
      ...(options.status ? { status: options.status as never } : {}),
    },
    include: { changes: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options.take ?? 25, 1), 100),
  });

  return scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    type: scenario.type as ScenarioChangeType,
    status: scenario.status,
    baselineRiskAssessmentId: scenario.baselineRiskAssessmentId,
    scenarioStateHash: scenario.scenarioStateHash,
    changeCount: scenario.changes.length,
    createdAt: scenario.createdAt,
  }));
}

/** Fetch a scenario with its declared changes, tenant-scoped. */
export async function getScenario(organizationId: string, scenarioId: string) {
  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, organizationId },
    include: {
      changes: { orderBy: { sequence: "asc" } },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { assessments: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });

  if (!scenario) throw new ScenarioNotFoundError();
  return scenario;
}

/**
 * Validate a scenario's changes without running it (P4 §52).
 *
 * Lets an analyst see every problem before committing to an expensive run.
 */
export async function validateScenario(
  organizationId: string,
  scenarioId: string
): Promise<{ applicable: boolean; issues: ScenarioValidationIssue[]; changeCount: number }> {
  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, organizationId },
    include: { changes: { orderBy: { sequence: "asc" } } },
  });
  if (!scenario) throw new ScenarioNotFoundError();

  const { context } = await loadBaseline(organizationId, scenario.baselineRiskAssessmentId);
  const changes = scenario.changes.map(toEngineChange);
  const resolved = resolveScenarioState(context, changes);

  return {
    applicable: resolved.applied.length > 0 && resolved.issues.length === 0,
    issues: resolved.issues,
    changeCount: changes.length,
  };
}

export interface RunPersistedScenarioInput {
  organizationId: string;
  scenarioId: string;
  /** Implementation cost assumption, when the scenario carries one. */
  cost?: number;
  actor?: string;
}

export interface PersistedScenarioRun {
  runId: string;
  scenarioId: string;
  assessmentId: string;
  status: string;
  result: ScenarioResult;
  attribution: AttributionResult | null;
  warnings: string[];
  /**
   * Whether the baseline no longer reflects live production evidence.
   * `null` means it could not be determined — not that it was verified fresh.
   */
  staleBaseline: boolean | null;
}

/**
 * Run a persisted scenario end to end.
 *
 * The run row is written before calculating, so a crash mid-calculation is
 * visible as a FAILED run rather than a scenario that silently never ran. Every
 * run appends a new ScenarioAssessment; a previous result is never mutated, so
 * two runs stay honestly comparable (P4 §33, §104).
 *
 * The scenario is calculated exactly once — the result feeds both the delta and
 * the P3 attribution.
 */
export async function runPersistedScenario(
  input: RunPersistedScenarioInput
): Promise<PersistedScenarioRun> {
  const { organizationId, scenarioId, cost } = input;

  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, organizationId },
    include: { changes: { orderBy: { sequence: "asc" } } },
  });
  if (!scenario) throw new ScenarioNotFoundError();

  const { assessment, context, currentInputStateHash, isStaleBaseline } = await loadBaseline(
    organizationId,
    scenario.baselineRiskAssessmentId
  );

  const changes = scenario.changes.map(toEngineChange);
  const resolved = resolveScenarioState(context, changes);

  if (resolved.issues.length > 0) {
    throw new ScenarioRunFailedError(
      `Scenario cannot be applied: ${resolved.issues
        .map((issue) => `${issue.changeId}: ${issue.message}`)
        .join("; ")}`
    );
  }
  if (resolved.applied.length === 0) {
    throw new ScenarioRunFailedError(
      "Scenario declares no applicable changes; there is nothing to calculate."
    );
  }

  const warnings: string[] = [];

  // Stale-baseline disclosure (P4 §32, §83). The context is rebuilt from live
  // state, so a hash mismatch means production moved after the assessment.
  if (isStaleBaseline === true) {
    warnings.push(
      "The baseline assessment was produced from a different input state than current " +
        "production. The scenario was recalculated against current state, so the delta " +
        "includes environmental drift as well as the declared change."
    );
  } else if (isStaleBaseline === null) {
    // Unknown is not fresh. Saying nothing here would let an unverifiable
    // baseline read as a verified-current one.
    warnings.push(
      "Baseline staleness could not be verified for this scope; the delta is presented " +
        "against current state but the original baseline could not be re-evidenced."
    );
  }

  const run = await prisma.scenarioRun.create({
    data: {
      scenarioId,
      organizationId,
      status: "RUNNING",
      scenarioStateHash: resolved.scenarioStateHash,
      warnings: warnings as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  try {
    const [baselineResult, scenarioResult] = await Promise.all([
      calculateBaseline(context),
      calculateRisk(resolved.context),
    ]);

    const result = buildScenarioResult({
      type: scenario.type as ScenarioChangeType,
      baselineResult,
      scenarioResult,
      scenarioStateHash: resolved.scenarioStateHash,
      appliedChanges: resolved.applied,
      validationIssues: resolved.issues,
      warnings: resolved.warnings,
      ...(cost === undefined ? {} : { cost }),
    });

    const allWarnings = [...warnings, ...result.warnings];

    const scenarioAssessment = await prisma.scenarioAssessment.create({
      data: {
        scenarioRunId: run.id,
        organizationId,
        eal: result.scenario.eal,
        var95: result.scenario.var95,
        var99: result.scenario.var99,
        financialExposure: result.scenario.financialExposure,
        riskScore: Math.round(result.scenario.riskScore),
        currency: context.currency,
        baselineEal: result.baseline.eal,
        baselineVar95: result.baseline.var95,
        baselineVar99: result.baseline.var99,
        baselineFinancialExposure: result.baseline.financialExposure,
        baselineRiskScore: Math.round(result.baseline.riskScore),
        deltaEal: result.delta.eal,
        deltaVar95: result.delta.var95,
        deltaVar99: result.delta.var99,
        deltaFinancialExposure: result.delta.financialExposure,
        deltaRiskScore: Math.round(result.delta.riskScore),
        costInr: cost === undefined ? null : BigInt(Math.round(cost)),
        avoidedEal: result.avoidedEal,
        riskEngineVersion: result.versions.riskEngine,
        parameterVersion: result.versions.parameters,
        modelBundleVersion: result.versions.modelBundle,
        scenarioStateHash: result.scenarioStateHash,
        calculationHash: result.scenarioResultHash,
        // Drivers are written immediately after this row exists, so they can
        // reference their own assessment. See the attribution call below.
        drivers: [] as unknown as Prisma.InputJsonValue,
        metadata: {
          uncertainty: result.uncertainty,
          simulation: result.simulation,
          baselineResultHash: result.baselineResultHash,
          // Both hashes are retained so a reader can see the baseline the run
          // started from and the live state it was compared against.
          baselineInputStateHash: assessment.inputStateHash,
          currentInputStateHash,
          staleBaseline: isStaleBaseline,
        } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    // P3 attribution over the scenario state, reusing the result just computed.
    // It is attributed against the scenario assessment so the drivers are
    // labelled with the state they actually describe — attributing them to the
    // *baseline* assessment would present a what-if as a production finding.
    const attribution = attributeDriversForAssessment({
      organizationId,
      riskRunId: run.id,
      riskAssessmentId: scenarioAssessment.id,
      context: resolved.context,
      result: scenarioResult,
    });

    // Scenario drivers are stored on the scenario assessment rather than as
    // RiskDriver rows: they describe a hypothetical state that has no production
    // RiskAssessment to hang off, and writing them into the P3 graph would let a
    // what-if be read as a real finding. They stay immutable with the run.
    await prisma.scenarioAssessment.update({
      where: { id: scenarioAssessment.id },
      data: { drivers: attribution.drivers as unknown as Prisma.InputJsonValue },
    });

    await Promise.all([
      prisma.scenarioRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          scenarioStateHash: result.scenarioStateHash,
          engineResultHash: result.scenarioResultHash,
          warnings: allWarnings as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      }),
      prisma.scenario.update({
        where: { id: scenarioId },
        data: { scenarioStateHash: result.scenarioStateHash, status: "COMPLETED" },
      }),
      appendRiskAuditEvent({
        organizationId,
        riskRunId: scenario.baselineRiskRunId,
        actor: input.actor ?? "system",
        action: "SCENARIO_RUN_COMPLETED",
        resultHash: result.scenarioResultHash,
        metadata: {
          scenarioId,
          runId: run.id,
          deltaEal: result.delta.eal,
          cost: cost ?? null,
        },
      }),
    ]);

    return {
      runId: run.id,
      scenarioId,
      assessmentId: scenarioAssessment.id,
      status: "SUCCEEDED",
      result,
      attribution,
      warnings: allWarnings,
      staleBaseline: isStaleBaseline,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    // A failed scenario is a recorded outcome, not a silent no-op.
    await prisma.scenarioRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    await prisma.scenario.update({ where: { id: scenarioId }, data: { status: "FAILED" } });
    await appendRiskAuditEvent({
      organizationId,
      riskRunId: scenario.baselineRiskRunId,
      actor: input.actor ?? "system",
      action: "SCENARIO_RUN_FAILED",
      metadata: { scenarioId, runId: run.id, errorMessage: message },
    });

    if (error instanceof ScenarioNotApplicableError) {
      throw new ScenarioRunFailedError(message);
    }
    throw error;
  }
}

/** Compare two runs of the same scenario (P4 §48, §104). */
export async function compareScenarioRuns(
  organizationId: string,
  scenarioId: string
) {
  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, organizationId },
    select: { id: true },
  });
  if (!scenario) throw new ScenarioNotFoundError();

  const runs = await prisma.scenarioRun.findMany({
    where: { scenarioId, organizationId },
    orderBy: { startedAt: "desc" },
    take: 2,
    include: { assessments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (runs.length < 2) {
    return {
      comparable: false,
      reason: "A comparison needs at least two runs of the same scenario.",
      runs: runs.map((run) => ({ runId: run.id, status: run.status, startedAt: run.startedAt })),
    };
  }

  const [current, previous] = runs;
  const a = current.assessments[0];
  const b = previous.assessments[0];

  if (!a || !b) {
    return {
      comparable: false,
      reason: "One of the runs has no stored result to compare.",
      runs: runs.map((run) => ({ runId: run.id, status: run.status, startedAt: run.startedAt })),
    };
  }

  return {
    comparable: true,
    currentRunId: current.id,
    previousRunId: previous.id,
    // Same scenario, same engine, same parameters — unless the versions moved.
    sameScenarioState: current.scenarioStateHash === previous.scenarioStateHash,
    deltaBetweenRuns: {
      eal: a.eal - b.eal,
      var95: a.var95 - b.var95,
      riskScore: a.riskScore - b.riskScore,
    },
    runs: runs.map((run) => ({ runId: run.id, status: run.status, startedAt: run.startedAt })),
  };
}