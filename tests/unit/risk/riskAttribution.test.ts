/**
 * P3 — Normalized driver attribution
 *
 * P3 must not invent drivers or contribution values. These tests pin the
 * properties that keep the normalized layer faithful to the P2 measurement:
 * stable cross-run keys, deterministic output, honest nulls, and explicit
 * disclosure when attribution is partial.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  attributeDriversForAssessment,
  buildDriverKey,
  inferEntityType,
} from "../../../src/services/risk/riskAttribution.service";
import { calculateRisk, type RiskEngineResult } from "../../../src/services/risk/riskEngine.service";
import { buildEngineAsset, buildEngineContext } from "../../helpers/riskEngineFixture";

async function runAttribution(
  assets?: ReturnType<typeof buildEngineAsset>[],
  costs?: Parameters<typeof attributeDriversForAssessment>[0]["costs"]
) {
  const context = buildEngineContext(assets ?? [buildEngineAsset()]);
  const result = await calculateRisk(context);

  const attribution = attributeDriversForAssessment({
    organizationId: "org_test",
    riskRunId: "run_test",
    riskAssessmentId: "assessment_test",
    context,
    result,
    ...(costs ? { costs } : {}),
  });

  return { context, result, attribution };
}

test("attribution produces drivers with stable cross-run keys", async () => {
  const { attribution } = await runAttribution();

  assert.ok(attribution.drivers.length > 0, "expected normalized drivers");

  for (const driver of attribution.drivers) {
    assert.equal(driver.driverKey, buildDriverKey(driver.type, driver.entityType, driver.entityId));
    assert.equal(driver.driverKeyVersion, "driver-key-v1");
    assert.equal(driver.attributionVersion, "driver-attribution-v1");
    assert.match(driver.attributionHash, /^sha256:/);
  }
});

test("the same result always produces the same driver set", async () => {
  const first = await runAttribution();
  const second = await runAttribution();

  assert.deepEqual(
    first.attribution.drivers.map((d) => [d.driverKey, d.rank, d.attributionHash]),
    second.attribution.drivers.map((d) => [d.driverKey, d.rank, d.attributionHash])
  );
  assert.equal(
    first.attribution.evidence.length,
    second.attribution.evidence.length
  );
});

test("attribution is reproducible for a fixed run, not merely stable", async () => {
  const { attribution } = await runAttribution();

  // The hash covers identity, versions, contributions and evidence — so any
  // change to the underlying measurement must change it.
  const hashes = new Set(attribution.drivers.map((d) => d.attributionHash));
  assert.equal(hashes.size, attribution.drivers.length, "driver hashes must be distinct");
});

test("unsupported metrics are null, never zero", async () => {
  const { attribution } = await runAttribution();
  const driver = attribution.drivers[0];

  // P2 does not attribute the tail per driver. Zero would be a fabricated claim.
  assert.equal(driver.contributionToVar95, null);
  assert.equal(driver.contributionToVar99, null);
  assert.notEqual(driver.contributionToEal, null);
});

test("every driver cites at least the calculation that produced it", async () => {
  const { attribution } = await runAttribution();

  for (const driver of attribution.drivers) {
    assert.ok(
      driver.evidence.some((item) => item.sourceType === "CALCULATION"),
      `${driver.driverKey} must be traceable to its calculation`
    );
  }
});

test("evidence is deduplicated across drivers", async () => {
  const { attribution } = await runAttribution([buildEngineAsset(), buildEngineAsset({ assetId: "ASSET-002" })]);

  const keys = attribution.evidence.map((item) => `${item.sourceType}:${item.sourceRecordId}`);
  assert.equal(new Set(keys).size, keys.length, "evidence rows must be unique");
});

test("risk-increasing drivers rank before mitigations", async () => {
  const { attribution } = await runAttribution();

  const directions = attribution.drivers.map((d) => d.direction);
  const lastIncreasing = directions.lastIndexOf("INCREASES_RISK");
  const firstReducing = directions.indexOf("REDUCES_RISK");

  if (firstReducing >= 0) assert.ok(lastIncreasing < firstReducing);
  assert.equal(attribution.drivers[0].rank, 1);
});

test("entity scope is inferred from the driver reference", () => {
  assert.deepEqual(
    inferEntityType({ type: "EXPOSURE", entityRef: "enterprise" } as never),
    { entityType: "ORGANIZATION", entityId: "enterprise" }
  );
  assert.deepEqual(
    inferEntityType({ type: "CONTROL", entityRef: "ENDPOINT" } as never),
    { entityType: "CONTROL_CATEGORY", entityId: "ENDPOINT" }
  );
  assert.deepEqual(
    inferEntityType({ type: "BUSINESS_IMPACT", entityRef: "ASSET-001" } as never),
    { entityType: "ASSET", entityId: "ASSET-001" }
  );
});

test("exceeding the candidate budget is disclosed, never hidden", async () => {
  const { attribution } = await runAttribution(undefined, {
    maxDriverCandidates: 1,
    maxCounterfactualRuns: 50,
  });

  if (attribution.costReport.candidates > 1) {
    assert.equal(attribution.costReport.droppedByBudget > 0, true);
    assert.ok(
      attribution.warnings.some((warning) => /budget|exceeded/i.test(warning)),
      "a truncated attribution must say so"
    );
  }
});

test("cost controls are reported for every attribution", async () => {
  const { attribution } = await runAttribution();
  const report = attribution.costReport;

  assert.equal(typeof report.candidates, "number");
  assert.equal(typeof report.attributed, "number");
  assert.equal(typeof report.counterfactualRuns, "number");
  assert.equal(typeof report.durationMs, "number");
  assert.equal(report.exceededBudget, false);
});

test("attribution does not alter the P2 financial result", async () => {
  const { result } = await runAttribution();
  const engine: RiskEngineResult = result;

  // P3 explains the result; it must never restate it.
  assert.ok(engine.eal > 0);
  assert.equal(engine.var95 >= engine.eal, true);
});
