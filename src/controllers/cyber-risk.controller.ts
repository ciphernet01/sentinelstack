/**
 * Cyber-Risk Controller — P1 update
 *
 * Existing handlers are preserved unchanged for backward compatibility.
 * The existing service calls are re-routed through the new RiskAssessmentService
 * façade so every response now carries P1 provenance metadata.
 *
 * New P1 endpoints:
 *   POST /api/v1/risk/recalculate        — queues + runs a calculation synchronously in P1
 *   GET  /api/v1/risk/current            — returns the latest succeeded assessment metadata
 *   GET  /api/v1/risk/assessments        — assessment history for the organisation
 *   GET  /api/v1/risk/assessments/:id    — a single historical assessment (tenant-scoped)
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { cyberRiskQuantificationService } from '../services/cyberRiskQuantification.service';
import {
  RISK_ENGINE_VERSION,
  RISK_ENGINE_VERSION_V1,
  riskAssessmentService,
  type SupportedRiskEngineVersion,
} from '../services/risk/riskAssessment.service';
import {
  resolveOrganizationIdStrict,
  resolveOrganizationIdWithAdminOverride,
} from '../services/risk/tenantScope';

const DEFAULT_BUDGET_INR = 10_000_000;

/**
 * Resolve organisation ID from request for the LEGACY endpoints.
 * Admin can cross-query organisations; all other users are scoped to their own.
 *
 * NOTE (P1.9): the PS 26105 v1 endpoints use resolveOrganizationIdStrict and
 * deliberately do NOT expose this query-param cross-org pattern.
 */
const getOrganizationId = resolveOrganizationIdWithAdminOverride;

class CyberRiskController {
  // ─── Legacy endpoints (unchanged API surface) ───────────────────────────────

  async getEnterpriseRisk(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrganizationId(req);
      if (!req.user?.id) return res.status(401).json({ message: 'User not found.' });
      if (!organizationId) return res.status(403).json({ message: 'Organization context missing.' });

      const budgetInr = Number.parseInt(String(req.query.budgetInr ?? DEFAULT_BUDGET_INR), 10);

      // Route through the new façade — response is backward-compatible + adds _provenance
      const risk = await riskAssessmentService.runEnterpriseRisk({
        organizationId,
        budgetInr: Number.isFinite(budgetInr) && budgetInr > 0 ? budgetInr : DEFAULT_BUDGET_INR,
        triggeredBy: req.user.id,
        triggerReason: 'MANUAL',
      });

      res.status(200).json(risk);
    } catch (error) {
      next(error);
    }
  }

  async createSnapshot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrganizationId(req);
      if (!req.user?.id) return res.status(401).json({ message: 'User not found.' });
      if (!organizationId) return res.status(403).json({ message: 'Organization context missing.' });

      const budgetInr = Number.parseInt(String(req.body?.budgetInr ?? DEFAULT_BUDGET_INR), 10);
      const snapshot = await cyberRiskQuantificationService.persistSnapshot(
        organizationId,
        Number.isFinite(budgetInr) && budgetInr > 0 ? budgetInr : DEFAULT_BUDGET_INR,
      );

      res.status(201).json({
        id: snapshot.id,
        computedAt: snapshot.computedAt,
        expectedAnnualLossInr: Number(snapshot.expectedAnnualLossInr),
        totalFinancialExposureInr: Number(snapshot.totalFinancialExposureInr),
        valueAtRisk95Inr: Number(snapshot.valueAtRisk95Inr),
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── PS 26105 v1 endpoints ────────────────────────────────────────────────

  /**
   * POST /api/v1/risk/recalculate
   *
   * In P1 the calculation runs synchronously and returns 200 when done.
   * P2 will move to a proper async job queue and return 202 Accepted.
   */
  async recalculate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = resolveOrganizationIdStrict(req);
      if (!req.user?.id) return res.status(401).json({ message: 'User not found.' });
      if (!organizationId) return res.status(403).json({ message: 'Organization context missing.' });

      const budgetInr = Number.parseInt(String(req.body?.budgetInr ?? DEFAULT_BUDGET_INR), 10);

      // Engine selection is explicit and validated: callers can compare against,
      // or roll back to, the deterministic baseline without a deploy.
      const requestedEngine = String(req.body?.riskEngineVersion ?? '').trim();
      if (
        requestedEngine &&
        requestedEngine !== RISK_ENGINE_VERSION &&
        requestedEngine !== RISK_ENGINE_VERSION_V1
      ) {
        return res.status(400).json({
          message: `Unsupported riskEngineVersion. Use '${RISK_ENGINE_VERSION}' or '${RISK_ENGINE_VERSION_V1}'.`,
        });
      }

      const result = await riskAssessmentService.runEnterpriseRisk({
        organizationId,
        budgetInr: Number.isFinite(budgetInr) && budgetInr > 0 ? budgetInr : DEFAULT_BUDGET_INR,
        triggeredBy: req.user.id,
        triggerReason: 'MANUAL',
        ...(requestedEngine
          ? { riskEngineVersion: requestedEngine as SupportedRiskEngineVersion }
          : {}),
      });

      const engine = result.riskEngineV2;

      res.status(200).json({
        data: {
          riskRunId: result._provenance.riskRunId,
          assessmentId: result._provenance.assessmentId,
          status: 'SUCCEEDED',
          computedAt: result._provenance.computedAt,
          riskEngineVersion: result._provenance.riskEngineVersion,
          parameterVersion: result._provenance.parameterVersion,
          modelBundleVersion: result._provenance.modelBundleVersion,
          simulationConfigVersion: result._provenance.simulationConfigVersion,
          inputStateHash: result._provenance.inputStateHash,
          resultHash: result._provenance.resultHash,
          calculationHash: result._provenance.calculationHash,
          coverageState: result._provenance.coverageState,
          riskScore: result._provenance.riskScore,
          // ── P2 authoritative figures (Monte Carlo engine) ────────────────
          totals: result.totals,
          riskScoreComponents: engine?.riskScoreComponents ?? null,
          lossDistribution: engine?.lossDistributionSummary ?? null,
          frequency: engine?.frequencySummary.byEventClass ?? [],
          drivers: engine?.drivers ?? [],
          uncertainty: engine?.uncertainty ?? null,
          simulation: engine?.simulation ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/risk/current
   *
   * Returns the latest succeeded RiskRun + its first RiskAssessment for the
   * authenticated organisation.  Does NOT trigger a new calculation.
   */
  async getCurrent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = resolveOrganizationIdStrict(req);
      if (!req.user?.id) return res.status(401).json({ message: 'User not found.' });
      if (!organizationId) return res.status(403).json({ message: 'Organization context missing.' });

      const run = await riskAssessmentService.getCurrentAssessment(organizationId);

      if (!run) {
        return res.status(404).json({
          message: 'No completed risk assessment found. Trigger a calculation first.',
        });
      }

      const assessment = run.assessments[0] ?? null;

      res.status(200).json({
        data: {
          riskRunId: run.id,
          status: run.status,
          computedAt: run.completedAt,
          asOf: run.asOf,
          riskEngineVersion: run.riskEngineVersion,
          parameterVersion: run.parameterVersion,
          modelBundleVersion: run.modelBundleVersion,
          inputStateHash: run.inputStateHash,
          resultHash: run.resultHash,
          coverageState: run.coverageState,
          assessment: assessment
            ? {
                id: assessment.id,
                totalFinancialExposureInr: Number(assessment.totalFinancialExposureInr),
                expectedAnnualLossInr: Number(assessment.expectedAnnualLossInr),
                valueAtRisk95Inr: Number(assessment.valueAtRisk95Inr),
                averageLikelihood: assessment.averageLikelihood,
                controlEffectiveness: assessment.controlEffectiveness,
                riskScore: assessment.riskScore,
                topDrivers: assessment.topDrivers,
                assumptions: assessment.assumptions,
              }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/risk/assessments/:id
   *
   * Returns a single immutable RiskAssessment + its RiskRun provenance.
   * Strictly tenant-scoped: an assessment belonging to another organisation
   * returns 404 (never 403) so the existence of foreign records is not leaked.
   */
  async getAssessment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = resolveOrganizationIdStrict(req);
      if (!req.user?.id) return res.status(401).json({ message: 'User not found.' });
      if (!organizationId) return res.status(403).json({ message: 'Organization context missing.' });

      const { id } = req.params;

      const assessment = await riskAssessmentService.getAssessment(organizationId, id);

      if (!assessment) {
        return res.status(404).json({ message: 'Risk assessment not found.' });
      }

      res.status(200).json({
        data: {
          id: assessment.id,
          riskRunId: assessment.riskRunId,
          organizationId: assessment.organizationId,
          scopeType: assessment.scopeType,
          scopeId: assessment.scopeId,
          computedAt: assessment.computedAt,
          asOf: assessment.asOf,
          totalFinancialExposureInr: Number(assessment.totalFinancialExposureInr),
          expectedAnnualLossInr: Number(assessment.expectedAnnualLossInr),
          valueAtRisk95Inr: Number(assessment.valueAtRisk95Inr),
          averageLikelihood: assessment.averageLikelihood,
          controlEffectiveness: assessment.controlEffectiveness,
          riskScore: assessment.riskScore,
          drivers: assessment.drivers,
          topDrivers: assessment.topDrivers,
          assumptions: assessment.assumptions,
          provenance: {
            riskEngineVersion: assessment.riskEngineVersion,
            parameterVersion: assessment.parameterVersion,
            modelBundleVersion: assessment.modelBundleVersion,
            inputStateHash: assessment.inputStateHash,
            resultHash: assessment.resultHash,
            runStatus: assessment.riskRun?.status ?? null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/risk/assessments
   *
   * Returns recent assessment history for the authenticated organisation.
   */
  async listAssessments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = resolveOrganizationIdStrict(req);
      if (!req.user?.id) return res.status(401).json({ message: 'User not found.' });
      if (!organizationId) return res.status(403).json({ message: 'Organization context missing.' });

      const parsedLimit = Number.parseInt(String(req.query.limit ?? 20), 10);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;

      const assessments = await riskAssessmentService.listAssessmentHistory(organizationId, take);

      res.status(200).json({
        data: assessments.map((assessment) => ({
          id: assessment.id,
          riskRunId: assessment.riskRunId,
          scopeType: assessment.scopeType,
          scopeId: assessment.scopeId,
          computedAt: assessment.computedAt,
          asOf: assessment.asOf,
          expectedAnnualLossInr: Number(assessment.expectedAnnualLossInr),
          valueAtRisk95Inr: Number(assessment.valueAtRisk95Inr),
          riskScore: assessment.riskScore,
          riskEngineVersion: assessment.riskEngineVersion,
          inputStateHash: assessment.inputStateHash,
          resultHash: assessment.resultHash,
        })),
        pagination: { count: assessments.length, limit: take },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const cyberRiskController = new CyberRiskController();
