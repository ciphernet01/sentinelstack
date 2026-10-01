/**
 * P4 — Scenario runner
 *
 * The point of P4 is that a what-if is answered by *recalculating*, not by
 * multiplying the baseline by a guess. These tests assert the recalculation
 * really happened, that improvements move risk in the right direction, and that
 * the delta arithmetic is honest about sign.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  computeDeltas,
  extractMetrics,
  runScenario,
  ScenarioNotApplicableError,
  type ScenarioMetrics,
} from "../../../src/services/scenario/scenarioRunner.service";
import type { ScenarioChange } from "../../../src/services/scenario/scenarioState.service";
import { calculateRisk } from "../../../src/services/risk/riskEngine.service";
import { buildEngineAsset, buildEngineContext } from "../../helpers/riskEngineFixture";

async function baseline() {
  const context = buildEngineContext([buildEngineAsset()]);
  const result = await calculateRisk(context);
  return { context, result };
}

function controlChange(newValue: number, id = "chg-c"): ScenarioChange {
  return {
    id,
    targetType: "ASSET_CONTROL",
    targetId: "ASSET-001/ctl-patch",
    fieldPath: "coverage",
    operation: "SET",
    newValue,
    sequence: 1,
  };
}

function patchChange(): ScenarioChange {
  return {
    id: "chg-v",
    targetType: "VULNERABILITY",
    targetId: "ASSET-001/vuln-001",
    fieldPath: "status",
    operation: "PATCH",
    newValue: "PATCHED",
    sequence: 1,
  };
}

// ── Delta arithmetic ───────────────────────────────────────────────────────

test("delta and riskReduction are sign-opposites of the same magnitude", () => {
  const before: ScenarioMetrics = {
    eal: 100, var95: 200, var99: 300, financialExposure: 400, riskScore: 50,
  };
  const after: ScenarioMetrics = {
    eal: 70, var95: 150, var99: 250, financialExposure: 350, riskScore: 35,
  };

  const { delta, riskReduction } = computeDeltas(before, after);

  // Spec §33: the signed delta and the named reduction are kept separate so the
  // direction is never lost.
  assert.equal(delta.eal, -30);
  assert.equal(riskReduction.eal, 30);
  assert.equal(delta.riskScore, -15);
  assert.equal(riskReduction.riskScore, 15);
});

test("an ineffective change yields zero delta, not a fabricated one", () => {
  const same: ScenarioMetrics = {
    eal: 100, var95: 200, var99: 300, financialExposure: 400, riskScore: 50,
  };
  const { delta, riskReduction } = computeDeltas(same, same);

  assert.equal(delta.eal, 0);
  assert.equal(riskReduction.eal, 0);
});

test("extractMetrics reads the five comparable metrics", () => {
  const result = extractMetrics({
    eal: 1, var95: 2, var99: 3, financialExposure: 4, riskScore: 5,
  } as never);

  assert.deepEqual(result, {
    eal: 1, var95: 2, var99: 3, financialExposure: 4, riskScore: 5,
  });
});

// ── Recalculation ──────────────────────────────────────────────────────────

test("raising control coverage reduces expected annual loss", async () => {
  const { context, result } = await baseline();

  const scenario = await runScenario({
    type: "CONTROL",
    baselineContext: context,
    baselineResult: result,
    changes: [controlChange(1)],
  });

  assert.ok(
    scenario.scenario.eal < scenario.baseline.eal,
    "stronger controls must produce a lower modelled EAL"
  );
  assert.equal(scenario.delta.eal, scenario.scenario.eal - scenario.baseline.eal);
  assert.ok(scenario.riskReduction.eal > 0);
  assert.ok(scenario.scenario.riskScore <= scenario.baseline.riskScore);
});

test("patching an exploitable finding reduces expected annual loss", async () => {
  const { context, result } = await baseline();

  const scenario = await runScenario({
    type: "VULNERABILITY_REMEDIATION",
    baselineContext: context,
    baselineResult: result,
    changes: [patchChange()],
  });

  assert.ok(scenario.scenario.eal < scenario.baseline.eal);
});

test("residual risk is the post-change figure, not the reduction", async () => {
  const { context, result } = await baseline();

  const scenario = await runScenario({
    type: "CONTROL",
    baselineContext: context,
    baselineResult: result,
    changes: [controlChange(1)],
  });

  // Spec §34: residual is what remains. Reporting the reduction here would read
  // as "risk is now ₹3.5M" when it is still ₹6.5M.
  assert.equal(scenario.residualRisk.eal, scenario.scenario.eal);
  assert.equal(scenario.residualRisk.var95, scenario.scenario.var95);
  assert.notEqual(scenario.residualRisk.eal, scenario.riskReduction.eal);
});

test("introducing exposure raises expected annual loss", async () => {
  const shieldedContext = buildEngineContext([buildEngineAsset({ internetExposed: false })]);
  const shieldedResult = await calculateRisk(shieldedContext);

  const scenario = await runScenario({
    type: "EXPOSURE",
    baselineContext: shieldedContext,
    baselineResult: shieldedResult,
    changes: [{
      id: "chg-e",
      targetType: "ASSET",
      targetId: "ASSET-001",
      fieldPath: "internetExposed",
      operation: "EXPOSE",
      newValue: true,
      sequence: 1,
    }],
  });

  assert.ok(scenario.scenario.eal > scenario.baseline.eal);
  assert.ok(scenario.delta.eal > 0);
});

test("the scenario carries its own identity, distinct from the baseline", async () => {
  const { context, result } = await baseline();

  const scenario = await runScenario({
    type: "CONTROL",
    baselineContext: context,
    baselineResult: result,
    changes: [controlChange(0.9)],
  });

  assert.match(scenario.scenarioStateHash, /^sha256:/);
  assert.notEqual(scenario.scenarioStateHash, context.inputStateHash);
  assert.equal(scenario.baselineResultHash, result.resultHash);
  assert.notEqual(scenario.scenarioResultHash, scenario.baselineResultHash);
});

test("the same scenario run twice produces identical figures", async () => {
  const { context, result } = await baseline();
  const changes = [controlChange(0.9)];

  const first = await runScenario({
    type: "CONTROL", baselineContext: context, baselineResult: result, changes,
  });
  const second = await runScenario({
    type: "CONTROL", baselineContext: context, baselineResult: result, changes,
  });

  assert.equal(first.scenarioStateHash, second.scenarioStateHash);
  assert.equal(first.scenarioResultHash, second.scenarioResultHash);
  assert.equal(first.scenario.eal, second.scenario.eal);
});

test("an invalid change refuses to run rather than running partially", async () => {
  const { context, result } = await baseline();

  await assert.rejects(
    () =>
      runScenario({
        type: "CONTROL",
        baselineContext: context,
        baselineResult: result,
        changes: [controlChange(1), { ...controlChange(2, "bad"), fieldPath: "notAField" }],
      }),
    ScenarioNotApplicableError,
    "a partially applied scenario must not produce a delta"
  );
});

test("a scenario with no applicable changes is refused", async () => {
  const { context, result } = await baseline();

  await assert.rejects(
    () =>
      runScenario({
        type: "CUSTOM",
        baselineContext: context,
        baselineResult: result,
        changes: [],
      }),
    ScenarioNotApplicableError
  );
});

test("a non-strict run reports the rejection rather than hiding it", async () => {
  const { context, result } = await baseline();

  const scenario = await runScenario({
    type: "CONTROL",
    baselineContext: context,
    baselineResult: result,
    changes: [controlChange(1), { ...controlChange(2, "bad"), fieldPath: "notAField" }],
    strict: false,
  });

  assert.equal(scenario.validationIssues.length, 1);
  assert.equal(scenario.appliedChanges.length, 1);
  assert.ok(scenario.warnings.some((warning) => /partially applied/i.test(warning)));
});

test("a scenario reports cost and avoided loss, never profit", async () => {
  const { context, result } = await baseline();

  const scenario = await runScenario({
    type: "CONTROL",
    baselineContext: context,
    baselineResult: result,
    changes: [controlChange(1)],
    cost: 500_000,
  });

  assert.equal(scenario.cost, 500_000);
  assert.equal(scenario.avoidedEal, scenario.riskReduction.eal);
  // Spec §34: avoided EAL is a modelled reduction, not a realised saving.
  assert.equal(Object.hasOwn(scenario, "profit"), false);
});

test("a stronger change yields a larger reduction than a weaker one", async () => {
  const { context, result } = await baseline();

  const weak = await runScenario({
    type: "CONTROL", baselineContext: context, baselineResult: result,
    changes: [controlChange(0.6)],
  });
  const strong = await runScenario({
    type: "CONTROL", baselineContext: context, baselineResult: result,
    changes: [controlChange(1)],
  });

  // Monotonicity: more control cannot produce less modelled benefit.
  assert.ok(strong.riskReduction.eal >= weak.riskReduction.eal);
});