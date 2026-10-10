/**
 * P2 — Product Risk Score (risk-score-v1)
 *
 * The score is a SentinelStack index, not a regulatory score, so the contract
 * that matters is: bounded, monotone in each component, and reconstructable
 * from the persisted components and weights.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { calculateRiskScore } from "../../../src/services/risk/riskScore.service";
import { buildRiskParameters } from "../../../src/services/risk/assumptions.service";

const parameters = buildRiskParameters();

/** Components are percentages computed in floating point — compare with tolerance. */
function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected} but received ${actual}`
  );
}

function score(overrides: Partial<Parameters<typeof calculateRiskScore>[0]> = {}) {
  const input = {
    eal: 5_000_000,
    annualProbabilities: [0.2, 0.05],
    controlEffectiveness: 0.3,
    parameters,
    ...overrides,
  } as Parameters<typeof calculateRiskScore>[0];

  return calculateRiskScore(input);
}

test("risk score stays inside the 0-100 index", () => {
  const low = score({ eal: 0, annualProbabilities: [0], controlEffectiveness: 1 });
  const high = score({ eal: 10_000_000_000, annualProbabilities: [1], controlEffectiveness: 0 });

  assert.ok(low.riskScore >= 0 && low.riskScore <= 100);
  assert.ok(high.riskScore >= 0 && high.riskScore <= 100);
  assert.equal(high.riskScore, 100);
});

test("risk score is monotone in expected annual loss", () => {
  const a = score({ eal: 1_000_000 });
  const b = score({ eal: 5_000_000 });
  const c = score({ eal: 9_000_000 });

  assert.ok(a.riskScore < b.riskScore && b.riskScore <= c.riskScore);
  assert.ok(b.components.financial > a.components.financial);
});

test("financial component saturates at the appetite and never exceeds 100", () => {
  const beyond = score({ eal: parameters.ealAppetiteInr * 10 });
  assert.equal(beyond.components.financial, 100);
});

test("risk score is monotone in likelihood", () => {
  const low = score({ annualProbabilities: [0.01] });
  const high = score({ annualProbabilities: [0.6] });

  assert.ok(high.riskScore > low.riskScore);
  assert.equal(high.components.likelihood, 60);
});

test("likelihood uses the maximum class probability, not the average", () => {
  const spread = score({ annualProbabilities: [0.02, 0.4, 0.01] });
  assert.equal(spread.components.likelihood, 40);
});

test("risk score falls as control effectiveness rises", () => {
  const weak = score({ controlEffectiveness: 0.1 });
  const strong = score({ controlEffectiveness: 0.9 });

  assert.ok(strong.riskScore < weak.riskScore);
  assertClose(strong.components.controls, 10);
});

test("score is reconstructable from persisted components and weights", () => {
  const result = score({});
  const { financial, likelihood, controls } = parameters.riskScoreWeights;

  const reconstructed =
    financial * result.components.financial +
    likelihood * result.components.likelihood +
    controls * result.components.controls;

  assert.ok(Math.abs(reconstructed - result.riskScore) <= 0.5);
  assert.equal(result.riskScoreVersion, parameters.riskScoreVersion);
  assert.deepEqual(result.parameters.weights, { financial, likelihood, controls });
});

test("no modelled event class is disclosed rather than scored as zero risk", () => {
  const result = score({ annualProbabilities: [] });

  assert.equal(result.components.likelihood, 0);
  assert.ok(result.warnings.some((warning) => /insufficient|No event classes/i.test(warning)));
});

test("score is deterministic for identical inputs", () => {
  assert.deepEqual(score({}), score({}));
});
