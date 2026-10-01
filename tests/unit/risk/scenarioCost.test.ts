/**
 * P4 — Scenario cost semantics and ROSI
 *
 * The risk here is a number that looks like a return. These tests pin the
 * properties that keep the economics honest: one-time and recurring cost stay
 * separate, an undefined ratio is null rather than Infinity, and every figure
 * carries its assumptions and an interpretation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ROSI_CONVENTION,
  ScenarioCostError,
  buildInvestmentOutcome,
  buildReductionCurve,
  calculateRosi,
  normaliseScenarioCost,
  rankByBenefitPerCost,
  type InvestmentScenarioOutcome,
} from "../../../src/services/scenario/scenarioCost.service";
import type { ScenarioResult } from "../../../src/services/scenario/scenarioRunner.service";

function costInput(overrides: Record<string, unknown> = {}) {
  return {
    oneTime: 3_000_000,
    annual: 300_000,
    currency: "INR",
    semantics: ["CAPEX", "OPEX"] as const,
    basis: "INVESTMENT_OPTION" as const,
    ...overrides,
  } as never;
}

function result(overrides: Record<string, unknown> = {}): ScenarioResult {
  return {
    baseline: { eal: 10_000_000, var95: 20_000_000, var99: 30_000_000, financialExposure: 50_000_000, riskScore: 70 },
    scenario: { eal: 6_000_000, var95: 14_000_000, var99: 22_000_000, financialExposure: 48_000_000, riskScore: 45 },
    riskReduction: { eal: 4_000_000, var95: 6_000_000, var99: 8_000_000, financialExposure: 2_000_000, riskScore: 25 },
    delta: { eal: -4_000_000, var95: -6_000_000, var99: -8_000_000, financialExposure: -2_000_000, riskScore: -25 },
    residualRisk: { eal: 6_000_000, var95: 14_000_000, riskScore: 45 },
    baselineResultHash: "sha256:baseline",
    scenarioResultHash: "sha256:scenario",
    scenarioStateHash: "sha256:state",
    uncertainty: { confidenceLevel: "MEDIUM", coverage: {}, warnings: [], ood: false },
    versions: { riskEngine: "risk-engine-v2.0", parameters: "params-2026-09", modelBundle: "det", score: "s", simulation: "mc" },
    warnings: ["Baseline drifted from current production state."],
    ...overrides,
  } as never;
}

// ── Cost normalisation ─────────────────────────────────────────────────────

test("one-time and recurring cost stay separate", () => {
  const cost = normaliseScenarioCost(costInput());

  assert.equal(cost.oneTime, 3_000_000);
  assert.equal(cost.annual, 300_000);
  assert.notEqual(cost.oneTime, cost.annual);
});

test("a one-time cost is annualised over a stated horizon, and the horizon is disclosed", () => {
  const cost = normaliseScenarioCost(costInput({ oneTime: 3_000_000, annual: 0 }));

  // 3M over 3 years = 1M/yr.
  assert.equal(cost.annualised, 1_000_000);
  assert.ok(cost.warnings.some((warning) => /3 years/.test(warning)));
});

test("a partial cost input is disclosed rather than silently zero-filled", () => {
  const cost = normaliseScenarioCost(costInput({ annual: undefined }));

  assert.equal(cost.annual, 0);
  assert.equal(cost.isPartial, true);
  assert.ok(cost.warnings.some((warning) => /missing component/i.test(warning)));
});

test("a zero-cost or negative-cost scenario is rejected", () => {
  assert.throws(() => normaliseScenarioCost(costInput({ oneTime: 0, annual: 0 })), ScenarioCostError);
  assert.throws(() => normaliseScenarioCost(costInput({ oneTime: -1 })), ScenarioCostError);
  assert.throws(() => normaliseScenarioCost(costInput({ annual: -5 })), ScenarioCostError);
});

test("cost semantics are required", () => {
  assert.throws(
    () => normaliseScenarioCost(costInput({ semantics: [] })),
    ScenarioCostError
  );
});

// ── ROSI ───────────────────────────────────────────────────────────────────

test("ROSI follows the documented formula", () => {
  // Gross 4M, cost 1M -> net 3M -> 300%.
  const rosi = calculateRosi({ avoidedEal: 4_000_000, cost: 1_000_000, currency: "INR" });

  assert.equal(rosi.grossBenefit, 4_000_000);
  assert.equal(rosi.netBenefit, 3_000_000);
  assert.equal(rosi.value, 300);
  assert.equal(rosi.convention, ROSI_CONVENTION);
});

test("a negative ROSI is preserved, not clamped to zero", () => {
  // A scenario that costs more than the modelled reduction is a real answer.
  const rosi = calculateRosi({ avoidedEal: 100_000, cost: 1_000_000, currency: "INR" });

  assert.equal(rosi.netBenefit, -900_000);
  assert.equal(rosi.value, -90);
});

test("a zero cost yields a null ratio, not Infinity", () => {
  const rosi = calculateRosi({ avoidedEal: 4_000_000, cost: 0, currency: "INR" });

  assert.equal(rosi.value, null, "infinitely good is not a decision anyone can act on");
  assert.equal(rosi.netBenefit, 4_000_000);
});

test("every ROSI figure carries an interpretation and a versioned convention", () => {
  const rosi = calculateRosi({ avoidedEal: 1, cost: 1, currency: "INR" });

  assert.equal(rosi.convention, "rosi-v1");
  assert.match(rosi.interpretation, /modelled/i);
  assert.match(rosi.interpretation, /not a realised saving/i);
});

test("non-finite inputs are rejected", () => {
  assert.throws(() => calculateRosi({ avoidedEal: Number.NaN, cost: 1, currency: "INR" }), ScenarioCostError);
  assert.throws(() => calculateRosi({ avoidedEal: 1, cost: -1, currency: "INR" }), ScenarioCostError);
});

// ── Investment outcome (the P5 contract) ───────────────────────────────────

test("the investment outcome carries the scenario figures P5 needs", () => {
  const outcome = buildInvestmentOutcome({
    scenarioId: "SCN-009",
    result: result(),
    cost: normaliseScenarioCost(costInput()),
  });

  assert.equal(outcome.scenarioId, "SCN-009");
  assert.equal(outcome.baselineEal, 10_000_000);
  assert.equal(outcome.scenarioEal, 6_000_000);
  assert.equal(outcome.avoidedEal, 4_000_000);
  assert.equal(outcome.residualRisk, 6_000_000);
  assert.ok(outcome.assumptions.length > 0);
  assert.ok(outcome.rosi, "a priced scenario must carry a ROSI figure");
});

test("an outcome states its assumptions, including model confidence and drift", () => {
  const outcome = buildInvestmentOutcome({
    scenarioId: "SCN-009",
    result: result(),
    cost: normaliseScenarioCost(costInput()),
  });

  const joined = outcome.assumptions.join(" | ");
  assert.match(joined, /risk-engine-v2\.0/);
  assert.match(joined, /MEDIUM/, "non-HIGH confidence must be stated");
  assert.match(joined, /Baseline drifted/, "run warnings must be carried through");
});

test("residual risk is what remains, never the reduction", () => {
  const outcome = buildInvestmentOutcome({
    scenarioId: "SCN-1",
    result: result(),
    cost: normaliseScenarioCost(costInput()),
  });

  assert.equal(outcome.residualRisk, outcome.scenarioEal);
  assert.notEqual(outcome.residualRisk, outcome.avoidedEal);
});

// ── Curve and ranking (§79) ────────────────────────────────────────────────

function outcomeFor(
  scenarioId: string,
  annualised: number,
  avoidedEal: number
): { scenarioId: string; outcome: InvestmentScenarioOutcome } {
  return {
    scenarioId,
    outcome: {
      investmentOptionId: null,
      scenarioId,
      cost: { oneTime: annualised, annual: 0, annualised, currency: "INR" },
      baselineEal: 10_000_000,
      scenarioEal: 10_000_000 - avoidedEal,
      avoidedEal,
      baselineVar95: 1,
      scenarioVar95: 1,
      baselineRiskScore: 1,
      scenarioRiskScore: 1,
      residualRisk: 10_000_000 - avoidedEal,
      assumptions: [],
      rosi: null,
    },
  };
}

test("the reduction curve is ordered by cost so it is directly plottable", () => {
  const curve = buildReductionCurve([
    outcomeFor("expensive", 5_000_000, 9_000_000),
    outcomeFor("cheap", 1_000_000, 2_000_000),
    outcomeFor("mid", 3_000_000, 6_000_000),
  ]);

  assert.deepEqual(curve.map((point) => point.scenarioId), ["cheap", "mid", "expensive"]);
  assert.equal(curve[0].cost, 1_000_000);
  assert.equal(curve[0].avoidedEal, 2_000_000);
});

test("scenarios are ranked by modelled benefit per unit cost", () => {
  const ranked = rankByBenefitPerCost([
    outcomeFor("poor", 4_000_000, 1_000_000),
    outcomeFor("good", 1_000_000, 5_000_000),
    outcomeFor("middling", 2_000_000, 3_000_000),
  ]);

  assert.deepEqual(ranked.map((entry) => entry.scenarioId), ["good", "middling", "poor"]);
});

test("an unpriced scenario is excluded from ranking rather than sorted as best", () => {
  const ranked = rankByBenefitPerCost([
    outcomeFor("free", 0, 5_000_000),
    outcomeFor("paid", 1_000_000, 1_000_000),
  ]);

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].scenarioId, "paid");
});