/**
 * P1.8 / P1.13 — Risk response contract
 *
 * Locks the additive response shape that existing UI clients depend on:
 *   • the legacy enterprise payload keys stay present
 *   • the `_provenance` envelope exposes exactly the documented fields
 *   • the coverage-state contract is stable
 *
 * These assertions are database-free: the envelope and coverage builders are
 * pure functions, so the contract is verifiable in CI without Postgres.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildProvenanceEnvelope } from "../../../src/services/risk/provenanceEnvelope";
import { buildCoverageState } from "../../../src/services/risk/evidenceContext.service";
import contract from "../../fixtures/risk/expected-risk-input.json";
import assetFixture from "../../fixtures/risk/assets.json";
import vulnerabilityFixture from "../../fixtures/risk/vulnerabilities.json";
import controlFixture from "../../fixtures/risk/controls.json";
import telemetryFixture from "../../fixtures/risk/telemetry.json";

const riskRun = {
  id: "run_test_001",
  asOf: new Date("2026-09-29T10:00:00.000Z"),
  riskEngineVersion: "deterministic-baseline-v0",
  parameterVersion: "params-2026-09",
  modelBundleVersion: "deterministic-baseline-v0",
  featureSetVersion: "features-v1",
  simulationConfigVersion: "mc-config-v1",
  inputStateHash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
};

const assessment = {
  id: "assessment_test_001",
  computedAt: new Date("2026-09-29T10:00:05.000Z"),
  resultHash: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
};

const coverageState = buildCoverageState({
  assetCount: assetFixture.assets.length,
  vulnerabilityCount: vulnerabilityFixture.vulnerabilities.length,
  controlCount: controlFixture.assetControls.length,
  telemetryEventCount: telemetryFixture.telemetry.length,
});

test("the _provenance envelope exposes exactly the contracted keys", () => {
  const envelope = buildProvenanceEnvelope({
    riskRun,
    assessment,
    coverageState,
    calculationHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    riskScore: 72,
  });

  assert.deepEqual(
    Object.keys(envelope).sort(),
    [...contract.expectedProvenanceKeys].sort(),
  );
});

test("the coverage-state contract is stable", () => {
  assert.deepEqual(
    Object.keys(coverageState).sort(),
    [...contract.expectedCoverageStateKeys].sort(),
  );
});

test("provenance timestamps are ISO-8601 UTC strings", () => {
  const envelope = buildProvenanceEnvelope({
    riskRun,
    assessment,
    coverageState,
    calculationHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    riskScore: 72,
  });

  assert.equal(envelope.computedAt, "2026-09-29T10:00:05.000Z");
  assert.equal(envelope.asOf, "2026-09-29T10:00:00.000Z");
  assert.equal(new Date(envelope.asOf).toISOString(), envelope.asOf);
});

test("every persisted version string is surfaced to the client", () => {
  const envelope = buildProvenanceEnvelope({
    riskRun,
    assessment,
    coverageState,
    calculationHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    riskScore: 72,
  });

  assert.equal(envelope.riskEngineVersion, riskRun.riskEngineVersion);
  assert.equal(envelope.parameterVersion, riskRun.parameterVersion);
  assert.equal(envelope.modelBundleVersion, riskRun.modelBundleVersion);
  assert.equal(envelope.featureSetVersion, riskRun.featureSetVersion);
  assert.equal(envelope.simulationConfigVersion, riskRun.simulationConfigVersion);
  assert.equal(envelope.inputStateHash, riskRun.inputStateHash);
  assert.equal(envelope.resultHash, assessment.resultHash);
});

test("an unfinished result is represented by a null result hash", () => {
  const envelope = buildProvenanceEnvelope({
    riskRun,
    assessment: { ...assessment, resultHash: null },
    coverageState,
    calculationHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    riskScore: 0,
  });

  assert.equal(envelope.resultHash, null);
});

test("coverage flags are derived correctly from counts", () => {
  const full = buildCoverageState({
    assetCount: 3,
    vulnerabilityCount: 5,
    controlCount: 5,
    telemetryEventCount: 5,
  });
  assert.equal(full.hasTelemetry, true);
  assert.equal(full.hasVulnerabilities, true);
  assert.equal(full.hasControls, true);

  const empty = buildCoverageState({
    assetCount: 0,
    vulnerabilityCount: 0,
    controlCount: 0,
    telemetryEventCount: 0,
  });
  assert.equal(empty.hasTelemetry, false);
  assert.equal(empty.hasVulnerabilities, false);
  assert.equal(empty.hasControls, false);
});

test("the legacy enterprise payload contract lists the required top-level keys", () => {
  // Guards against silently removing a field existing dashboards read.
  const required = [
    "computedAt",
    "totals",
    "topRiskDrivers",
    "recommendations",
    "optimization",
    "scenarios",
    "assumptions",
    "_provenance",
  ];

  for (const key of required) {
    assert.ok(
      (contract.expectedTopLevelKeys as string[]).includes(key),
      `contract is missing legacy top-level key: ${key}`,
    );
  }
});
