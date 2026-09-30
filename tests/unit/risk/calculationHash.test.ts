/**
 * P1.3 — Calculation identity hash
 *
 * The calculation hash must depend on *how* a result was computed (engine,
 * parameters, model bundle, feature set, simulation config) as well as *what*
 * it was computed from (the input state hash).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  computeCalculationHash,
  calculationIdentityFromRun,
  type CalculationIdentity,
} from "../../../src/services/risk/calculationHash.service";

const baseIdentity: CalculationIdentity = {
  riskEngineVersion: "deterministic-baseline-v0",
  parameterVersion: "params-2026-09",
  modelBundleVersion: "deterministic-baseline-v0",
  featureSetVersion: "features-v1",
  simulationConfigVersion: "mc-config-v1",
  inputStateHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  scopeType: "ENTERPRISE",
  scopeId: "org_test_001",
};

test("computeCalculationHash is deterministic", () => {
  assert.equal(computeCalculationHash(baseIdentity), computeCalculationHash({ ...baseIdentity }));
});

test("computeCalculationHash changes when the engine version changes", () => {
  assert.notEqual(
    computeCalculationHash(baseIdentity),
    computeCalculationHash({ ...baseIdentity, riskEngineVersion: "risk-engine-v2.0" }),
  );
});

test("computeCalculationHash changes when the parameter version changes", () => {
  assert.notEqual(
    computeCalculationHash(baseIdentity),
    computeCalculationHash({ ...baseIdentity, parameterVersion: "params-2026-10" }),
  );
});

test("computeCalculationHash changes when the input state hash changes", () => {
  assert.notEqual(
    computeCalculationHash(baseIdentity),
    computeCalculationHash({
      ...baseIdentity,
      inputStateHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    }),
  );
});

test("computeCalculationHash changes when the simulation config changes", () => {
  assert.notEqual(
    computeCalculationHash(baseIdentity),
    computeCalculationHash({ ...baseIdentity, simulationConfigVersion: "mc-config-v2" }),
  );
});

test("calculationIdentityFromRun extracts only the deciding fields", () => {
  const identity = calculationIdentityFromRun({
    riskEngineVersion: "risk-engine-v2.0",
    parameterVersion: "params-2026-09",
    modelBundleVersion: "bundle-001",
    featureSetVersion: "features-v2",
    simulationConfigVersion: "mc-config-v1",
    inputStateHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    scopeType: "BUSINESS_UNIT",
    scopeId: "bu_test_001",
  });

  assert.deepEqual(identity, {
    riskEngineVersion: "risk-engine-v2.0",
    parameterVersion: "params-2026-09",
    modelBundleVersion: "bundle-001",
    featureSetVersion: "features-v2",
    simulationConfigVersion: "mc-config-v1",
    inputStateHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    scopeType: "BUSINESS_UNIT",
    scopeId: "bu_test_001",
  });
});
