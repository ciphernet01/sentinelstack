/**
 * P4 — Scenario state resolver
 *
 * The two properties the spec calls critical (P4 §102, §103) are proved here:
 *
 *   No-mutation    — running a scenario must not alter the baseline.
 *   Reproducibility — the same scenario twice yields the same state hash.
 *
 * Plus the discipline that keeps a scenario honest: invalid changes are rejected
 * loudly rather than silently ignored, and a partially applied scenario says so.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveScenarioState,
  validateScenarioChanges,
  isScenarioApplicable,
  type ScenarioChange,
} from "../../../src/services/scenario/scenarioState.service";
import { calculateRisk } from "../../../src/services/risk/riskEngine.service";
import type { RiskAssetContext } from "../../../src/services/risk/riskCalculationContext";
import {
  buildControl,
  buildEngineAsset,
  buildEngineContext,
} from "../../helpers/riskEngineFixture";

function change(overrides: Partial<ScenarioChange> = {}): ScenarioChange {
  return {
    id: "chg-1",
    targetType: "ASSET_CONTROL",
    targetId: "ASSET-001/ctl-patch",
    fieldPath: "coverage",
    operation: "SET",
    newValue: 1,
    sequence: 1,
    ...overrides,
  };
}

function baseline() {
  return buildEngineContext([buildEngineAsset()]);
}

// ── Validation ─────────────────────────────────────────────────────────────

test("an unknown field path is rejected, not silently ignored", () => {
  const issues = validateScenarioChanges(
    baseline(),
    [change({ fieldPath: "nonexistentField", newValue: true })]
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "FIELD_NOT_MUTABLE");
});

test("a wrong value type is rejected", () => {
  const issues = validateScenarioChanges(baseline(), [change({ newValue: "almost" })]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "INVALID_TYPE");
});

test("an out-of-range numeric value is rejected", () => {
  const above = validateScenarioChanges(baseline(), [change({ newValue: 1.4 })]);
  const below = validateScenarioChanges(baseline(), [change({ newValue: -0.2 })]);

  assert.equal(above[0].code, "OUT_OF_RANGE");
  assert.equal(below[0].code, "OUT_OF_RANGE");
});

test("an invalid enum value is rejected", () => {
  const issues = validateScenarioChanges(
    baseline(),
    [change({ fieldPath: "status", newValue: "ALMOST_DONE" })]
  );

  assert.equal(issues[0].code, "INVALID_ENUM_VALUE");
});

test("a change targeting an asset that does not exist is rejected", () => {
  const issues = validateScenarioChanges(
    baseline(),
    [change({ targetId: "ASSET-NOPE/ctl-patch" })]
  );

  assert.equal(issues[0].code, "TARGET_NOT_FOUND");
});

test("a change targeting a control the asset does not have is rejected", () => {
  const issues = validateScenarioChanges(
    baseline(),
    [change({ targetId: "ASSET-001/ctl-nonexistent" })]
  );

  assert.equal(issues[0].code, "TARGET_NOT_FOUND");
});

test("every invalid change is reported, not just the first", () => {
  const issues = validateScenarioChanges(baseline(), [
    change({ id: "a", fieldPath: "nope" }),
    change({ id: "b", newValue: 5 }),
    change({ id: "c", targetId: "ASSET-NOPE/ctl-patch" }),
  ]);

  assert.equal(issues.length, 3);
  assert.deepEqual(issues.map((issue) => issue.changeId).sort(), ["a", "b", "c"]);
});

// ── Application semantics ──────────────────────────────────────────────────

test("a control coverage change moves the asset's control effectiveness", () => {
  const before = baseline();
  const { context } = resolveScenarioState(before, [change({ newValue: 1 })]);

  const beforeAsset = before.assets[0];
  const afterAsset = context.assets[0];

  assert.equal(afterAsset.controls[0].coverage, 1);
  // Derived, never set directly — otherwise a scenario could claim effectiveness
  // the underlying numbers do not support.
  assert.ok(afterAsset.controlEffectiveness > beforeAsset.controlEffectiveness);
});

test("patching a finding clears its exploitability", () => {
  const { context } = resolveScenarioState(baseline(), [
    change({
      targetType: "VULNERABILITY",
      targetId: "ASSET-001/vuln-001",
      fieldPath: "status",
      operation: "PATCH",
      newValue: "PATCHED",
    }),
  ]);

  const patched = context.assets[0].vulnerabilities[0];
  assert.equal(patched.status, "PATCHED");
  assert.equal(patched.exploitAvailable, false, "a patched finding must stop being exploitable");
  assert.equal(patched.patchAvailable, true);
});

test("INCREASE resolves against the current baseline value", () => {
  const before = baseline();
  const current = before.assets[0].controls[0].coverage;

  const { context } = resolveScenarioState(before, [
    change({ operation: "INCREASE", newValue: 0.25 }),
  ]);

  assert.ok(Math.abs(context.assets[0].controls[0].coverage - (current + 0.25)) < 1e-9);
});

test("changes apply in sequence order, not submission order", () => {
  // Two writes to the same field: the higher sequence must win.
  const resolved = resolveScenarioState(baseline(), [
    change({ id: "second", sequence: 2, newValue: 0.8 }),
    change({ id: "first", sequence: 1, newValue: 0.2 }),
  ]);

  assert.equal(resolved.context.assets[0].controls[0].coverage, 0.8);
});

test("a partially applied scenario is disclosed", () => {
  const resolved = resolveScenarioState(baseline(), [
    change({ id: "ok", newValue: 1 }),
    change({ id: "bad", fieldPath: "notAField" }),
  ]);

  assert.equal(resolved.applied.length, 1);
  assert.equal(resolved.issues.length, 1);
  assert.equal(isScenarioApplicable(resolved), false);
  assert.ok(resolved.warnings.some((warning) => /partially applied/i.test(warning)));
});

// ── P4 §102 No-mutation test ───────────────────────────────────────────────
// A scenario may read production state but must never modify it. This is a
// critical acceptance test.

test("applying a scenario does not mutate the baseline context", () => {
  const before = baseline();
  const fingerprint = () =>
    JSON.stringify({ assets: before.assets, dependencies: before.dependencies });
  const beforeFingerprint = fingerprint();

  const resolved = resolveScenarioState(before, [
    change({ id: "c1", targetType: "ASSET_CONTROL", targetId: "ASSET-001/ctl-patch", fieldPath: "coverage", newValue: 1, sequence: 1 }),
    change({ id: "c2", targetType: "VULNERABILITY", targetId: "ASSET-001/vuln-001", fieldPath: "status", operation: "PATCH", newValue: "PATCHED", sequence: 2 }),
    change({ id: "c3", targetType: "ASSET", targetId: "ASSET-001", fieldPath: "internetExposed", operation: "SET", newValue: false, sequence: 3 }),
  ]);

  assert.equal(resolved.issues.length, 0, "all three changes should apply cleanly");
  assert.equal(fingerprint(), beforeFingerprint, "the baseline must be byte-identical afterwards");
});

test("the baseline context is frozen, so an accidental write throws", () => {
  const before = baseline();
  resolveScenarioState(before, [change()]);

  assert.throws(() => {
    (before.assets as unknown as RiskAssetContext[])[0] = before.assets[0];
  }, TypeError, "frozen baseline must reject mutation");
});

test("re-running a scenario lands in the same state, it does not compound", () => {
  const before = baseline();
  const first = resolveScenarioState(before, [change({ newValue: 0.1 })]);
  const second = resolveScenarioState(before, [change({ newValue: 0.1 })]);

  assert.equal(
    second.context.assets[0].controls[0].coverage,
    first.context.assets[0].controls[0].coverage
  );
  assert.equal(second.scenarioStateHash, first.scenarioStateHash);
});

// ── P4 §103 Reproducibility test ───────────────────────────────────────────

test("the same scenario resolves to the same state hash", () => {
  const changes = [
    change({ id: "a", newValue: 0.9, sequence: 1 }),
    change({ id: "b", targetType: "ASSET", targetId: "ASSET-001", fieldPath: "internetExposed", newValue: false, sequence: 2 }),
  ];

  const first = resolveScenarioState(baseline(), changes);
  const second = resolveScenarioState(baseline(), changes);

  assert.equal(first.scenarioStateHash, second.scenarioStateHash);
  assert.match(first.scenarioStateHash, /^sha256:/);
});

test("submission order does not change the state hash", () => {
  const forward = [
    change({ id: "a", sequence: 1, newValue: 0.3 }),
    change({ id: "b", sequence: 2, newValue: 0.7 }),
  ];

  const a = resolveScenarioState(baseline(), forward);
  const b = resolveScenarioState(baseline(), [...forward].reverse());

  assert.equal(a.scenarioStateHash, b.scenarioStateHash);
});

test("a materially different scenario produces a different state hash", () => {
  const a = resolveScenarioState(baseline(), [change({ newValue: 0.3 })]);
  const b = resolveScenarioState(baseline(), [change({ newValue: 0.9 })]);

  assert.notEqual(a.scenarioStateHash, b.scenarioStateHash);
});

test("the scenario state hash replaces the baseline input hash", () => {
  const before = baseline();
  const resolved = resolveScenarioState(before, [change()]);

  assert.notEqual(resolved.scenarioStateHash, before.inputStateHash);
  assert.equal(resolved.context.inputStateHash, resolved.scenarioStateHash);
});

test("a scenario with no changes is not applicable", () => {
  assert.equal(isScenarioApplicable(resolveScenarioState(baseline(), [])), false);
});