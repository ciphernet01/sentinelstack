/**
 * P3 — Evidence model
 *
 * The properties that make evidence trustworthy: it is deduplicated, its
 * freshness is measured against the calculation's as-of (not wall clock), and
 * it can only ever *lower* a driver's confidence — never manufacture it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTRIBUTION_VERSION,
  EVIDENCE_FRESHNESS_DAYS,
  capConfidenceByEvidence,
  dedupeEvidence,
  evidenceForAsset,
  evidenceForCalculation,
  evidenceForTelemetry,
  evidenceSourceForTelemetry,
  reliabilityForSource,
  resolveEvidence,
  summariseEvidenceQuality,
  type EvidenceDraft,
  type ResolvedEvidence,
} from "../../../src/services/risk/evidence.service";
import { buildEngineAsset, buildTelemetry } from "../../helpers/riskEngineFixture";

const AS_OF = new Date(Date.UTC(2026, 8, 30));
const DAY = 24 * 60 * 60 * 1000;

function draft(overrides: Partial<EvidenceDraft> = {}): EvidenceDraft {
  return {
    sourceType: "EDR",
    sourceRecordId: "tel-1",
    canonicalEntityType: "ASSET",
    canonicalEntityId: "ASSET-001",
    observedAt: new Date(AS_OF.getTime() - 1 * DAY),
    reliability: "HIGH",
    ...overrides,
  };
}

test("fresh evidence inside its window is HIGH quality", () => {
  const resolved = resolveEvidence(draft(), AS_OF);

  assert.equal(resolved.isStale, false);
  assert.equal(resolved.quality, "HIGH");
  assert.equal(resolved.ageDays, 1);
  assert.match(resolved.evidenceHash, /^sha256:/);
});

test("evidence past its freshness window is stale and downgraded", () => {
  const window = EVIDENCE_FRESHNESS_DAYS.EDR;
  const resolved = resolveEvidence(
    draft({ observedAt: new Date(AS_OF.getTime() - (window + 1) * DAY) }),
    AS_OF
  );

  assert.equal(resolved.isStale, true);
  assert.equal(resolved.quality, "LOW");
});

test("freshness is measured against asOf, so a historical re-run is stable", () => {
  const first = resolveEvidence(draft(), AS_OF);
  const second = resolveEvidence(draft(), AS_OF);

  assert.equal(first.quality, second.quality);
  assert.equal(first.ageDays, second.ageDays);
  assert.equal(first.evidenceHash, second.evidenceHash);
});

test("evidence with no observation time is unavailable, not fresh", () => {
  const resolved = resolveEvidence(draft({ observedAt: undefined }), AS_OF);

  assert.equal(resolved.quality, "UNAVAILABLE");
  assert.equal(resolved.isStale, true);
});

test("dedupe keeps one record per source record", () => {
  const unique = dedupeEvidence([
    draft({ sourceRecordId: "a" }),
    draft({ sourceRecordId: "b" }),
    draft({ sourceRecordId: "a" }),
  ]);

  assert.equal(unique.length, 2);
  assert.deepEqual(
    unique.map((item) => item.sourceRecordId),
    ["a", "b"]
  );
});

test("telemetry sources map onto the governed evidence vocabulary", () => {
  assert.equal(evidenceSourceForTelemetry("EDR"), "EDR");
  assert.equal(evidenceSourceForTelemetry("VULNERABILITY_MANAGER"), "VULNERABILITY");
  assert.equal(evidenceSourceForTelemetry("IAM"), "IAM");
  assert.equal(evidenceSourceForTelemetry("CSPM"), "CSPM");
  // An unmapped source degrades to SIEM rather than being mislabelled.
  assert.equal(evidenceSourceForTelemetry("SOMETHING_NEW"), "SIEM");
});

test("reliability follows the source class, not the observation", () => {
  assert.equal(reliabilityForSource("VULNERABILITY"), "HIGH");
  assert.equal(reliabilityForSource("ASSET_INVENTORY"), "HIGH");
  assert.equal(reliabilityForSource("SIEM"), "MEDIUM");
});

test("evidence builders produce citable, entity-linked records", () => {
  const asset = buildEngineAsset();

  const inventory = evidenceForAsset(asset);
  assert.equal(inventory.sourceType, "ASSET_INVENTORY");
  assert.equal(inventory.canonicalEntityId, "ASSET-001");

  const telemetry = evidenceForTelemetry(asset, buildTelemetry("tel-9", 0));
  assert.equal(telemetry.sourceType, "EDR");
  assert.equal(telemetry.canonicalEntityId, "ASSET-001");
  assert.equal(telemetry.sourceRecordId, "tel-9");

  const calculation = evidenceForCalculation("run-1", "sha256:abc", "risk-engine-v2.0");
  assert.equal(calculation.sourceType, "CALCULATION");
  assert.equal(calculation.sourceVersion, "risk-engine-v2.0");
});

test("a driver with no evidence can never be HIGH confidence", () => {
  assert.equal(capConfidenceByEvidence("HIGH", []), "INSUFFICIENT");
  assert.equal(capConfidenceByEvidence("MEDIUM", []), "INSUFFICIENT");
});

test("stale evidence caps confidence at LOW", () => {
  const fresh: ResolvedEvidence = resolveEvidence(draft(), AS_OF);
  const stale: ResolvedEvidence = resolveEvidence(
    draft({ sourceRecordId: "tel-stale", observedAt: new Date(AS_OF.getTime() - 60 * DAY) }),
    AS_OF
  );

  assert.equal(capConfidenceByEvidence("HIGH", [fresh]), "HIGH");
  assert.equal(capConfidenceByEvidence("HIGH", [fresh, stale]), "LOW");
});

test("good evidence cannot raise confidence the method did not earn", () => {
  const fresh = resolveEvidence(draft(), AS_OF);
  assert.equal(capConfidenceByEvidence("LOW", [fresh]), "LOW");
  assert.equal(capConfidenceByEvidence("INSUFFICIENT", [fresh]), "INSUFFICIENT");
});

test("quality summary counts stale and unavailable evidence", () => {
  const summary = summariseEvidenceQuality([
    resolveEvidence(draft(), AS_OF),
    resolveEvidence(
      draft({ sourceRecordId: "old", observedAt: new Date(AS_OF.getTime() - 90 * DAY) }),
      AS_OF
    ),
    resolveEvidence(draft({ sourceRecordId: "none", observedAt: undefined }), AS_OF),
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.stale, 2);
  assert.equal(summary.unavailable, 1);
});

test("evidence quality never becomes a rupee amount", () => {
  // Freshness is expressed as a state, not as a numeric risk multiplier.
  const resolved = resolveEvidence(draft({ observedAt: undefined }), AS_OF);

  assert.equal(typeof resolved.quality, "string");
  assert.equal(
    (resolved as unknown as { contributionToEal?: number }).contributionToEal,
    undefined
  );
  assert.equal(ATTRIBUTION_VERSION, "driver-attribution-v1");
});