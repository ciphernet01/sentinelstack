/**
 * P3 — Risk Driver & Evidence API controller
 *
 * Exposes the normalized driver graph as typed resources (P3 spec §24).
 *
 * Tenancy is structural, not conventional: organisation scope is taken from the
 * authenticated session via `resolveOrganizationIdStrict` and is never read
 * from the query string, so a caller cannot ask for another tenant's drivers.
 * A driver id from another organisation is refused with 404, not 403 — the
 * existence of the resource is itself not disclosed.
 *
 * Response wording is deliberately modelled, never causal: these are
 * "contributions to modeled risk", not realised losses (spec §47).
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { resolveOrganizationIdStrict } from '../services/risk/tenantScope';
import {
  annotateDriverReview,
  getEvidenceRecord,
  getRiskDriver,
  listDriverEvidence,
  listRiskDrivers,
  type ListDriversFilters,
} from '../services/risk/driverStore.service';
import { compareAssessments } from '../services/risk/riskChange.service';

const DRIVER_TYPES = [
  'VULNERABILITY',
  'EXPOSURE',
  'THREAT',
  'CONTROL',
  'DEPENDENCY',
  'BUSINESS_IMPACT',
  'ASSET_CRITICALITY',
  'SERVICE_CRITICALITY',
  'TELEMETRY_SIGNAL',
  'MODEL_SIGNAL',
  'DATA_COVERAGE',
  'OTHER',
] as const;

const DIRECTIONS = ['INCREASES_RISK', 'REDUCES_RISK', 'LIMITS_CONFIDENCE'] as const;
const REVIEW_STATUSES = ['UNREVIEWED', 'REVIEWED', 'DISPUTED', 'ACCEPTED', 'REJECTED'] as const;

function requireOrganization(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ message: 'User not found.' });
    return null;
  }

  const organizationId = resolveOrganizationIdStrict(req);
  if (!organizationId) {
    res.status(403).json({ message: 'Organization context missing.' });
    return null;
  }

  return organizationId;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

class RiskDriverController {
  /**
   * GET /api/v1/risk/drivers
   *
   * Filters are allow-listed rather than passed through: an unknown driver type
   * is a 400, not a silently empty result that looks like "no risk".
   */
  async listDrivers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const query = req.query as Record<string, unknown>;

      const type = query.driver_type;
      if (type !== undefined) {
        const parsed = oneOf(type, DRIVER_TYPES);
        if (!parsed) {
          return res.status(400).json({
            message: `Unsupported driver_type. Expected one of: ${DRIVER_TYPES.join(', ')}.`,
          });
        }
      }

      const direction = oneOf(query.direction, DIRECTIONS);
      if (query.direction !== undefined && !direction) {
        return res.status(400).json({
          message: `Unsupported direction. Expected one of: ${DIRECTIONS.join(', ')}.`,
        });
      }

      const reviewStatus = oneOf(query.review_status, REVIEW_STATUSES);
      if (query.review_status !== undefined && !reviewStatus) {
        return res.status(400).json({
          message: `Unsupported review_status. Expected one of: ${REVIEW_STATUSES.join(', ')}.`,
        });
      }

      const minContribution =
        query.min_contribution !== undefined ? Number(query.min_contribution) : undefined;
      if (minContribution !== undefined && !Number.isFinite(minContribution)) {
        return res.status(400).json({ message: 'min_contribution must be a number.' });
      }

      const limit = query.limit !== undefined ? Number(query.limit) : 50;
      if (!Number.isFinite(limit) || limit <= 0) {
        return res.status(400).json({ message: 'limit must be a positive number.' });
      }

      const filters: ListDriversFilters = {
        organizationId,
        ...(query.risk_assessment_id
          ? { riskAssessmentId: String(query.risk_assessment_id) }
          : {}),
        ...(type ? { type: oneOf(type, DRIVER_TYPES)! } : {}),
        ...(direction ? { direction } : {}),
        ...(reviewStatus ? { reviewStatus } : {}),
        ...(minContribution !== undefined ? { minContributionToEal: minContribution } : {}),
        limit,
      };

      const drivers = await listRiskDrivers(filters);

      res.status(200).json({
        data: drivers.map((driver) => ({
          id: driver.id,
          riskAssessmentId: driver.riskAssessmentId,
          riskRunId: driver.riskRunId,
          driverKey: driver.driverKey,
          type: driver.type,
          entityType: driver.entityType,
          entityId: driver.entityId,
          name: driver.name,
          attributionMethod: driver.attributionMethod,
          attributionVersion: driver.attributionVersion,
          // Named per metric so a rupee figure and a 0-100 index figure are
          // never read as the same kind of number.
          contributionToEal: driver.contributionToEal,
          contributionToVar95: driver.contributionToVar95,
          contributionToVar99: driver.contributionToVar99,
          contributionToRiskScore: driver.contributionToRiskScore,
          direction: driver.direction,
          confidence: driver.confidence,
          reviewStatus: driver.reviewStatus,
          rank: driver.rank,
          attributionHash: driver.attributionHash,
          evidenceCount: driver.evidenceLinks.length,
          createdAt: driver.createdAt,
        })),
        meta: { count: drivers.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/risk/drivers/:driverId
   *
   * The full drill-down: driver, evidence, the assessment it explains, and the
   * run that produced it (spec §23 governance layer).
   */
  async getDriver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const { driverId } = req.params;
      const driver = await getRiskDriver(organizationId, driverId);
      const evidence = await listDriverEvidence(organizationId, driverId, driver.riskRun.asOf);

      res.status(200).json({
        data: {
          id: driver.id,
          riskAssessmentId: driver.riskAssessmentId,
          riskRunId: driver.riskRunId,
          driverKey: driver.driverKey,
          type: driver.type,
          entityType: driver.entityType,
          entityId: driver.entityId,
          name: driver.name,
          description: driver.description,
          attributionMethod: driver.attributionMethod,
          attributionVersion: driver.attributionVersion,
          contributionToEal: driver.contributionToEal,
          contributionToVar95: driver.contributionToVar95,
          contributionToVar99: driver.contributionToVar99,
          contributionToRiskScore: driver.contributionToRiskScore,
          direction: driver.direction,
          confidence: driver.confidence,
          rank: driver.rank,
          attributionHash: driver.attributionHash,
          metadata: driver.metadata,
          review: {
            status: driver.reviewStatus,
            reviewedById: driver.reviewedById,
            reviewedAt: driver.reviewedAt,
            rationale: driver.reviewRationale,
          },
          evidence: evidence.map((item) => ({
            id: item.id,
            sourceType: item.sourceType,
            sourceRecordId: item.sourceRecordId,
            canonicalEntityType: item.canonicalEntityType,
            canonicalEntityId: item.canonicalEntityId,
            relationshipType: item.relationshipType,
            reliability: item.reliability,
            quality: item.quality,
            observedAt: item.observedAt,
            ingestedAt: item.ingestedAt,
            sourceVersion: item.sourceVersion,
            evidenceHash: item.evidenceHash,
            // Age is relative to the run's asOf, so a historical driver keeps
            // the freshness it had at calculation time.
            ageDays: item.ageDays,
            metadata: item.metadata,
          })),
          calculation: {
            assessment: driver.riskAssessment,
            run: driver.riskRun,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/risk/evidence/:evidenceId
   *
   * Raw source payloads stay behind their own controls; this returns the
   * reference and its lineage, not the underlying sensitive record.
   */
  async getEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const { evidenceId } = req.params;
      const record = await getEvidenceRecord(organizationId, evidenceId);

      res.status(200).json({
        data: {
          id: record.id,
          sourceType: record.sourceType,
          sourceRecordId: record.sourceRecordId,
          canonicalEntityType: record.canonicalEntityType,
          canonicalEntityId: record.canonicalEntityId,
          observedAt: record.observedAt,
          collectedAt: record.collectedAt,
          ingestedAt: record.ingestedAt,
          sourceVersion: record.sourceVersion,
          evidenceHash: record.evidenceHash,
          reliability: record.reliability,
          quality: record.quality,
          metadata: record.metadata,
          citedBy: record.driverLinks.map((link) => ({
            driverId: link.riskDriverId,
            relationshipType: link.relationshipType,
            driverName: link.riskDriver?.name,
            driverType: link.riskDriver?.type,
            driverRank: link.riskDriver?.rank,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/risk/assessments/:assessmentId/changes
   *
   * Explains *why risk changed*, not just where it stands (spec §21). Compares
   * against the previous assessment in the same scope unless one is named.
   */
  async getAssessmentChanges(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const { assessmentId } = req.params;
      const previousAssessmentId = req.query.previous_assessment_id
        ? String(req.query.previous_assessment_id)
        : undefined;

      const report = await compareAssessments({
        organizationId,
        currentAssessmentId: assessmentId,
        ...(previousAssessmentId ? { previousAssessmentId } : {}),
      });

      res.status(200).json({
        data: {
          previousAssessmentId: report.previousAssessmentId,
          currentAssessmentId: report.currentAssessmentId,
          metricDeltas: report.metricDeltas,
          driverChanges: report.driverChanges,
          modelChanges: report.modelChanges,
          parameterChanges: report.parameterChanges,
          simulationChanges: report.simulationChanges,
          warnings: report.warnings,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/risk/drivers/:driverId/review
   *
   * Records a human governance annotation. This never alters the model
   * attribution — the contribution, direction, confidence and attribution hash
   * are untouched, and only the review columns move.
   */
  async reviewDriver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;
      if (!req.user?.id) return res.status(401).json({ message: 'User not found.' });

      const { driverId } = req.params;
      const reviewStatus = oneOf(req.body?.reviewStatus, REVIEW_STATUSES);

      if (!reviewStatus) {
        return res.status(400).json({
          message: `reviewStatus is required. Expected one of: ${REVIEW_STATUSES.join(', ')}.`,
        });
      }

      const updated = await annotateDriverReview({
        organizationId,
        driverId,
        reviewStatus,
        actor: req.user.id,
        rationale: typeof req.body?.rationale === 'string' ? req.body.rationale : undefined,
      });

      res.status(200).json({
        data: {
          id: updated.id,
          reviewStatus: updated.reviewStatus,
          reviewedById: updated.reviewedById,
          reviewedAt: updated.reviewedAt,
          reviewRationale: updated.reviewRationale,
          // Echoed so a caller can verify the model attribution did not move.
          attributionHash: updated.attributionHash,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const riskDriverController = new RiskDriverController();
