/**
 * P2 — Severity Modeling
 *
 * Severity is distributional, not a single point impact.
 *
 * Anti-double-counting (P2 spec §11.5) is enforced structurally: every loss
 * component has exactly ONE semantic owner in the data model, and each event
 * class applies a weight to that component rather than adding its own copy of
 * the amount.  A telemetry signal referencing downtime can therefore never add
 * a second business-interruption amount.
 *
 *   component              semantic owner
 *   ─────────────────────  ────────────────────────────────────────────────
 *   businessInterruption   CyberAsset.downtimeCostPerHourInr x MTD hours
 *   directFinancialLoss    CyberAsset.breachCostInr
 *   recovery               CyberAsset.recoveryCostInr (includes incident response)
 *   legalRegulatory        CyberAsset.regulatoryExposureInr
 *   reputationalImpact     CyberAsset.reputationCostInr
 */

import type { EventClass } from "./evidenceSignals.service";
import type { RiskAssetContext } from "./riskCalculationContext";
import type { RiskParameterBundle } from "./assumptions.service";
import { sampleLognormal, type RandomSource } from "./simulationConfig.service";

export const SEVERITY_COMPOSITION_VERSION = "severity-composition-v1";

export const LOSS_COMPONENTS = [
  "businessInterruption",
  "directFinancialLoss",
  "recovery",
  "legalRegulatory",
  "reputationalImpact",
] as const;

export type LossComponent = (typeof LOSS_COMPONENTS)[number];

export const LOSS_COMPONENT_OWNERS: Readonly<Record<LossComponent, string>> = Object.freeze({
  businessInterruption: "CyberAsset.downtimeCostPerHourInr x maxTolerableDowntimeHours",
  directFinancialLoss: "CyberAsset.breachCostInr",
  recovery: "CyberAsset.recoveryCostInr (incident response included)",
  legalRegulatory: "CyberAsset.regulatoryExposureInr",
  reputationalImpact: "CyberAsset.reputationCostInr",
});

/**
 * Event-class weight per loss component (0..1).
 *
 * Example: a pure availability attack does not create direct financial loss or
 * regulatory exposure, so those weights are zero and the component amounts are
 * simply not counted — rather than being counted and then partially refunded.
 */
export const EVENT_CLASS_COMPONENT_WEIGHTS: Readonly<
  Record<EventClass, Readonly<Record<LossComponent, number>>>
> = Object.freeze({
  EXTERNAL_EXPLOITATION: {
    businessInterruption: 1.0,
    directFinancialLoss: 0.7,
    recovery: 1.0,
    legalRegulatory: 0.6,
    reputationalImpact: 0.7,
  },
  CREDENTIAL_COMPROMISE: {
    businessInterruption: 0.8,
    directFinancialLoss: 0.8,
    recovery: 0.8,
    legalRegulatory: 0.7,
    reputationalImpact: 0.7,
  },
  RANSOMWARE: {
    businessInterruption: 1.0,
    directFinancialLoss: 0.5,
    recovery: 1.0,
    legalRegulatory: 0.4,
    reputationalImpact: 0.8,
  },
  CLOUD_COMPROMISE: {
    businessInterruption: 0.9,
    directFinancialLoss: 0.7,
    recovery: 0.9,
    legalRegulatory: 0.7,
    reputationalImpact: 0.7,
  },
  DATA_EXPOSURE: {
    businessInterruption: 0.3,
    directFinancialLoss: 1.0,
    recovery: 0.6,
    legalRegulatory: 1.0,
    reputationalImpact: 1.0,
  },
  PRIVILEGE_ESCALATION: {
    businessInterruption: 0.5,
    directFinancialLoss: 0.8,
    recovery: 0.8,
    legalRegulatory: 0.7,
    reputationalImpact: 0.6,
  },
  THIRD_PARTY: {
    businessInterruption: 0.7,
    directFinancialLoss: 0.6,
    recovery: 0.6,
    legalRegulatory: 0.6,
    reputationalImpact: 0.7,
  },
  AVAILABILITY_ATTACK: {
    businessInterruption: 1.0,
    directFinancialLoss: 0.0,
    recovery: 0.5,
    legalRegulatory: 0.0,
    reputationalImpact: 0.4,
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeverityComponent {
  component: LossComponent;
  owner: string;
  amount: number;
  weight: number;
  contribution: number;
}

export interface SeverityScale {
  assetId: string;
  eventClass: EventClass;
  /** Median (mu of the lognormal) single-incident loss. */
  medianLoss: number;
  /** Shape parameter (sigma) of the lognormal. */
  sigma: number;
  /** Blast-radius multiplier applied to the composed median. */
  blastRadiusMultiplier: number;
  components: SeverityComponent[];
  compositionVersion: string;
  parameterVersion: string;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * Resolve each loss component's amount from its single semantic owner.
 * Amounts are never derived from telemetry or vulnerability rows here, which
 * is what keeps the component set non-overlapping.
 */
export function severityComponentAmounts(asset: RiskAssetContext): Record<LossComponent, number> {
  const impact = asset.businessImpact;

  return {
    businessInterruption:
      Math.max(0, impact.downtimeCostPerHour) * Math.max(0, impact.maxTolerableDowntimeHours),
    directFinancialLoss: Math.max(0, impact.breachCost),
    recovery: Math.max(0, impact.recoveryCost),
    legalRegulatory: Math.max(0, impact.regulatoryExposure),
    reputationalImpact: Math.max(0, impact.reputationCost),
  };
}

/**
 * Compose the severity scale for one asset / event-class pair.
 *
 * @param blastRadiusMultiplier  from `computeBlastRadius`; applied once
 */
export function composeSeverityScale(
  asset: RiskAssetContext,
  eventClass: EventClass,
  parameters: RiskParameterBundle,
  blastRadiusMultiplier = 1
): SeverityScale {
  const amounts = severityComponentAmounts(asset);
  const weights = EVENT_CLASS_COMPONENT_WEIGHTS[eventClass];

  const components: SeverityComponent[] = LOSS_COMPONENTS.map((component) => {
    const amount = amounts[component];
    const weight = Math.min(1, Math.max(0, weights[component]));
    return {
      component,
      owner: LOSS_COMPONENT_OWNERS[component],
      amount,
      weight,
      contribution: amount * weight,
    };
  });

  const baseMedian = components.reduce((sum, component) => sum + component.contribution, 0);
  const sigma = parameters.severitySigmaByEventClass[eventClass] ?? 1.0;

  return {
    assetId: asset.assetId,
    eventClass,
    medianLoss: baseMedian * blastRadiusMultiplier,
    sigma,
    blastRadiusMultiplier,
    components,
    compositionVersion: SEVERITY_COMPOSITION_VERSION,
    parameterVersion: parameters.parameterVersion,
  };
}

/** Sample one incident's loss from the composed lognormal scale. */
export function sampleEventSeverity(scale: SeverityScale, random: RandomSource): number {
  if (!(scale.medianLoss > 0)) return 0;
  return sampleLognormal(scale.medianLoss, scale.sigma, random);
}

/**
 * Mean of a lognormal is median x exp(sigma^2 / 2).  Used for the analytic
 * expected-loss path in driver attribution, avoiding a full simulation.
 */
export function expectedSeverity(scale: SeverityScale): number {
  return scale.medianLoss * Math.exp((scale.sigma * scale.sigma) / 2);
}

/** Largest non-zero component contribution — surfaced as a business-impact driver. */
export function dominantSeverityComponent(scale: SeverityScale): SeverityComponent | null {
  return (
    scale.components
      .filter((component) => component.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)[0] ?? null
  );
}

