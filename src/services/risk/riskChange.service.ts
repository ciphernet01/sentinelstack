/**
 * P3 — Risk Change Attribution
 *
 * Answers "why did risk change?" (P3 spec §21) by comparing two authoritative
 * assessments from the same organisation.
 *
 * Two rules the implementation holds to:
 *   • Drivers are matched on `driverKey`, never on id or rank — both of which
 *     are run-specific. Without a stable key, every driver would look NEW.
 *   • A model or parameter version change is reported as its own category and
 *     is never folded into an environmental one. A model upgrade must not be
 *     reported as a cyber-control failure (spec §22).
 */

import { prisma } from "../../config/db";
import { RiskDomainError } from "./errors";
import type { DriverRecord } from "./riskAttribution.service";

export type DriverChangeType =
  | "NEW"
  | "REMOVED"
  | "INCREASED"
  | "DECREASED"
  | "UNCHANGED";

export interface MetricDelta {
  eal: number;
  var95: number;
  exposure: number;
  riskScore: number;
}

export interface DriverChange {
  driverKey: string;
  type: DriverRecord["type"];
  name: string;
  direction: string;
  changeType: DriverChangeType;
  previousContributionToEal: number | null;
  currentContributionToEal: number | null;
  contributionDelta: number | null;
  confidenceChanged: boolean;
}

export interface VersionChange {
  field: "riskEngineVersion" | "parameterVersion" | "modelBundleVersion" | "simulationConfigVersion" | "featureSetVersion";
  previous: string;
  current: string;
}

export interface RiskChangeReport {
  previousAssessmentId: string;
  currentAssessmentId: string;
  metricDeltas: MetricDelta;
  driverChanges: DriverChange[];
  modelChanges: VersionChange[];
  parameterChanges: VersionChange[];
  simulationChanges: VersionChange[];
  warnings: string[];
}

/** Below this, a change is noise from a re-run rather than a real movement. */
const CONTRIBUTION_EPSILON = 1;

export interface CompareAssessmentsInput {
  organizationId: string;
  currentAssessmentId: string;
  previousAssessmentId?: string;
}

/** Compare the current assessment against the previous one in the same scope. */
export async function compareAssessments(
  input: CompareAssessmentsInput
): Promise<RiskChangeReport> {
  const { organizationId, currentAssessmentId } = input;

  const current = await prisma.riskAssessment.findFirst({
    where: { id: currentAssessmentId, organizationId },
    select: {
      id: true,
      riskRunId: true,
      scopeType: true,
      scopeId: true,
      computedAt: true,
      expectedAnnualLossInr: true,
      valueAtRisk95Inr: true,
      totalFinancialExposureInr: true,
      riskScore: true,
    },
  });

  if (!current) {
    throw new RiskDomainError(
      "RISK_ASSESSMENT_NOT_FOUND",
      `RiskAssessment ${currentAssessmentId} was not found for this organisation.`,
      404
    );
  }

  const previous = input.previousAssessmentId
    ? await prisma.riskAssessment.findFirst({
        where: { id: input.previousAssessmentId, organizationId },
        select: {
          id: true,
          riskRunId: true,
          scopeType: true,
          scopeId: true,
          expectedAnnualLossInr: true,
          valueAtRisk95Inr: true,
          totalFinancialExposureInr: true,
          riskScore: true,
        },
      })
    : await findPreviousInScope(organizationId, current);

  if (!previous) {
    throw new RiskDomainError(
      "NO_PREVIOUS_ASSESSMENT",
      "No previous assessment exists in this scope, so risk change cannot be explained.",
      404
    );
  }

  if (previous.scopeType !== current.scopeType || previous.scopeId !== current.scopeId) {
    throw new RiskDomainError(
      "SCOPE_MISMATCH",
      "Assessments belong to different scopes; a change comparison would be misleading.",
      400
    );
  }

  const [previousDrivers, currentDrivers, previousRun, currentRun] = await Promise.all([
    prisma.riskDriver.findMany({
      where: { riskAssessmentId: previous.id, organizationId },
      select: {
        driverKey: true,
        type: true,
        name: true,
        direction: true,
        confidence: true,
        contributionToEal: true,
      },
    }),
    prisma.riskDriver.findMany({
      where: { riskAssessmentId: current.id, organizationId },
      select: {
        driverKey: true,
        type: true,
        name: true,
        direction: true,
        confidence: true,
        contributionToEal: true,
      },
    }),
    prisma.riskRun.findUnique({
      where: { id: previous.riskRunId },
      select: {
        riskEngineVersion: true,
        parameterVersion: true,
        modelBundleVersion: true,
        simulationConfigVersion: true,
        featureSetVersion: true,
      },
    }),
    prisma.riskRun.findUnique({
      where: { id: current.riskRunId },
      select: {
        riskEngineVersion: true,
        parameterVersion: true,
        modelBundleVersion: true,
        simulationConfigVersion: true,
        featureSetVersion: true,
      },
    }),
  ]);

  const warnings: string[] = [];
  const driverChanges = diffDrivers(previousDrivers, currentDrivers);

  if (previousDrivers.length === 0 || currentDrivers.length === 0) {
    warnings.push(
      "One of the assessments has no persisted driver rows, so driver-level change is partial. " +
        "This is expected for results produced before P3 attribution was enabled."
    );
  }

  const versions = collectVersionChanges(previousRun, currentRun);

  if (versions.modelChanges.length > 0 || versions.engineChanges.length > 0) {
    warnings.push(
      "The model or engine version changed between these runs. Driver deltas mix an " +
        "environmental change with a methodology change and must not be read as purely environmental."
    );
  }

  return {
    previousAssessmentId: previous.id,
    currentAssessmentId: current.id,
    metricDeltas: {
      eal: Number(current.expectedAnnualLossInr - previous.expectedAnnualLossInr),
      var95: Number(current.valueAtRisk95Inr - previous.valueAtRisk95Inr),
      exposure: Number(
        current.totalFinancialExposureInr - previous.totalFinancialExposureInr
      ),
      riskScore: (current.riskScore ?? 0) - (previous.riskScore ?? 0),
    },
    driverChanges,
    modelChanges: versions.modelChanges,
    parameterChanges: versions.parameterChanges,
    simulationChanges: versions.simulationChanges,
    warnings,
  };
}

type DriverRow = {
  driverKey: string;
  type: string;
  name: string;
  direction: string;
  confidence: string;
  contributionToEal: number | null;
};

type RunVersions = {
  riskEngineVersion: string;
  parameterVersion: string;
  modelBundleVersion: string;
  simulationConfigVersion: string;
  featureSetVersion: string;
} | null;

/** The most recent earlier assessment in the same scope. */
async function findPreviousInScope(
  organizationId: string,
  current: { scopeType: string; scopeId: string; computedAt: Date; id: string }
) {
  return prisma.riskAssessment.findFirst({
    where: {
      organizationId,
      scopeType: current.scopeType,
      scopeId: current.scopeId,
      computedAt: { lt: current.computedAt },
      id: { not: current.id },
    },
    orderBy: { computedAt: "desc" },
    select: {
      id: true,
      riskRunId: true,
      scopeType: true,
      scopeId: true,
      expectedAnnualLossInr: true,
      valueAtRisk95Inr: true,
      totalFinancialExposureInr: true,
      riskScore: true,
    },
  });
}

/**
 * Match drivers on `driverKey` and classify the movement.
 *
 * UNCHANGED is decided on contribution *and* confidence, so a driver whose
 * evidence went stale but whose number held steady is still reported — the
 * confidence drop is material to a reviewer even when the rupee figure is not.
 */
export function diffDrivers(previous: DriverRow[], current: DriverRow[]): DriverChange[] {
  const previousByKey = new Map(previous.map((driver) => [driver.driverKey, driver]));
  const currentByKey = new Map(current.map((driver) => [driver.driverKey, driver]));
  const changes: DriverChange[] = [];

  for (const [key, next] of currentByKey) {
    const before = previousByKey.get(key);

    if (!before) {
      changes.push({
        driverKey: key,
        type: next.type as DriverChange["type"],
        name: next.name,
        direction: next.direction,
        changeType: "NEW",
        previousContributionToEal: null,
        currentContributionToEal: next.contributionToEal,
        contributionDelta: next.contributionToEal,
        confidenceChanged: false,
      });
      continue;
    }

    const previousValue = before.contributionToEal;
    const currentValue = next.contributionToEal;
    const delta =
      previousValue === null || currentValue === null ? null : currentValue - previousValue;

    const confidenceChanged = before.confidence !== next.confidence;
    const moved = delta !== null && Math.abs(delta) > CONTRIBUTION_EPSILON;

    changes.push({
      driverKey: key,
      type: next.type as DriverChange["type"],
      name: next.name,
      direction: next.direction,
      changeType: moved ? (delta! > 0 ? "INCREASED" : "DECREASED") : "UNCHANGED",
      previousContributionToEal: previousValue,
      currentContributionToEal: currentValue,
      contributionDelta: delta,
      confidenceChanged,
    });
  }

  for (const [key, before] of previousByKey) {
    if (currentByKey.has(key)) continue;
    changes.push({
      driverKey: key,
      type: before.type as DriverChange["type"],
      name: before.name,
      direction: before.direction,
      changeType: "REMOVED",
      previousContributionToEal: before.contributionToEal,
      currentContributionToEal: null,
      contributionDelta:
        before.contributionToEal === null ? null : -before.contributionToEal,
      confidenceChanged: false,
    });
  }

  return changes;
}

/**
 * Separate model, parameter and simulation version drift.
 *
 * These are reported as distinct categories so a methodology change is never
 * misread as an environmental one (P3 spec §22).
 */
export function collectVersionChanges(
  previous: RunVersions,
  current: RunVersions
): {
  modelChanges: VersionChange[];
  parameterChanges: VersionChange[];
  simulationChanges: VersionChange[];
  engineChanges: VersionChange[];
} {
  const empty = {
    modelChanges: [] as VersionChange[],
    parameterChanges: [] as VersionChange[],
    simulationChanges: [] as VersionChange[],
    engineChanges: [] as VersionChange[],
  };

  if (!previous || !current) return empty;

  const push = (
    bucket: VersionChange[],
    field: VersionChange["field"],
    before: string,
    after: string
  ) => {
    if (before !== after) bucket.push({ field, previous: before, current: after });
  };

  // An engine version change is also a model change for reporting purposes.
  push(empty.modelChanges, "modelBundleVersion", previous.modelBundleVersion, current.modelBundleVersion);
  push(empty.modelChanges, "riskEngineVersion", previous.riskEngineVersion, current.riskEngineVersion);
  push(empty.parameterChanges, "parameterVersion", previous.parameterVersion, current.parameterVersion);
  push(empty.simulationChanges, "simulationConfigVersion", previous.simulationConfigVersion, current.simulationConfigVersion);
  push(empty.simulationChanges, "featureSetVersion", previous.featureSetVersion, current.featureSetVersion);

  return empty;
}
