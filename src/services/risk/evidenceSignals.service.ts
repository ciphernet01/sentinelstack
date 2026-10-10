/**
 * P2 — Evidence Signal Model (event-class normalisation)
 *
 * Private per-asset security evidence into a small set of *event classes*,
 * so that the enterprise is not modelled as "every vulnerability = one
 * incident" (P2 spec §10).
 *
 * Each emitted signal is an expected-annual-incident contribution.  Signals
 * accumulate into a raw annual rate, which is then converted to a horizon
 * probability by `likelihood.service.ts`.  Because the weights are documented
 * and versioned, every number the engine produces can be traced back to the
 * evidence that produced it.
 *
 * The weights below are the deterministic-baseline-v0 calibration. They are
 * deliberately small, additive, and bounded — not hand-tuned per-asset magic
 * numbers hidden inside a controller.
 */

import type { RiskAssetContext } from "./riskCalculationContext";
import type { RiskParameterBundle } from "./assumptions.service";

export const SIGNAL_MODEL_VERSION = "signal-weights-v1";

export const EVENT_CLASSES = [
  "EXTERNAL_EXPLOITATION",
  "CREDENTIAL_COMPROMISE",
  "RANSOMWARE",
  "CLOUD_COMPROMISE",
  "DATA_EXPOSURE",
  "PRIVILEGE_ESCALATION",
  "THIRD_PARTY",
  "AVAILABILITY_ATTACK",
] as const;

export type EventClass = (typeof EVENT_CLASSES)[number];

export type SignalKind =
  | "EXPLOITABLE_VULNERABILITY"
  | "UNPATCHED_EXPLOITABLE_VULNERABILITY"
  | "EPSS_PRESSURE"
  | "INTERNET_EXPOSURE"
  | "MFA_CONTROL_GAP"
  | "IAM_TELEMETRY"
  | "EDR_TELEMETRY"
  | "EDR_CONTROL_GAP"
  | "CSPM_TELEMETRY"
  | "CSPM_CONTROL_GAP"
  | "CLOUD_ENVIRONMENT"
  | "DATA_SENSITIVITY"
  | "REGULATORY_EXPOSURE"
  | "EGRESS_ANOMALY"
  | "PRIVILEGE_TELEMETRY"
  | "THIRD_PARTY_ENVIRONMENT"
  | "CRITICALITY_WEIGHT"
  | "AVAILABILITY_TOLERANCE";

export interface AssetEventSignal {
  kind: SignalKind;
  /** Expected annual incident contribution before control adjustment. */
  weight: number;
  /** Human/audit readable explanation with the concrete evidence reference. */
  reason: string;
  /** Stable references to the evidence rows that produced this signal. */
  evidenceRefs: string[];
}

export interface AssetEventEvidence {
  assetId: string;
  eventClass: EventClass;
  signals: AssetEventSignal[];
  /** Sum of signal weights before control adjustment. */
  rawSignal: number;
  /** 0..1 combined control effectiveness applied to this event class. */
  controlEffectiveness: number;
  /** rawSignal x (1 - controlEffectiveness x maxReduction) */
  adjustedSignal: number;
}

/** The weight multiplier table — versioned as SIGNAL_MODEL_VERSION. */
export const SIGNAL_WEIGHTS = Object.freeze({
  exploitableVulnerability: 0.02,
  unpatchedExploitableVulnerability: 0.045,
  epssPressure: 0.05,
  internetExposureMultiplier: 1.6,
  mfaControlGap: 0.06,
  iamTelemetry: 0.03,
  edrTelemetry: 0.02,
  edrControlGap: 0.04,
  cspmTelemetry: 0.035,
  cspmControlGap: 0.04,
  cloudEnvironment: 0.01,
  dataSensitivity: 0.008,
  regulatoryExposure: 0.01,
  egressAnomaly: 0.015,
  privilegeTelemetry: 0.025,
  thirdPartyEnvironment: 0.03,
  availabilityInternetExposure: 0.02,
  availabilityTolerance: 0.015,
  criticalityWeight: 0.01,
} as const);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRITICALITY_FACTOR: Record<string, number> = {
  LOW: 0.75,
  MODERATE: 1,
  HIGH: 1.25,
  CRITICAL: 1.55,
};

function criticalityFactor(criticality: string): number {
  return CRITICALITY_FACTOR[criticality] ?? 1;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Effectiveness of a specific control category on the asset, expressed as
 * coverage x effectiveness for controls of that category.  Missing controls
 * return 0 — and are modelled as a *gap*, never as "no incidents possible".
 */
export function controlCategoryEffectiveness(
  asset: RiskAssetContext,
  category: string
): number {
  const relevant = asset.controls.filter((control) => control.category === category);
  if (relevant.length === 0) return 0;

  const total = relevant.reduce(
    (sum, control) => sum + clamp01(control.coverage) * clamp01(control.effectiveness),
    0
  );
  return clamp01(total / relevant.length);
}

function collectTelemetry(
  asset: RiskAssetContext,
  source: string,
  eventTypes: string[],
  weightPerPoint: number
): { weight: number; evidenceRefs: string[]; reasons: string[] } {
  const matches = asset.telemetry.filter(
    (event) => event.source === source && eventTypes.includes(event.eventType)
  );

  let weight = 0;
  const reasons: string[] = [];
  for (const event of matches) {
    const contribution = weightPerPoint * Math.max(0.25, Math.min(2, event.signalScore || 1));
    weight += contribution;
    reasons.push(`${source}/${event.eventType} (${event.severity}, signal ${event.signalScore})`);
  }

  return { weight, evidenceRefs: matches.map((event) => event.id), reasons };
}

/**
 * Build the complete event-class evidence set for one asset.
 *
 * Controls reduce the *likelihood* contribution: an event class with strong
 * controls retains `1 - effectiveness x maxReduction` of its raw signal.  A
 * missing control contributes a *gap* signal instead of zero risk.
 */
export function extractAssetEventEvidence(
  asset: RiskAssetContext,
  parameters: RiskParameterBundle
): AssetEventEvidence[] {
  const W = SIGNAL_WEIGHTS;
  const criticality = criticalityFactor(asset.criticality);
  const overallControlEffectiveness = clamp01(asset.controlEffectiveness);
  const maxReduction = clamp01(parameters.maxControlLikelihoodReduction);

  const results: AssetEventEvidence[] = [];

  const emit = (
    eventClass: EventClass,
    signals: AssetEventSignal[],
    controlEffectiveness = overallControlEffectiveness,
    preMultiplier = 1
  ) => {
    const rawSignal = signals.reduce((sum, signal) => sum + signal.weight, 0) * preMultiplier;
    const adjustedSignal = rawSignal * (1 - clamp01(controlEffectiveness) * maxReduction);

    results.push({
      assetId: asset.assetId,
      eventClass,
      signals,
      rawSignal,
      controlEffectiveness,
      adjustedSignal,
    });
  };

  // ── Potential external exploitation of known vulnerabilities ─────────────
  {
    const signals: AssetEventSignal[] = [];
    for (const vulnerability of asset.vulnerabilities) {
      if (!vulnerability.exploitAvailable) continue;
      const base = vulnerability.patchAvailable
        ? W.exploitableVulnerability
        : W.unpatchedExploitableVulnerability;
      signals.push({
        kind: vulnerability.patchAvailable
          ? "EXPLOITABLE_VULNERABILITY"
          : "UNPATCHED_EXPLOITABLE_VULNERABILITY",
        weight: base * clamp01(vulnerability.cvss / 10),
        reason: `${vulnerability.cve ?? vulnerability.id} CVSS ${vulnerability.cvss}${
          vulnerability.patchAvailable ? " (patch available)" : " (no patch available)"
        }`,
        evidenceRefs: [vulnerability.id],
      });
    }
    for (const vulnerability of asset.vulnerabilities) {
      if (vulnerability.epss < 0.1) continue;
      signals.push({
        kind: "EPSS_PRESSURE",
        weight: W.epssPressure * clamp01(vulnerability.epss),
        reason: `${vulnerability.cve ?? vulnerability.id} EPSS ${vulnerability.epss}`,
        evidenceRefs: [vulnerability.id],
      });
    }
    if (asset.internetExposed) {
      signals.push({
        kind: "INTERNET_EXPOSURE",
        weight: 0,
        reason: `Asset is internet-exposed: class signal multiplied by ${W.internetExposureMultiplier}`,
        evidenceRefs: [],
      });
    }
    emit(
      "EXTERNAL_EXPLOITATION",
      signals,
      overallControlEffectiveness,
      asset.internetExposed ? W.internetExposureMultiplier : 1
    );
  }

  // ── Credential compromise ────────────────────────────────────────────────
  {
    const signals: AssetEventSignal[] = [];
    const iamEffectiveness = controlCategoryEffectiveness(asset, "IAM");
    const mfaGap = 1 - iamEffectiveness;
    if (mfaGap > 0) {
      signals.push({
        kind: "MFA_CONTROL_GAP",
        weight: W.mfaControlGap * mfaGap * criticality,
        reason: `IAM control effectiveness ${iamEffectiveness.toFixed(2)} leaves gap ${mfaGap.toFixed(2)}`,
        evidenceRefs: asset.controls.filter((c) => c.category === "IAM").map((c) => c.controlId),
      });
    }
    const iamTelemetry = collectTelemetry(
      asset,
      "IAM",
      ["REPEATED_AUTH_FAILURES", "IMPOSSIBLE_TRAVEL", "MFA_BYPASS_ATTEMPT"],
      W.iamTelemetry
    );
    if (iamTelemetry.weight > 0) {
      signals.push({
        kind: "IAM_TELEMETRY",
        weight: iamTelemetry.weight,
        reason: iamTelemetry.reasons.join("; "),
        evidenceRefs: iamTelemetry.evidenceRefs,
      });
    }
    emit("CREDENTIAL_COMPROMISE", signals);
  }

  // ── Ransomware / destructive malware ─────────────────────────────────────
  {
    const signals: AssetEventSignal[] = [];
    const edrTelemetry = collectTelemetry(
      asset,
      "EDR",
      ["SUSPICIOUS_PROCESS_EXECUTION", "MALWARE_DETECTED", "RANSOM_NOTE_WRITE"],
      W.edrTelemetry
    );
    if (edrTelemetry.weight > 0) {
      signals.push({
        kind: "EDR_TELEMETRY",
        weight: edrTelemetry.weight,
        reason: edrTelemetry.reasons.join("; "),
        evidenceRefs: edrTelemetry.evidenceRefs,
      });
    }
    const edrEffectiveness = controlCategoryEffectiveness(asset, "ENDPOINT");
    const edrGap = 1 - edrEffectiveness;
    if (edrGap > 0) {
      signals.push({
        kind: "EDR_CONTROL_GAP",
        weight: W.edrControlGap * edrGap * criticality,
        reason: `Endpoint control effectiveness ${edrEffectiveness.toFixed(2)} leaves gap ${edrGap.toFixed(2)}`,
        evidenceRefs: asset.controls
          .filter((c) => c.category === "ENDPOINT")
          .map((c) => c.controlId),
      });
    }
    if (criticality > 1) {
      signals.push({
        kind: "CRITICALITY_WEIGHT",
        weight: W.criticalityWeight * (criticality - 1),
        reason: `Business criticality ${asset.criticality} amplifies destructive-event impact`,
        evidenceRefs: [],
      });
    }
    emit("RANSOMWARE", signals);
  }

  // ── Cloud compromise ─────────────────────────────────────────────────────
  {
    const signals: AssetEventSignal[] = [];
    if (asset.environment === "CLOUD") {
      signals.push({
        kind: "CLOUD_ENVIRONMENT",
        weight: W.cloudEnvironment,
        reason: "Asset runs in a cloud environment",
        evidenceRefs: [],
      });
    }
    const cspmTelemetry = collectTelemetry(
      asset,
      "CSPM",
      ["PUBLIC_BUCKET_DETECTED", "OPEN_SECURITY_GROUP", "EXCESSIVE_PRIVILEGE", "MISCONFIGURATION"],
      W.cspmTelemetry
    );
    if (cspmTelemetry.weight > 0) {
      signals.push({
        kind: "CSPM_TELEMETRY",
        weight: cspmTelemetry.weight,
        reason: cspmTelemetry.reasons.join("; "),
        evidenceRefs: cspmTelemetry.evidenceRefs,
      });
    }
    const cspmEffectiveness = controlCategoryEffectiveness(asset, "CLOUD");
    const cspmGap = 1 - cspmEffectiveness;
    if (cspmGap > 0) {
      signals.push({
        kind: "CSPM_CONTROL_GAP",
        weight: W.cspmControlGap * cspmGap,
        reason: `Cloud control effectiveness ${cspmEffectiveness.toFixed(2)} leaves gap ${cspmGap.toFixed(2)}`,
        evidenceRefs: asset.controls.filter((c) => c.category === "CLOUD").map((c) => c.controlId),
      });
    }
    emit("CLOUD_COMPROMISE", signals);
  }

  // ── Data exposure / exfiltration ─────────────────────────────────────────
  {
    const signals: AssetEventSignal[] = [];
    signals.push({
      kind: "DATA_SENSITIVITY",
      weight: W.dataSensitivity * Math.max(0, asset.dataSensitivity),
      reason: `Data sensitivity rating ${asset.dataSensitivity}/5`,
      evidenceRefs: [],
    });
    if (asset.businessImpact.regulatoryExposure > 0) {
      signals.push({
        kind: "REGULATORY_EXPOSURE",
        weight: W.regulatoryExposure,
        reason: `Regulatory exposure modelled at ${asset.businessImpact.regulatoryExposure}`,
        evidenceRefs: [],
      });
    }
    const exposureTelemetry = collectTelemetry(
      asset,
      "CSPM",
      ["PUBLIC_BUCKET_DETECTED"],
      W.cspmTelemetry
    );
    if (exposureTelemetry.weight > 0) {
      signals.push({
        kind: "CSPM_TELEMETRY",
        weight: exposureTelemetry.weight,
        reason: exposureTelemetry.reasons.join("; "),
        evidenceRefs: exposureTelemetry.evidenceRefs,
      });
    }
    const egressTelemetry = collectTelemetry(
      asset,
      "SIEM",
      ["ANOMALOUS_EGRESS_VOLUME", "BULK_DATA_DOWNLOAD"],
      W.egressAnomaly
    );
    if (egressTelemetry.weight > 0) {
      signals.push({
        kind: "EGRESS_ANOMALY",
        weight: egressTelemetry.weight,
        reason: egressTelemetry.reasons.join("; "),
        evidenceRefs: egressTelemetry.evidenceRefs,
      });
    }
    emit("DATA_EXPOSURE", signals);
  }

  // ── Privilege escalation ─────────────────────────────────────────────────
  {
    const signals: AssetEventSignal[] = [];
    for (const vulnerability of asset.vulnerabilities) {
      if (vulnerability.cvss < 7 || vulnerability.patchAvailable) continue;
      signals.push({
        kind: "UNPATCHED_EXPLOITABLE_VULNERABILITY",
        weight: W.exploitableVulnerability * clamp01(vulnerability.cvss / 10),
        reason: `${vulnerability.cve ?? vulnerability.id} CVSS ${vulnerability.cvss} remains unpatched`,
        evidenceRefs: [vulnerability.id],
      });
    }
    const privilegeTelemetry = collectTelemetry(
      asset,
      "IAM",
      ["PRIVILEGED_ROLE_GRANT", "ROLE_ESCALATION_ATTEMPT"],
      W.privilegeTelemetry
    );
    if (privilegeTelemetry.weight > 0) {
      signals.push({
        kind: "PRIVILEGE_TELEMETRY",
        weight: privilegeTelemetry.weight,
        reason: privilegeTelemetry.reasons.join("; "),
        evidenceRefs: privilegeTelemetry.evidenceRefs,
      });
    }
    emit("PRIVILEGE_ESCALATION", signals);
  }

  // ── Third-party compromise ───────────────────────────────────────────────
  {
    const signals: AssetEventSignal[] = [];
    if (asset.environment === "THIRD_PARTY") {
      signals.push({
        kind: "THIRD_PARTY_ENVIRONMENT",
        weight: W.thirdPartyEnvironment,
        reason: "Asset is hosted on a third-party environment",
        evidenceRefs: [],
      });
    }
    emit("THIRD_PARTY", signals);
  }

  // ── Availability attack ──────────────────────────────────────────────────
  {
    const signals: AssetEventSignal[] = [];
    if (asset.internetExposed) {
      signals.push({
        kind: "INTERNET_EXPOSURE",
        weight: W.availabilityInternetExposure,
        reason: "Internet-facing service is reachable for availability attacks",
        evidenceRefs: [],
      });
    }
    if (asset.businessImpact.maxTolerableDowntimeHours <= 2) {
      signals.push({
        kind: "AVAILABILITY_TOLERANCE",
        weight: W.availabilityTolerance,
        reason: `Max tolerable downtime is only ${asset.businessImpact.maxTolerableDowntimeHours}h`,
        evidenceRefs: [],
      });
    }
    if (criticality > 1) {
      signals.push({
        kind: "CRITICALITY_WEIGHT",
        weight: W.criticalityWeight * (criticality - 1),
        reason: `Business criticality ${asset.criticality}`,
        evidenceRefs: [],
      });
    }

    emit("AVAILABILITY_ATTACK", signals);
  }

  return results;
}
// ---------------------------------------------------------------------------
// Enterprise aggregation
// ---------------------------------------------------------------------------

export interface EnterpriseEventSignal {
  eventClass: EventClass;
  /** Total adjusted annual rate contributed by all in-scope assets. */
  adjustedSignal: number;
  /** Raw pre-control signal, retained for attribution. */
  rawSignal: number;
  /** Per-asset contribution sorted descending — used for driver attribution. */
  assetContributions: Array<{
    assetId: string;
    adjustedSignal: number;
    evidenceRefs: string[];
    topReason: string | null;
  }>;
}

/**
 * Aggregate per-asset event evidence into enterprise-level event classes.
 *
 * This stage accumulates *frequency only*.  Blast-radius / dependency
 * amplification is applied once per asset in `dependency.service.ts`, which is
 * what prevents a shared dependency from being counted as several independent
 * losses (P2 spec §14.4).
 */
export function aggregateEnterpriseSignals(
  assets: RiskAssetContext[],
  parameters: RiskParameterBundle
): EnterpriseEventSignal[] {
  const byClass = new Map<EventClass, EnterpriseEventSignal>();

  for (const eventClass of EVENT_CLASSES) {
    byClass.set(eventClass, {
      eventClass,
      adjustedSignal: 0,
      rawSignal: 0,
      assetContributions: [],
    });
  }

  for (const asset of assets) {
    for (const evidence of extractAssetEventEvidence(asset, parameters)) {
      const bucket = byClass.get(evidence.eventClass);
      if (!bucket) continue;

      bucket.adjustedSignal += evidence.adjustedSignal;
      bucket.rawSignal += evidence.rawSignal;

      const sortedSignals = evidence.signals
        .filter((signal) => signal.weight > 0)
        .sort((a, b) => b.weight - a.weight);

      bucket.assetContributions.push({
        assetId: asset.assetId,
        adjustedSignal: evidence.adjustedSignal,
        evidenceRefs: evidence.signals.flatMap((signal) => signal.evidenceRefs),
        topReason: sortedSignals[0]?.reason ?? null,
      });
    }
  }

  return Array.from(byClass.values());
}




