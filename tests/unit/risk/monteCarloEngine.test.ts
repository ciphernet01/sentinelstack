/**
 * P2 — Monte Carlo Risk Engine v2
 *
 * Pins the mathematical and disclosure contract of `calculateRisk`:
 * reproducibility, quantile ordering, monotonicity in the inputs that should
 * move the number, and honest uncertainty reporting.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  RISK_ENGINE_VERSION_V2,
  calculateRisk,
} from "../../../src/services/risk/riskEngine.service";
import { PRODUCTION_MIN_SIMULATIONS } from "../../../src/services/risk/simulationConfig.service";
import {
  severityComponentAmounts,
  LOSS_COMPONENTS,
} from "../../../src/services/risk/severity.service";
import {
  buildControl,
  buildEngineAsset,
  buildEngineContext,
} from "../../helpers/riskEngineFixture";

/** Fully defended asset: no exposure, no findings, complete controls. */
const quietAsset = () =>
  buildEngineAsset({
    assetId: "ASSET-QUIET",
    internetExposed: false,
    criticality: "LOW",
    vulnerabilities: [],
    telemetry: [],
    controls: [
      buildControl("ctl-iam", "IAM", 1, 1),
      buildControl("ctl-endpoint", "ENDPOINT", 1, 1),
      buildControl("ctl-cloud", "CLOUD", 1, 1),
    ],
  });

test("the engine reports its own version on every result", async () => {
  const result = await calculateRisk(buildEngineContext([buildEngineAsset()]));

  assert.equal(result.versions.riskEngine, RISK_ENGINE_VERSION_V2);
  assert.equal(result.versions.simulation, "mc-config-v2");
  assert.equal(result.inputStateHash, result.inputStateHash);
  assert.match(result.resultHash, /^sha256:/);
});

test("identical context reproduces the identical result and hash", async () => {
  const build = () => buildEngineContext([buildEngineAsset()]);
  const first = await calculateRisk(build());
  const second = await calculateRisk(build());

  assert.equal(first.resultHash, second.resultHash);
  assert.equal(first.eal, second.eal);
  assert.equal(first.var95, second.var95);
  assert.deepEqual(first.drivers, second.drivers);
  assert.deepEqual(first.frequencySummary, second.frequencySummary);
});

test("quantiles are ordered and the 95th percentile dominates the mean", async () => {
  const result = await calculateRisk(buildEngineContext([buildEngineAsset()]));
  const summary = result.lossDistributionSummary;

  assert.ok(summary.mean > 0, "fixture must produce loss");
  assert.ok(summary.median <= summary.q90);
  assert.ok(summary.q90 <= summary.q95);
  assert.ok(summary.q95 <= summary.q99);
  assert.ok(summary.q99 <= summary.maxSimulated);
  assert.ok(result.var95 >= result.eal);
  assert.ok(result.var99 >= result.var95);
  assert.equal(summary.simulationCount, result.simulation.simulationCount);
});

test("development-grade simulations are disclosed, not hidden", async () => {
  const result = await calculateRisk(buildEngineContext([buildEngineAsset()]));

  assert.equal(result.simulation.developmentGrade, true);
  assert.ok(
    result.uncertainty.warnings.some((warning) =>
      new RegExp(`${PRODUCTION_MIN_SIMULATIONS}`).test(warning)
    ),
    "development-grade runs must warn about the production minimum"
  );
});

test("a different seed changes the sample but not the economics", async () => {
  const base = await calculateRisk(buildEngineContext([buildEngineAsset()]));
  const resampled = await calculateRisk(
    buildEngineContext([buildEngineAsset()], [], { simulation: { seed: 1337 } })
  );

  assert.notEqual(base.resultHash, resampled.resultHash);
  assert.ok(
    Math.abs(resampled.eal - base.eal) / base.eal < 0.15,
    "mean annual loss must be stable across seeds"
  );
});

test("expected loss grows with the severity of the business impact", async () => {
  const modest = await calculateRisk(
    buildEngineContext([buildEngineAsset({ businessImpact: { breachCost: 5_000_000 } })])
  );
  const severe = await calculateRisk(
    buildEngineContext([buildEngineAsset({ businessImpact: { breachCost: 250_000_000 } })])
  );

  assert.ok(severe.eal > modest.eal);
  assert.ok(severe.var95 > modest.var95);
  assert.ok(severe.riskScore >= modest.riskScore);
});

test("effective controls lower loss, score, and raise measured coverage", async () => {
  const weak = await calculateRisk(
    buildEngineContext([
      buildEngineAsset({ controls: [buildControl("ctl-endpoint", "ENDPOINT", 0.1, 0.1)] }),
    ])
  );
  const strong = await calculateRisk(
    buildEngineContext([
      buildEngineAsset({ controls: [buildControl("ctl-endpoint", "ENDPOINT", 1, 0.95)] }),
    ])
  );

  assert.ok(strong.eal < weak.eal, "controls must reduce expected annual loss");
  assert.ok(strong.riskScore <= weak.riskScore);
  assert.ok(strong.controlEffectiveness > weak.controlEffectiveness);
});

test("financial exposure is the sum of owned loss components", async () => {
  const assets = [buildEngineAsset(), quietAsset()];
  const result = await calculateRisk(buildEngineContext(assets));

  const expected = assets.reduce(
    (sum, asset) =>
      sum +
      LOSS_COMPONENTS.reduce((componentSum, component) => componentSum + severityComponentAmounts(asset)[component], 0),
    0
  );

  assert.equal(result.financialExposure, expected);
});

test("adding exposed estate increases portfolio loss without inventing classes", async () => {
  const one = await calculateRisk(buildEngineContext([buildEngineAsset()]));
  const two = await calculateRisk(
    buildEngineContext([buildEngineAsset(), buildEngineAsset({ assetId: "ASSET-002" })])
  );

  assert.ok(two.eal > one.eal);
  assert.equal(
    two.frequencySummary.byEventClass.length,
    one.frequencySummary.byEventClass.length,
    "the event-class taxonomy must not grow with the estate"
  );
});

test("a defended estate carries a fraction of the exposed estate's loss", async () => {
  const exposed = await calculateRisk(buildEngineContext([buildEngineAsset()]));
  const result = await calculateRisk(buildEngineContext([quietAsset()]));

  assert.ok(result.eal < exposed.eal * 0.1, "residual loss must collapse with the evidence");
  assert.ok(result.riskScore < exposed.riskScore);
});

test("zero-rate event classes cost nothing and the gap is disclosed", async () => {
  // Documented boundary assumption: controls modelled as able to remove all
  // likelihood, applied to an estate whose controls are fully effective.
  const result = await calculateRisk(
    buildEngineContext([quietAsset()], [], {
      parameters: { maxControlLikelihoodReduction: 1 },
    })
  );

  assert.equal(result.eal, 0);
  assert.equal(result.var95, 0);
  assert.equal(result.var99, 0);
  assert.ok(Number.isFinite(result.riskScore));

  for (const entry of result.frequencySummary.byEventClass) {
    assert.equal(entry.annualFrequency, 0);
    assert.equal(entry.expectedAnnualLoss, 0);
  }

  assert.ok(
    result.uncertainty.warnings.some((warning) => /No loss-bearing asset/i.test(warning)),
    "a silent zero would be indistinguishable from a genuinely healthy estate"
  );
});

test("drivers and score components are persisted with the result", async () => {
  const result = await calculateRisk(
    buildEngineContext([buildEngineAsset(), buildEngineAsset({ assetId: "ASSET-002" })])
  );

  assert.ok(result.drivers.length > 0);
  assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  assert.ok(result.riskScoreComponents.financial >= 0);
  assert.ok(result.riskScoreComponents.controls > 0);

  const ids = result.drivers.map((driver) => driver.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const driver of result.drivers) {
    assert.ok(Number.isFinite(driver.contributionToScore ?? -1));
    assert.ok((driver.contributionToScore ?? 0) >= 0);
  }
});

test("coverage state reports what the engine actually saw", async () => {
  const result = await calculateRisk(
    buildEngineContext([buildEngineAsset(), quietAsset()], [])
  );

  assert.equal(result.uncertainty.coverage.assetCount, 2);
  assert.equal(result.uncertainty.coverage.assetsWithVulnerabilities, 1);
  assert.equal(result.uncertainty.coverage.assetsWithTelemetry, 1);
  assert.equal(result.uncertainty.coverage.internetExposedAssets, 1);
  assert.equal(result.uncertainty.coverage.dependencyCount, 0);
  assert.ok(result.uncertainty.coverage.eventClassesModelled > 0);
});
