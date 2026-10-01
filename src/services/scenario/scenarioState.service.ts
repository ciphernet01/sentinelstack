/**
 * P4 — Scenario state resolver (copy-on-write)
 *
 * Applies explicit, typed scenario changes to a baseline `RiskCalculationContext`
 * and produces a NEW context for the P2 engine to calculate against.
 *
 * The central guarantee is baseline immutability (P4 spec §5.1, §102): a scenario
 * may *read* production state but must never modify it. That is enforced
 * structurally here rather than by convention — the baseline objects are frozen
 * and every mutation produces a new object, so an accidental in-place write
 * throws in strict mode instead of silently corrupting the baseline.
 *
 * There is deliberately no bespoke financial logic in this file. A scenario is
 * just a set of declared state changes; the P2 engine does the mathematics
 * (spec §18, §31).
 */

import { hashRiskResult } from "../provenance/canonicalHash.service";
import { combineControlEffectiveness } from "../risk/riskContext.builder";
import type {
  BusinessImpactParameters,
  RiskAssetContext,
  RiskCalculationContext,
  RiskControlContext,
  RiskDependencyContext,
  RiskVulnerabilityContext,
} from "../risk/riskCalculationContext";

export const SCENARIO_STATE_VERSION = "scenario-state-v1";

export type ScenarioChangeType =
  | "CONTROL"
  | "VULNERABILITY_REMEDIATION"
  | "EXPOSURE"
  | "SEGMENTATION"
  | "IDENTITY"
  | "ENDPOINT"
  | "CLOUD_HARDENING"
  | "THREAT_RESPONSE"
  | "BUSINESS_CONTINUITY"
  | "ASSET_CHANGE"
  | "DEPENDENCY"
  | "INVESTMENT"
  | "COMBINED"
  | "CUSTOM";

export type ScenarioChangeOperation =
  | "SET"
  | "INCREASE"
  | "DECREASE"
  | "ENABLE"
  | "DISABLE"
  | "ADD"
  | "REMOVE"
  | "PATCH"
  | "UNPATCH"
  | "ISOLATE"
  | "EXPOSE"
  | "UNEXPOSE"
  | "REASSIGN"
  | "REPLACE";

export type ScenarioTargetType =
  | "ASSET"
  | "SERVICE"
  | "VULNERABILITY"
  | "CONTROL"
  | "ASSET_CONTROL"
  | "DEPENDENCY"
  | "BUSINESS_UNIT"
  | "THREAT_SIGNAL"
  | "BUSINESS_PARAMETER";

/** A declared, typed change. Never applied implicitly or inferred. */
export interface ScenarioChange {
  id: string;
  targetType: ScenarioTargetType;
  targetId: string;
  fieldPath: string;
  operation: ScenarioChangeOperation;
  newValue: unknown;
  /** Present when the change was derived from a P3 driver. */
  sourceDriverId?: string;
  investmentOptionId?: string;
  reason?: string;
  /** Deterministic ordering (spec §15). */
  sequence: number;
}

export interface ScenarioValidationIssue {
  changeId: string;
  code: string;
  message: string;
}

export interface ResolvedScenarioState {
  context: RiskCalculationContext;
  applied: ScenarioChange[];
  issues: ScenarioValidationIssue[];
  warnings: string[];
  /** SHA-256 over baseline identity + ordered changes + resolved state. */
  scenarioStateHash: string;
}

// ---------------------------------------------------------------------------
// Mutable field registry
// ---------------------------------------------------------------------------

/**
 * Which fields a scenario is allowed to change, and their expected type.
 *
 * A closed registry, not a reflection over the model. An unknown field path is a
 * validation error rather than a silent no-op (spec §16) — `SET
 * asset.nonexistentField` must fail loudly, not appear to succeed.
 */
interface FieldRule {
  kind: "boolean" | "number" | "enum" | "status";
  values?: readonly string[];
  min?: number;
  max?: number;
}

const ASSET_FIELDS: Record<string, FieldRule> = {
  internetExposed: { kind: "boolean" },
  criticality: { kind: "enum", values: ["LOW", "MODERATE", "HIGH", "CRITICAL"] },
  dataSensitivity: { kind: "number", min: 0, max: 10 },
  revenueDependencyInr: { kind: "number", min: 0 },
  downtimeCostPerHour: { kind: "number", min: 0 },
  maxTolerableDowntimeHours: { kind: "number", min: 0 },
  breachCost: { kind: "number", min: 0 },
  recoveryCost: { kind: "number", min: 0 },
  regulatoryExposure: { kind: "number", min: 0 },
  reputationCost: { kind: "number", min: 0 },
};

const CONTROL_FIELDS: Record<string, FieldRule> = {
  coverage: { kind: "number", min: 0, max: 1 },
  effectiveness: { kind: "number", min: 0, max: 1 },
  status: { kind: "enum", values: ["PLANNED", "PARTIAL", "IMPLEMENTED", "RETIRED"] },
};

const VULNERABILITY_FIELDS: Record<string, FieldRule> = {
  status: { kind: "enum", values: ["OPEN", "IN_PROGRESS", "RESOLVED", "PATCHED", "ACCEPTED"] },
  exploitAvailable: { kind: "boolean" },
  patchAvailable: { kind: "boolean" },
  epss: { kind: "number", min: 0, max: 1 },
  cvss: { kind: "number", min: 0, max: 10 },
};

/** Field name -> where it lives on the target object. */
const FIELD_MAP: Record<ScenarioTargetType, Record<string, FieldRule>> = {
  ASSET: ASSET_FIELDS,
  SERVICE: ASSET_FIELDS,
  // ASSET_CONTROL is the per-asset control mapping (spec §9).
  ASSET_CONTROL: CONTROL_FIELDS,
  CONTROL: CONTROL_FIELDS,
  VULNERABILITY: VULNERABILITY_FIELDS,
  DEPENDENCY: { dependencyType: { kind: "enum", values: ["DATA", "SERVICE", "AUTH", "NETWORK", "PHYSICAL", "THIRD_PARTY"] } },
  BUSINESS_UNIT: { criticality: ASSET_FIELDS.criticality },
  THREAT_SIGNAL: { signalScore: { kind: "number", min: 0, max: 1 } },
  // Business-impact parameters live on the asset's businessImpact object.
  BUSINESS_PARAMETER: Object.fromEntries(
    Object.entries(ASSET_FIELDS).map(([key, rule]) => [key, rule])
  ),
};

function rulesFor(targetType: ScenarioTargetType): Record<string, FieldRule> | undefined {
  return FIELD_MAP[targetType];
}

/** Validate a single value against its field rule. Returns an error code or null. */
function validateValue(rule: FieldRule, value: unknown): string | null {
  if (rule.kind === "boolean") {
    return typeof value === "boolean" ? null : "INVALID_TYPE";
  }

  if (rule.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "INVALID_TYPE";
    if (rule.min !== undefined && value < rule.min) return "OUT_OF_RANGE";
    if (rule.max !== undefined && value > rule.max) return "OUT_OF_RANGE";
    return null;
  }

  if (typeof value !== "string") return "INVALID_TYPE";
  if (rule.values && !rule.values.includes(value)) return "INVALID_ENUM_VALUE";
  return null;
}

/**
 * Coerce a change into the concrete value the field will receive.
 *
 * INCREASE / DECREASE are resolved against the current baseline value, which is
 * what makes them reproducible: the same declared change against the same
 * baseline always yields the same absolute value.
 */
function resolveValue(
  change: ScenarioChange,
  current: unknown,
  rule: FieldRule
): { value: unknown } | { error: string } {
  if (change.operation === "INCREASE" || change.operation === "DECREASE") {
    if (typeof current !== "number" || typeof change.newValue !== "number") {
      return { error: "INVALID_TYPE" };
    }
    const next = change.operation === "INCREASE"
      ? current + change.newValue
      : current - change.newValue;

    if (rule.min !== undefined && next < rule.min) return { error: "OUT_OF_RANGE" };
    if (rule.max !== undefined && next > rule.max) return { error: "OUT_OF_RANGE" };
    return { value: next };
  }

  // PATCH/ENABLE/DISABLE/ISOLATE/UNPATCH all reduce to an absolute SET: the
  // caller declares the resulting state, so there is no hidden interpretation.
  const value = change.newValue;
  const error = validateValue(rule, value);
  return error ? { error } : { value };
}

/** Recompute an asset's control effectiveness after a control change. */
function withControlChange(asset: RiskAssetContext, controlId: string, next: Partial<RiskControlContext>): RiskAssetContext {
  const controls = asset.controls.map((control) =>
    control.controlId === controlId ? { ...control, ...next } : control
  );

  // controlEffectiveness is derived, never set directly — otherwise a scenario
  // could claim a control is effective without the numbers supporting it.
  return { ...asset, controls, controlEffectiveness: combineControlEffectiveness(controls) };
}

/** Recompute an asset's vulnerability list after a vulnerability change. */
function withVulnerabilityChange(
  asset: RiskAssetContext,
  vulnerabilityId: string,
  next: Partial<RiskVulnerabilityContext>
): RiskAssetContext {
  return {
    ...asset,
    vulnerabilities: asset.vulnerabilities.map((vulnerability) =>
      vulnerability.id === vulnerabilityId ? { ...vulnerability, ...next } : vulnerability
    ),
  };
}

/**
 * Apply one change to one asset, returning a new asset.
 *
 * `entityRef` is the nested id (control / finding), already split from the
 * "<assetId>/<entityId>" form by the resolver. Using the full ref here would
 * validate cleanly and then silently match nothing.
 *
 * PATCH/UNPATCH declare the post-remediation state of the finding rather than
 * mutating exploitability by side effect.
 */
function applyToAsset(
  asset: RiskAssetContext,
  change: ScenarioChange,
  entityRef: string,
  value: unknown
): RiskAssetContext {
  if (change.targetType === "ASSET_CONTROL" || change.targetType === "CONTROL") {
    return withControlChange(asset, entityRef, { [change.fieldPath]: value });
  }

  if (change.targetType === "VULNERABILITY") {
    if (change.operation === "REMOVE") {
      return {
        ...asset,
        vulnerabilities: asset.vulnerabilities.filter(
          (vulnerability) => vulnerability.id !== entityRef
        ),
      };
    }

    const patch: Partial<RiskVulnerabilityContext> = { [change.fieldPath]: value };
    // Remediating a finding must also clear its exploitability, otherwise the
    // engine would keep pricing a risk the scenario claims to have fixed.
    if (change.operation === "PATCH" || change.operation === "UNPATCH") {
      patch.status = "PATCHED";
      patch.exploitAvailable = false;
      patch.patchAvailable = true;
    }
    return withVulnerabilityChange(asset, entityRef, patch);
  }

  if (change.targetType === "BUSINESS_PARAMETER") {
    const businessImpact: BusinessImpactParameters = {
      ...asset.businessImpact,
      [change.fieldPath]: value,
    };
    return { ...asset, businessImpact };
  }

  if (change.operation === "ISOLATE" || change.operation === "UNEXPOSE") {
    return { ...asset, internetExposed: false };
  }
  if (change.operation === "EXPOSE") {
    return { ...asset, internetExposed: true };
  }

  return { ...asset, [change.fieldPath]: value };
}

/**
 * Read the current value of a field on the target, or undefined when the target
 * or field does not exist. Used for validation and for resolving INCREASE /
 * DECREASE against the baseline.
 */
function readCurrent(
  baseline: RiskCalculationContext,
  change: ScenarioChange
): { asset?: RiskAssetContext; current?: unknown } {
  if (change.targetType === "DEPENDENCY") {
    const dependency = baseline.dependencies.find(
      (candidate) =>
        candidate.sourceAssetId === change.targetId ||
        `${candidate.sourceAssetId}->${candidate.targetAssetId}` === change.targetId
    );
    if (!dependency) return {};
    return { current: (dependency as unknown as Record<string, unknown>)[change.fieldPath] };
  }

  // Control and vulnerability targets are addressed as "<assetId>/<targetId>",
  // because a control id or vulnerability id is not unique across the estate.
  const [assetRef, entityRef] = change.targetId.includes("/")
    ? change.targetId.split("/", 2)
    : [change.targetId, change.targetId];

  const asset = baseline.assets.find((candidate) => candidate.assetId === assetRef);
  if (!asset) return {};

  if (change.targetType === "ASSET_CONTROL" || change.targetType === "CONTROL") {
    const control = asset.controls.find((candidate) => candidate.controlId === entityRef);
    if (!control) return { asset };
    return { asset, current: (control as unknown as Record<string, unknown>)[change.fieldPath] };
  }

  if (change.targetType === "VULNERABILITY") {
    const vulnerability = asset.vulnerabilities.find((candidate) => candidate.id === entityRef);
    if (!vulnerability) return { asset };
    return {
      asset,
      current: (vulnerability as unknown as Record<string, unknown>)[change.fieldPath],
    };
  }

  if (change.targetType === "THREAT_SIGNAL") {
    const event = asset.telemetry.find((candidate) => candidate.id === entityRef);
    if (!event) return { asset };
    return { asset, current: (event as unknown as Record<string, unknown>)[change.fieldPath] };
  }

  if (change.targetType === "BUSINESS_PARAMETER") {
    return {
      asset,
      current: (asset.businessImpact as unknown as Record<string, unknown>)[change.fieldPath],
    };
  }

  // ASSET / SERVICE / BUSINESS_UNIT read straight off the asset.
  return { asset, current: (asset as unknown as Record<string, unknown>)[change.fieldPath] };
}

/** Whether a nested target (control / finding / signal) exists on the asset. */
function nestedTargetExists(asset: RiskAssetContext, change: ScenarioChange, entityRef: string): boolean {
  if (change.targetType === "ASSET_CONTROL" || change.targetType === "CONTROL") {
    return asset.controls.some((control) => control.controlId === entityRef);
  }
  if (change.targetType === "VULNERABILITY") {
    return asset.vulnerabilities.some((vulnerability) => vulnerability.id === entityRef);
  }
  if (change.targetType === "THREAT_SIGNAL") {
    return asset.telemetry.some((event) => event.id === entityRef);
  }
  return true;
}

/** Apply a dependency-level change (currently just its type). */
function applyToDependency(
  dependency: RiskDependencyContext,
  fieldPath: string,
  value: unknown
): RiskDependencyContext {
  return { ...dependency, [fieldPath]: value } as RiskDependencyContext;
}

/**
 * Resolve the scenario state.
 *
 * Returns a NEW context. The baseline is frozen first, so if any future code path
 * tried to mutate it in place it would throw rather than quietly corrupt the real
 * assessment — which is exactly what spec §102 forbids.
 */
export function resolveScenarioState(
  baseline: RiskCalculationContext,
  changes: ScenarioChange[]
): ResolvedScenarioState {
  const issues: ScenarioValidationIssue[] = [];
  const warnings: string[] = [];
  const applied: ScenarioChange[] = [];

  Object.freeze(baseline);
  Object.freeze(baseline.assets);

  // Deterministic ordering: sequence first, id as a stable tie-break (spec §15).
  const ordered = [...changes].sort(
    (a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id)
  );

  let assets = baseline.assets.map((asset) => asset);
  let dependencies = baseline.dependencies.map((dependency) => dependency);

  for (const change of ordered) {
    const rules = rulesFor(change.targetType);
    if (!rules) {
      issues.push({
        changeId: change.id,
        code: "UNSUPPORTED_TARGET_TYPE",
        message: `Target type ${change.targetType} is not supported.`,
      });
      continue;
    }

    const rule = rules[change.fieldPath];
    if (!rule) {
      issues.push({
        changeId: change.id,
        code: "FIELD_NOT_MUTABLE",
        message: `"${change.fieldPath}" is not a scenario-mutable field on ${change.targetType}.`,
      });
      continue;
    }

    if (change.targetType === "DEPENDENCY") {
      const index = dependencies.findIndex(
        (candidate) =>
          candidate.sourceAssetId === change.targetId ||
          `${candidate.sourceAssetId}->${candidate.targetAssetId}` === change.targetId
      );
      if (index < 0) {
        issues.push({
          changeId: change.id,
          code: "TARGET_NOT_FOUND",
          message: `Dependency ${change.targetId} does not exist in the baseline.`,
        });
        continue;
      }
      const current = (dependencies[index] as unknown as Record<string, unknown>)[change.fieldPath];
      const outcome = resolveValue(change, current, rule);
      if ("error" in outcome) {
        issues.push({ changeId: change.id, code: outcome.error, message: `Invalid value for ${change.fieldPath}.` });
        continue;
      }
      dependencies = dependencies.map((dependency, i) =>
        i === index ? applyToDependency(dependency, change.fieldPath, outcome.value) : dependency
      );
      applied.push(change);
      continue;
    }

    const { asset, current } = readCurrent(baseline, change);
    if (!asset) {
      issues.push({
        changeId: change.id,
        code: "TARGET_NOT_FOUND",
        message: `Target ${change.targetId} does not exist in the baseline.`,
      });
      continue;
    }

    const [, entityRef] = change.targetId.includes("/")
      ? change.targetId.split("/", 2)
      : [change.targetId, change.targetId];

    if (!nestedTargetExists(asset, change, entityRef)) {
      issues.push({
        changeId: change.id,
        code: "TARGET_NOT_FOUND",
        message: `${entityRef} does not exist on asset ${asset.assetId}.`,
      });
      continue;
    }

    const outcome = resolveValue(change, current, rule);
    if ("error" in outcome) {
      issues.push({
        changeId: change.id,
        code: outcome.error,
        message: `Invalid value for ${change.fieldPath}: ${JSON.stringify(change.newValue)}.`,
      });
      continue;
    }

    assets = assets.map((candidate) =>
      candidate.assetId === asset.assetId
        ? applyToAsset(candidate, change, entityRef, outcome.value)
        : candidate
    );
    applied.push(change);
  }

  if (issues.length > 0) {
    warnings.push(
      `${issues.length} of ${ordered.length} declared change(s) were rejected; the scenario is only partially applied.`
    );
  }

const context: RiskCalculationContext = {
    ...baseline,
    assets,
    dependencies,
    // The scenario is a different input state, so it must not reuse the
    // baseline's input hash. It is replaced with its own identity below.
    inputStateHash: "",
  };

  const scenarioStateHash = hashScenarioState(baseline, context, ordered, applied);

  return {
    context: { ...context, inputStateHash: scenarioStateHash },
    applied,
    issues,
    warnings,
    scenarioStateHash,
  };
}

/**
 * SHA-256 over baseline identity + ordered changes + resolved effective state
 * (spec §29). Uses the same canonicalisation as the P2 calculation hash, so the
 * two cannot drift apart.
 */
export function hashScenarioState(
  baseline: RiskCalculationContext,
  resolved: RiskCalculationContext,
  ordered: ScenarioChange[],
  applied: ScenarioChange[]
): string {
  const appliedIds = new Set(applied.map((change) => change.id));

  return hashRiskResult({
    version: SCENARIO_STATE_VERSION,
    baselineIdentity: {
      organizationId: baseline.organizationId,
      scopeType: baseline.scopeType,
      scopeId: baseline.scopeId,
      asOf: baseline.asOf.toISOString(),
      inputStateHash: baseline.inputStateHash,
      modelBundle: baseline.modelBundle.modelBundleVersion,
      parameters: baseline.parameters.parameterVersion,
      simulation: baseline.simulation.configVersion,
    },
    // Ordered, so two scenarios with the same logical changes hash identically
    // regardless of the order they were submitted in.
    changes: ordered
      .map((change) => ({
        id: change.id,
        sequence: change.sequence,
        targetType: change.targetType,
        targetId: change.targetId,
        fieldPath: change.fieldPath,
        operation: change.operation,
        newValue: change.newValue,
        applied: appliedIds.has(change.id),
      }))
      .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id)),
    effectiveState: {
      assets: resolved.assets
        .map((asset) => ({
          assetId: asset.assetId,
          internetExposed: asset.internetExposed,
          criticality: asset.criticality,
          dataSensitivity: asset.dataSensitivity,
          controlEffectiveness: asset.controlEffectiveness,
          controls: asset.controls.map((control) => ({
            controlId: control.controlId,
            coverage: control.coverage,
            effectiveness: control.effectiveness,
            status: control.status,
          })),
          vulnerabilities: asset.vulnerabilities.map((vulnerability) => ({
            id: vulnerability.id,
            status: vulnerability.status,
            exploitAvailable: vulnerability.exploitAvailable,
            patchAvailable: vulnerability.patchAvailable,
          })),
          businessImpact: asset.businessImpact,
        }))
        .sort((a, b) => a.assetId.localeCompare(b.assetId)),
      dependencies: resolved.dependencies
        .map((dependency) => ({
          edge: `${dependency.sourceAssetId}->${dependency.targetAssetId}`,
          dependencyType: dependency.dependencyType,
          criticality: dependency.criticality,
        }))
        .sort((a, b) => a.edge.localeCompare(b.edge)),
    },
  });
}

/**
 * Validate changes without applying them (spec §16).
 *
 * Used by the API before a run so an analyst sees every problem at once rather
 * than discovering them one failed run at a time.
 */
export function validateScenarioChanges(
  baseline: RiskCalculationContext,
  changes: ScenarioChange[]
): ScenarioValidationIssue[] {
  return resolveScenarioState(baseline, changes).issues;
}

/** True when every declared change applied cleanly. */
export function isScenarioApplicable(state: ResolvedScenarioState): boolean {
  return state.issues.length === 0 && state.applied.length > 0;
}