/**
 * P4 — Scenario API controller
 *
 * Exposes the what-if engine as typed resources (P4 spec §51-59).
 *
 * Tenancy is structural: organisation scope comes from the authenticated
 * session and is never read from the request body or query string, so a caller
 * cannot run a scenario against another organisation's baseline.
 *
 * Wording is modelled throughout. A run reports a *modelled* change against a
 * named baseline, never a guaranteed saving (spec §66).
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { resolveOrganizationIdStrict } from '../services/risk/tenantScope';
import { RiskDomainError } from '../services/risk/errors';
import {
  compareScenarioRuns,
  createScenario,
  getScenario,
  listScenarios,
  runPersistedScenario,
  validateScenario,
} from '../services/scenario/scenarioStore.service';
import {
  buildInvestmentOutcome,
  normaliseScenarioCost,
  type CostBasis,
  type CostSemantics,
  type ScenarioCostInput,
} from '../services/scenario/scenarioCost.service';
import type {
  ScenarioChangeType,
  ScenarioChange,
} from '../services/scenario/scenarioState.service';

const SCENARIO_TYPES = [
  'CONTROL',
  'VULNERABILITY_REMEDIATION',
  'EXPOSURE',
  'SEGMENTATION',
  'IDENTITY',
  'ENDPOINT',
  'CLOUD_HARDENING',
  'THREAT_RESPONSE',
  'BUSINESS_CONTINUITY',
  'ASSET_CHANGE',
  'DEPENDENCY',
  'INVESTMENT',
  'COMBINED',
  'CUSTOM',
] as const;

const TARGET_TYPES = [
  'ASSET',
  'SERVICE',
  'VULNERABILITY',
  'CONTROL',
  'ASSET_CONTROL',
  'DEPENDENCY',
  'BUSINESS_UNIT',
  'THREAT_SIGNAL',
  'BUSINESS_PARAMETER',
] as const;

const OPERATIONS = [
  'SET', 'INCREASE', 'DECREASE', 'ENABLE', 'DISABLE', 'ADD', 'REMOVE',
  'PATCH', 'UNPATCH', 'ISOLATE', 'EXPOSE', 'UNEXPOSE', 'REASSIGN', 'REPLACE',
] as const;

const COST_SEMANTICS = [
  'CAPEX', 'OPEX', 'ONE_TIME', 'ANNUAL', 'MONTHLY',
  'LICENSE', 'IMPLEMENTATION', 'PERSONNEL', 'SERVICE_PROVIDER',
] as const;

const COST_BASES = [
  'INVESTMENT_OPTION',
  'IMPLEMENTATION_ESTIMATE',
  'USER_ASSUMPTION',
  'APPROVED_CATALOG',
] as const;

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

/**
 * Validate a structured cost breakdown.
 *
 * Returns `null` when absent, `"invalid"` when present but malformed, and the
 * typed cost input otherwise. A cost of zero across the board is invalid rather
 * than free: a scenario priced at zero would rank as infinitely good.
 */
function readStructuredCost(raw: unknown): ScenarioCostInput | 'invalid' | null {
  if (raw === undefined || raw === null) return null;

  const entry = (raw ?? {}) as Record<string, unknown>;
  const oneTime = entry.oneTime;
  const annual = entry.annual;
  const currency = entry.currency;
  const semantics = Array.isArray(entry.semantics) ? entry.semantics : [];
  const basis = oneOf(entry.basis, COST_BASES);

  const validAmount = (value: unknown): boolean =>
    value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);

  if (!validAmount(oneTime) || !validAmount(annual)) return 'invalid';
  if ((oneTime ?? 0) === 0 && (annual ?? 0) === 0) return 'invalid';
  if (typeof currency !== 'string' || !currency) return 'invalid';
  if (!basis) return 'invalid';

  const parsedSemantics = semantics
    .map((value) => oneOf(value, COST_SEMANTICS))
    .filter((value): value is CostSemantics => Boolean(value));

  if (parsedSemantics.length === 0) return 'invalid';

  return {
    ...(typeof oneTime === 'number' ? { oneTime } : {}),
    ...(typeof annual === 'number' ? { annual } : {}),
    currency,
    semantics: parsedSemantics,
    basis: basis as CostBasis,
    ...(typeof entry.sourceReference === 'string' ? { sourceReference: entry.sourceReference } : {}),
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

class ScenarioController {
  /** POST /api/v1/risk/scenarios */
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const body = req.body ?? {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const type = oneOf(body.type, SCENARIO_TYPES);
      const baselineId = body.baselineRiskAssessmentId;

      if (!name) return res.status(400).json({ message: 'name is required.' });
      if (!baselineId || typeof baselineId !== 'string') {
        return res.status(400).json({ message: 'baselineRiskAssessmentId is required.' });
      }
      if (!type) {
        return res.status(400).json({
          message: `Unsupported type. Expected one of: ${SCENARIO_TYPES.join(', ')}.`,
        });
      }

      const rawChanges = Array.isArray(body.changes) ? body.changes : [];
      const changes: Array<Omit<ScenarioChange, 'id'>> = [];

      for (const [index, raw] of rawChanges.entries()) {
        const entry = (raw ?? {}) as Record<string, unknown>;
        const targetType = oneOf(entry.targetType, TARGET_TYPES);
        const operation = oneOf(entry.operation, OPERATIONS);

        if (!targetType) {
          return res.status(400).json({
            message: `changes[${index}].targetType is invalid. Expected one of: ${TARGET_TYPES.join(', ')}.`,
          });
        }
        if (!operation) {
          return res.status(400).json({
            message: `changes[${index}].operation is invalid. Expected one of: ${OPERATIONS.join(', ')}.`,
          });
        }
        if (typeof entry.targetId !== 'string' || !entry.targetId) {
          return res.status(400).json({ message: `changes[${index}].targetId is required.` });
        }
        if (typeof entry.fieldPath !== 'string' || !entry.fieldPath) {
          return res.status(400).json({ message: `changes[${index}].fieldPath is required.` });
        }
        if (!Number.isInteger(entry.sequence)) {
          return res.status(400).json({ message: `changes[${index}].sequence must be an integer.` });
        }

        changes.push({
          targetType,
          targetId: entry.targetId,
          fieldPath: entry.fieldPath,
          operation,
          newValue: entry.newValue,
          sequence: entry.sequence as number,
          ...(typeof entry.reason === 'string' ? { reason: entry.reason } : {}),
          ...(typeof entry.sourceDriverId === 'string' ? { sourceDriverId: entry.sourceDriverId } : {}),
        });
      }

      const scenario = await createScenario({
        organizationId,
        name,
        type: type as ScenarioChangeType,
        baselineRiskAssessmentId: baselineId,
        createdById: req.user!.id,
        ...(typeof body.description === 'string' ? { description: body.description } : {}),
        changes,
      });

      res.status(201).json({ data: scenario });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/risk/scenarios */
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const take = req.query.limit !== undefined ? Number(req.query.limit) : undefined;

      if (take !== undefined && (!Number.isFinite(take) || take <= 0)) {
        return res.status(400).json({ message: 'limit must be a positive number.' });
      }

      const scenarios = await listScenarios(organizationId, {
        ...(status ? { status } : {}),
        ...(take === undefined ? {} : { take }),
      });

      res.status(200).json({ data: scenarios, meta: { count: scenarios.length } });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/risk/scenarios/:scenarioId */
  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const scenario = await getScenario(organizationId, req.params.scenarioId);

      res.status(200).json({
        data: {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          type: scenario.type,
          status: scenario.status,
          baselineRiskAssessmentId: scenario.baselineRiskAssessmentId,
          baselineRiskRunId: scenario.baselineRiskRunId,
          baselineInputStateHash: scenario.baselineInputStateHash,
          scenarioStateHash: scenario.scenarioStateHash,
          createdAt: scenario.createdAt,
          changes: scenario.changes.map((change) => ({
            id: change.id,
            targetType: change.targetType,
            targetId: change.targetId,
            fieldPath: change.fieldPath,
            operation: change.operation,
            newValue: change.newValue,
            sequence: change.sequence,
            reason: change.reason,
            sourceDriverId: change.sourceDriverId,
          })),
          runs: scenario.runs.map((run) => ({
            id: run.id,
            status: run.status,
            scenarioStateHash: run.scenarioStateHash,
            engineResultHash: run.engineResultHash,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/risk/scenarios/:scenarioId/validate */
  async validate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const result = await validateScenario(organizationId, req.params.scenarioId);

      res.status(200).json({
        data: {
          applicable: result.applicable,
          changeCount: result.changeCount,
          issues: result.issues.map((issue) => ({
            changeId: issue.changeId,
            code: issue.code,
            message: issue.message,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/risk/scenarios/:scenarioId/run
   *
   * Runs the what-if. This is the expensive operation, so it is admin-gated and
   * the response is the full modelled comparison, not a summary.
   */
  async run(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const cost = req.body?.cost;
      if (cost !== undefined && (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0)) {
        return res.status(400).json({ message: 'cost must be a non-negative number.' });
      }

      // Structured cost input is preferred: a single `cost` figure collapses
      // one-time and recurring spend, which the spec forbids (P4 §35).
      const structured = readStructuredCost(req.body?.costBreakdown);
      if (structured === 'invalid') {
        return res.status(400).json({
          message:
            'costBreakdown requires positive oneTime and/or annual amounts, a currency, ' +
            'at least one semantics entry, and a basis.',
        });
      }

      const outcome = await runPersistedScenario({
        organizationId,
        scenarioId: req.params.scenarioId,
        actor: req.user!.id,
        ...(cost === undefined ? {} : { cost }),
      });

      // Derive the investment economics from whatever cost was supplied.
      const normalised = structured
        ? normaliseScenarioCost(structured)
        : cost === undefined
          ? null
          : normaliseScenarioCost({
              oneTime: cost,
              currency: 'INR',
              semantics: ['IMPLEMENTATION'],
              basis: 'USER_ASSUMPTION',
            });

      const investment = normalised
        ? buildInvestmentOutcome({
            scenarioId: outcome.scenarioId,
            result: outcome.result,
            cost: normalised,
          })
        : null;

      res.status(200).json({
        data: {
          scenarioId: outcome.scenarioId,
          runId: outcome.runId,
          assessmentId: outcome.assessmentId,
          status: outcome.status,
          baseline: outcome.result.baseline,
          scenario: outcome.result.scenario,
          delta: outcome.result.delta,
          riskReduction: outcome.result.riskReduction,
          // Residual is what remains after the change, not the saving.
          residualRisk: outcome.result.residualRisk,
          cost: outcome.result.cost,
          // Modelled reduction, not a guaranteed saving.
          avoidedEal: outcome.result.avoidedEal,
          costBreakdown: normalised,
          // The shape P5 consumes. Present only when a cost was supplied.
          investment,
          scenarioStateHash: outcome.result.scenarioStateHash,
          calculationHash: outcome.result.scenarioResultHash,
          drivers: outcome.attribution?.drivers ?? [],
          versions: outcome.result.versions,
          uncertainty: outcome.result.uncertainty,
          warnings: [...outcome.warnings, ...(normalised?.warnings ?? [])],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/risk/scenarios/:scenarioId/compare */
  async compare(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = requireOrganization(req, res);
      if (!organizationId) return;

      const comparison = await compareScenarioRuns(organizationId, req.params.scenarioId);
      res.status(200).json({ data: comparison });
    } catch (error) {
      next(error);
    }
  }
}

export const scenarioController = new ScenarioController();
