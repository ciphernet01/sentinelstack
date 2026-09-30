/**
 * P0.4 / P1.4 — Canonical hash determinism
 *
 * Proves the two properties the runbook requires:
 *   • identical input bundle  -> identical hash  (reproducibility)
 *   • one material change     -> different hash  (integrity)
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  hashRiskInput,
  hashRiskResult,
  type RiskInputBundle,
} from "../../../src/services/provenance/canonicalHash.service";
import { buildFixtureBundle, cloneBundle } from "../../helpers/riskFixture";

// ---------------------------------------------------------------------------
// Input bundle hashing
// ---------------------------------------------------------------------------

test("hashRiskInput is deterministic for identical bundles", () => {
  const a = buildFixtureBundle();
  const b = buildFixtureBundle();

  assert.equal(hashRiskInput(a), hashRiskInput(b));
});

test("hashRiskInput is insensitive to object key ordering", () => {
  const bundle = buildFixtureBundle();

  // Rebuild every object with reversed key insertion order.
  const reverseKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const entries = Object.entries(value as Record<string, unknown>).reverse();
      return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
        acc[key] = reverseKeys(val);
        return acc;
      }, {});
    }
    return value;
  };

  const reordered = reverseKeys(bundle) as RiskInputBundle;

  assert.equal(hashRiskInput(bundle), hashRiskInput(reordered));
});

test("hashRiskInput matches the golden fixture hash", () => {
  const bundle = buildFixtureBundle();
  // Golden value lives in tests/fixtures/risk/expected-risk-input.json so that
  // an accidental change to canonicalisation is caught immediately.
  const expected = require("../../fixtures/risk/expected-risk-input.json");
  assert.equal(hashRiskInput(bundle), expected.expected.inputStateHash);
});

test("hashRiskInput changes when a material asset value changes", () => {
  const baseline = buildFixtureBundle();
  const mutated = buildFixtureBundle({
    mutate: (bundle) => {
      const next = cloneBundle(bundle);
      next.assets[0].downtimeCostPerHourInr = "9999999";
      return next;
    },
  });

  assert.notEqual(hashRiskInput(baseline), hashRiskInput(mutated));
});

test("hashRiskInput changes when the as-of timestamp changes", () => {
  const baseline = buildFixtureBundle();
  const later = buildFixtureBundle({ asOf: "2026-09-30T10:00:00.000Z" });

  assert.notEqual(hashRiskInput(baseline), hashRiskInput(later));
});

test("hashRiskInput changes when a model/parameter version changes", () => {
  const baseline = buildFixtureBundle();
  const nextParams = buildFixtureBundle({ parameterVersion: "params-2026-10" });

  assert.notEqual(hashRiskInput(baseline), hashRiskInput(nextParams));
});

test("hashRiskInput output is a sha256-prefixed hex digest", () => {
  const hash = hashRiskInput(buildFixtureBundle());

  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
});

test("hashRiskInput is insensitive to date-vs-string timestamp representation", () => {
  const bundle = buildFixtureBundle();
  const fromDates = buildFixtureBundle({
    mutate: (input) => {
      const next = cloneBundle(input);
      next.asOf = new Date(next.asOf).toISOString();
      next.vulnerabilities = next.vulnerabilities.map((v) => ({
        ...v,
        firstSeenAt: new Date(v.firstSeenAt).toISOString(),
      }));
      return next;
    },
  });

  assert.equal(hashRiskInput(bundle), hashRiskInput(fromDates));
});

// ---------------------------------------------------------------------------
// Result hashing / value normalisation
// ---------------------------------------------------------------------------

test("hashRiskResult normalises BigInt and Date values", () => {
  const fromPrimitives = {
    amount: 12345678901234567890n,
    at: new Date("2026-09-29T10:00:00.000Z"),
  };
  const fromStrings = {
    amount: "12345678901234567890",
    at: "2026-09-29T10:00:00.000Z",
  };

  assert.equal(hashRiskResult(fromPrimitives), hashRiskResult(fromStrings));
});

test("hashRiskResult ignores floating-point noise beyond 10 significant figures", () => {
  const a = hashRiskResult({ likelihood: 0.123456789012345 });
  const b = hashRiskResult({ likelihood: 0.123456789019999 });

  assert.equal(a, b);
});

test("hashRiskResult changes for a materially different result", () => {
  const a = hashRiskResult({ expectedAnnualLossInr: 1000 });
  const b = hashRiskResult({ expectedAnnualLossInr: 1001 });

  assert.notEqual(a, b);
});
