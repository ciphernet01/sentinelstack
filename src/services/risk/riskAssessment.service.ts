/**
 * P1 — Risk Assessment Service (compatibility façade)
 *
 * This is the new authoritative entry point for PS 26105 risk calculations.
 * It wraps the existing CyberRiskQuantificationService so all legacy callers
 * keep working, while adding:
 *   • RiskRun creation + lifecycle management
 *   • Canonical input hashing via EvidenceContextService
 *   • Immutable RiskAssessment persistence
 *   • Append-only RiskAuditEvent ledger
 *   • Versioned metadata surfaced in every response
 *
 * MIGRATION PLAN
 * ──────────────
 * Phase P1  (now)  : façade + lineage records alongside the existing service
 * Phase P2  (next) : replace deterministic EAL/VaR with Monte Carlo engine
 * Phase P3         : wire ML likelihood model into this service
 */

import { cyberRiskQuantificationService } from "../cyberRiskQuantification.service";
import { buildEvidenceContext } from "./evidenceContext.service";
import { computeCalculationHashForRun } from "./calculationHash.service";
import { buildProvenanceEnvelope } from "./provenanceEnvelope";
import { buildRiskCalculationContext } from "./riskContext.builder";
import {
  RISK_ENGINE_VERSION_V2,
  canonicalResultPayload,
  calculateRisk,
  type RiskEngineResult,
} from "./riskEngine.service";
import {
  createRiskRun,
  markRiskRunRunning,
  markRiskRunSucceeded,
  markRiskRunFailed,
  staleOlderRuns,
  persistRiskAssessment,
  appendRiskAuditEvent,
  getLatestSucceededRun,
  getAssessmentById,
  listAssessments,
} from "./riskRun.service";

// ---------------------------------------------------------------------------
// Version constants (bump these when the engine changes)
// ---------------------------------------------------------------------------

/** Legacy deterministic engine, retained as an explicit fallback path. */
export const RISK_ENGINE_VERSION_V1 = "deterministic-baseline-v0";
/** Monte Carlo Risk Engine v2 — the authoritative P2 calculator. */
export const RISK_ENGINE_VERSION = RISK_ENGINE_VERSION_V2;
export const PARAMETER_VERSION = "params-2026-09";
export const MODEL_BUNDLE_VERSION = "deterministic-baseline-v0";
export const FEATURE_SET_VERSION = "features-v1";
export const SIMULATION_CONFIG_VERSION_V1 = "mc-config-v1";
export const SIMULATION_CONFIG_VERSION = "mc-config-v2";

export type SupportedRiskEngineVersion =
  | typeof RISK_ENGINE_VERSION_V1
  | typeof RISK_ENGINE_VERSION_V2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunRiskOptions {
  organizationId: string;
  budgetInr?: number;
  triggeredBy?: string;
  triggerReason?: string;
  /**
   * Engine selection.  Defaults to the v2 Monte Carlo engine; the v1
   * deterministic calculator stays selectable so a result can be compared
   * against, or rolled back to, without a deploy.
   */
  riskEngineVersion?: SupportedRiskEngineVersion;
  /** Forwarded to the simulation config (development runs use fewer passes). */
  simulationCount?: number;
  seed?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RiskAssessmentService {
  /**
   * Run a full risk calculation for an organisation.
   *
   * Returns the legacy-compatible risk payload enriched with P1 provenance
   * metadata (riskRunId, assessmentId, versions, hashes).
   *
   * The existing GET /api/cyber-risk/enterprise handler calls this and the
   * response shape is additive — existing UI clients are unaffected.
   */
  async runEnterpriseRisk(opts: RunRiskOptions) {
    const { organizationId, budgetInr = 10_000_000, triggeredBy, triggerReason } = opts;
    const asOf = new Date();
    const engineVersion: SupportedRiskEngineVersion =
      opts.riskEngineVersion ?? RISK_ENGINE_VERSION;
    const useMonteCarlo = engineVersion === RISK_ENGINE_VERSION_V2;
    const simulationVersion = useMonteCarlo
      ? SIMULATION_CONFIG_VERSION
      : SIMULATION_CONFIG_VERSION_V1;

    // ① Build evidence context + canonical input hash
    const evidenceCtx = await buildEvidenceContext({
      organizationId,
      asOf,
      riskEngineVersion: engineVersion,
      parameterVersion: PARAMETER_VERSION,
      modelBundleVersion: MODEL_BUNDLE_VERSION,
      featureSetVersion: FEATURE_SET_VERSION,
      simulationConfigVersion: simulationVersion,
    });

    // ② Create RiskRun record (status = QUEUED)
    const riskRun = await createRiskRun({
      organizationId,
      scopeType: "ENTERPRISE",
      scopeId: organizationId,
      asOf,
      triggeredBy: triggeredBy ?? "system",
      triggerReason: triggerReason ?? "MANUAL",
      riskEngineVersion: engineVersion,
      parameterVersion: PARAMETER_VERSION,
      modelBundleVersion: MODEL_BUNDLE_VERSION,
      featureSetVersion: FEATURE_SET_VERSION,
      simulationConfigVersion: simulationVersion,
      inputStateHash: evidenceCtx.inputStateHash,
      coverageState: evidenceCtx.coverageState,
    });

    await appendRiskAuditEvent({
      organizationId,
      riskRunId: riskRun.id,
      actor: triggeredBy ?? "system",
      action: "RISK_RUN_CREATED",
      inputStateHash: evidenceCtx.inputStateHash,
    });

    try {
      // ③ Mark RUNNING
      await markRiskRunRunning(riskRun.id);

      // ④ Baseline calculator — still supplies recommendations, control
      //    optimisation, scenario pricing and the per-asset rows the UI renders.
      const legacyResult = await cyberRiskQuantificationService.getEnterpriseRisk(
        organizationId,
        budgetInr
      );

      // ⑤ Authoritative numbers: Monte Carlo Risk Engine v2 (v1 = legacy path).
      let engineResult: RiskEngineResult | null = null;
      if (useMonteCarlo) {
        const context = await buildRiskCalculationContext({
          organizationId,
          scopeType: "ENTERPRISE",
          scopeId: organizationId,
          asOf,
          inputStateHash: evidenceCtx.inputStateHash,
          simulationOverrides: {
            ...(opts.simulationCount === undefined ? {} : { simulationCount: opts.simulationCount }),
            ...(opts.seed === undefined ? {} : { seed: opts.seed }),
          },
        });
        engineResult = await calculateRisk(context);
      }

      const totals = {
        totalFinancialExposureInr: engineResult
          ? Math.round(engineResult.financialExposure)
          : legacyResult.totals.totalFinancialExposureInr,
        expectedAnnualLossInr: engineResult
          ? Math.round(engineResult.eal)
          : legacyResult.totals.expectedAnnualLossInr,
        valueAtRisk95Inr: engineResult
          ? Math.round(engineResult.var95)
          : legacyResult.totals.valueAtRisk95Inr,
        averageLikelihood: engineResult
          ? averageModelledProbability(engineResult)
          : legacyResult.totals.averageLikelihood,
        controlEffectiveness: engineResult
          ? engineResult.controlEffectiveness
          : legacyResult.totals.controlEffectiveness,
      };

      const riskScore = engineResult
        ? engineResult.riskScore
        : this.computeRiskScore(legacyResult);

      // ⑥ Mark SUCCEEDED + capture result hash.  The v2 path hashes the exact
      //    payload the engine hashed, so both fingerprints agree by construction.
      const succeededRun = await markRiskRunSucceeded(
        riskRun.id,
        engineResult ? canonicalResultPayload(engineResult) : legacyResult
      );
      const calculationHash = computeCalculationHashForRun(succeededRun);

      await appendRiskAuditEvent({
        organizationId,
        riskRunId: riskRun.id,
        actor: triggeredBy ?? "system",
        action: "RISK_RUN_COMPLETED",
        inputStateHash: succeededRun.inputStateHash,
        resultHash: succeededRun.resultHash ?? undefined,
        metadata: { calculationHash, triggerReason: triggerReason ?? "MANUAL" },
      });

      // ⑦ Persist canonical RiskAssessment (immutable, append-only)
      const assessment = await persistRiskAssessment(riskRun, evidenceCtx, {
        totalFinancialExposureInr: BigInt(totals.totalFinancialExposureInr),
        expectedAnnualLossInr: BigInt(totals.expectedAnnualLossInr),
        valueAtRisk95Inr: BigInt(totals.valueAtRisk95Inr),
        averageLikelihood: totals.averageLikelihood,
        controlEffectiveness: totals.controlEffectiveness,
        riskScore,
        drivers: engineResult ? engineResult.drivers : null,
        topDrivers: engineResult
          ? engineResult.drivers.slice(0, 5).map((driver) => driver.name)
          : legacyResult.topRiskDrivers,
        assumptions: engineResult
          ? {
              ...legacyResult.assumptions,
              engine: engineResult.versions,
              simulation: engineResult.simulation,
              frequency: engineResult.frequencySummary.byEventClass,
              uncertainty: engineResult.uncertainty,
            }
          : legacyResult.assumptions,
      });

      await appendRiskAuditEvent({
        organizationId,
        riskRunId: riskRun.id,
        actor: triggeredBy ?? "system",
        action: "RISK_ASSESSMENT_PERSISTED",
        inputStateHash: evidenceCtx.inputStateHash,
        resultHash: assessment.resultHash ?? undefined,
      });

      // Mark older succeeded runs for this org as STALE
      await staleOlderRuns(organizationId, riskRun.id);

      // ⑧ Return the compatibility payload with authoritative totals, the v2
      //    engine block, and the provenance envelope.
      return {
        ...legacyResult,
        totals,
        topRiskDrivers: engineResult
          ? engineResult.drivers.slice(0, 5).map((driver) => driver.name)
          : legacyResult.topRiskDrivers,
        ...(engineResult ? { riskEngineV2: engineResult } : {}),
        // ── P1 provenance additions ──────────────────────────────────────
        _provenance: buildProvenanceEnvelope({
          riskRun: succeededRun,
          assessment,
          coverageState: evidenceCtx.coverageState,
          calculationHash,
          riskScore,
        }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      await markRiskRunFailed(riskRun.id, "CALCULATION_ERROR", message);
      await appendRiskAuditEvent({
        organizationId,
        riskRunId: riskRun.id,
        actor: triggeredBy ?? "system",
        action: "RISK_RUN_FAILED",
        inputStateHash: evidenceCtx.inputStateHash,
        metadata: { errorMessage: message },
      });
      throw err;
    }
  }

  /**
   * Returns the latest succeeded risk assessment for an org, without
   * triggering a new calculation.  Used by GET /api/v1/risk/current.
   */
  async getCurrentAssessment(organizationId: string) {
    return getLatestSucceededRun(organizationId);
  }

  /**
   * Fetch a single historical assessment, strictly tenant-scoped.
   * Returns null when it does not exist or belongs to another organisation.
   */
  async getAssessment(organizationId: string, assessmentId: string) {
    return getAssessmentById(organizationId, assessmentId);
  }

  /** Assessment history for the organisation, newest first. */
  async listAssessmentHistory(organizationId: string, take = 20) {
    return listAssessments(organizationId, take);
  }

  /**
   * Legacy v1 0-100 index.  Only used when the caller explicitly selects the
   * `deterministic-baseline-v0` engine; the v2 path scores through
   * `riskScore.service.ts` with versioned parameters.
   */
  private computeRiskScore(legacyResult: {
    totals: { averageLikelihood: number; controlEffectiveness: number };
  }): number {
    const likelihoodComponent = Math.min(1, legacyResult.totals.averageLikelihood / 0.7);
    const controlGap = 1 - Math.min(1, legacyResult.totals.controlEffectiveness);
    const raw = 0.6 * likelihoodComponent + 0.4 * controlGap;
    return Math.round(Math.min(100, Math.max(0, raw * 100)));
  }
}

/**
 * Mean modelled horizon probability across event classes.
 *
 * Feeds the existing `averageLikelihood` column so historical rows stay
 * comparable.  The product score itself uses the *maximum* class probability
 * (a portfolio is as exposed as its most likely loss mode), which is why the
 * two figures are intentionally different.
 */
function averageModelledProbability(engineResult: RiskEngineResult): number {
  const classes = engineResult.frequencySummary.byEventClass;
  if (classes.length === 0) return 0;
  return classes.reduce((sum, entry) => sum + entry.horizonProbability, 0) / classes.length;
}

export const riskAssessmentService = new RiskAssessmentService();
