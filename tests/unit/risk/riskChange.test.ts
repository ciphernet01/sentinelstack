/**
 * P3 — Risk change attribution
 *
 * Drivers must be matched on their stable key, not on id or rank, and a model
 * or parameter version change must never be reported as an environmental one.
 * These are the two ways a "why did risk change?" answer silently lies.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  collectVersionChanges,
  diffDrivers,
  type DriverChange,
} from "../../../src/services/risk/riskChange.service";

type Row = {
  driverKey: string;
  type: string;
  name: string;
  direction: string;
  confidence: string;
  contributionToEal: number | null;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    driverKey: "VULNERABILITY:ASSET:ASSET-001",
    type: "VULNERABILITY",
    name: "Exploitable vulnerability",
    direction: "INCREASES_RISK",
    confidence: "HIGH",
    contributionToEal: 1_000_000,
    ...overrides,
  };
}

function byKey(changes: DriverChange[], key: string): DriverChange {
  const found = changes.find((change) => change.driverKey === key);
  assert.ok(found, `expected a change for ${key}`);
  return found!;
}

const VERSIONS = {
  riskEngineVersion: "risk-engine-v2.0",
  parameterVersion: "params-2026-09",
  modelBundleVersion: "deterministic-baseline-v0",
  simulationConfigVersion: "mc-config-v2",
  featureSetVersion: "features-v1",
};

test("a driver present in both runs is matched, not reported as NEW", () => {
  const changes = diffDrivers([row()], [row()]);

  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, "UNCHANGED");
  assert.equal(changes[0].contributionDelta, 0);
});

test("a rising contribution is INCREASED, a falling one DECREASED", () => {
  const up = diffDrivers([row({ contributionToEal: 1_000_000 })], [row({ contributionToEal: 3_000_000 })]);
  const down = diffDrivers([row({ contributionToEal: 3_000_000 })], [row({ contributionToEal: 1_000_000 })]);

  assert.equal(byKey(up, "VULNERABILITY:ASSET:ASSET-001").changeType, "INCREASED");
  assert.equal(byKey(up, "VULNERABILITY:ASSET:ASSET-001").contributionDelta, 2_000_000);
  assert.equal(byKey(down, "VULNERABILITY:ASSET:ASSET-001").changeType, "DECREASED");
  assert.equal(byKey(down, "VULNERABILITY:ASSET:ASSET-001").contributionDelta, -2_000_000);
});

test("a driver only in the current run is NEW", () => {
  const changes = diffDrivers([], [row({ driverKey: "EXPOSURE:ORGANIZATION:enterprise" })]);

  assert.equal(changes[0].changeType, "NEW");
  assert.equal(changes[0].previousContributionToEal, null);
  assert.equal(changes[0].contributionDelta, 1_000_000);
});

test("a driver only in the previous run is REMOVED and its loss is given back", () => {
  const changes = diffDrivers([row({ contributionToEal: 750_000 })], []);

  assert.equal(changes[0].changeType, "REMOVED");
  assert.equal(changes[0].currentContributionToEal, null);
  assert.equal(changes[0].contributionDelta, -750_000);
});

test("sub-epsilon movement is noise from a re-run, not a real change", () => {
  const changes = diffDrivers(
    [row({ contributionToEal: 1_000_000 })],
    [row({ contributionToEal: 1_000_000.4 })]
  );

  assert.equal(changes[0].changeType, "UNCHANGED");
});

test("a confidence drop is reported even when the number held steady", () => {
  const changes = diffDrivers(
    [row({ confidence: "HIGH" })],
    [row({ confidence: "LOW" })]
  );

  assert.equal(changes[0].changeType, "UNCHANGED");
  assert.equal(changes[0].confidenceChanged, true);
});

test("a null contribution is not treated as a movement to or from zero", () => {
  const changes = diffDrivers(
    [row({ contributionToEal: null })],
    [row({ contributionToEal: 500_000 })]
  );

  assert.equal(changes[0].contributionDelta, null);
  assert.equal(changes[0].changeType, "UNCHANGED");
});

test("identical versions produce no change entries", () => {
  const changes = collectVersionChanges(VERSIONS, VERSIONS);

  assert.deepEqual(changes.modelChanges, []);
  assert.deepEqual(changes.parameterChanges, []);
  assert.deepEqual(changes.simulationChanges, []);
});

test("a model version change is reported as a model change, not a parameter one", () => {
  const changes = collectVersionChanges(VERSIONS, {
    ...VERSIONS,
    modelBundleVersion: "risk-model-v1",
  });

  assert.equal(changes.modelChanges.length, 1);
  assert.equal(changes.modelChanges[0].field, "modelBundleVersion");
  assert.deepEqual(changes.parameterChanges, []);
  assert.deepEqual(changes.simulationChanges, []);
});

test("an engine version change is treated as a model change", () => {
  const changes = collectVersionChanges(VERSIONS, {
    ...VERSIONS,
    riskEngineVersion: "risk-engine-v3.0",
  });

  assert.equal(changes.modelChanges.length, 1);
  assert.equal(changes.modelChanges[0].field, "riskEngineVersion");
});

test("parameter and simulation drift are reported in separate categories", () => {
  const changes = collectVersionChanges(VERSIONS, {
    ...VERSIONS,
    parameterVersion: "params-2027-01",
    simulationConfigVersion: "mc-config-v3",
  });

  assert.equal(changes.parameterChanges.length, 1);
  assert.equal(changes.parameterChanges[0].current, "params-2027-01");
  assert.equal(changes.simulationChanges.length, 1);
  assert.equal(changes.simulationChanges[0].field, "simulationConfigVersion");
  assert.deepEqual(changes.modelChanges, []);
});

test("a missing run record yields no version claims rather than guesses", () => {
  const changes = collectVersionChanges(VERSIONS, null);

  assert.deepEqual(changes.modelChanges, []);
  assert.deepEqual(changes.parameterChanges, []);
  assert.deepEqual(changes.simulationChanges, []);
});