/**
 * P1.10 — RiskRun state machine
 *
 *   QUEUED -> RUNNING
 *   RUNNING -> SUCCEEDED | FAILED
 *   SUCCEEDED -> STALE
 *
 * No other transition may be performed, and completed runs are never
 * silently overwritten.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  RISK_RUN_TRANSITIONS,
  assertValidTransition,
} from "../../../src/services/risk/riskRun.service";
import { InvalidStateTransitionError } from "../../../src/services/risk/errors";

test("the legal transitions are exactly the documented ones", () => {
  assert.deepEqual(RISK_RUN_TRANSITIONS.QUEUED, ["RUNNING"]);
  assert.deepEqual(RISK_RUN_TRANSITIONS.RUNNING, ["SUCCEEDED", "FAILED"]);
  assert.deepEqual(RISK_RUN_TRANSITIONS.SUCCEEDED, ["STALE"]);
  assert.deepEqual(RISK_RUN_TRANSITIONS.FAILED, []);
  assert.deepEqual(RISK_RUN_TRANSITIONS.STALE, []);
});

test("legal transitions do not throw", () => {
  assert.doesNotThrow(() => assertValidTransition("QUEUED", "RUNNING"));
  assert.doesNotThrow(() => assertValidTransition("RUNNING", "SUCCEEDED"));
  assert.doesNotThrow(() => assertValidTransition("RUNNING", "FAILED"));
  assert.doesNotThrow(() => assertValidTransition("SUCCEEDED", "STALE"));
});

test("skipping RUNNING is rejected", () => {
  assert.throws(
    () => assertValidTransition("QUEUED", "SUCCEEDED"),
    (err: unknown) =>
      err instanceof InvalidStateTransitionError &&
      err.code === "INVALID_STATE_TRANSITION" &&
      err.statusCode === 409,
  );
});

test("terminal states cannot transition", () => {
  assert.throws(() => assertValidTransition("FAILED", "RUNNING"));
  assert.throws(() => assertValidTransition("STALE", "RUNNING"));
  assert.throws(() => assertValidTransition("STALE", "SUCCEEDED"));
});

test("a SUCCEEDED run cannot be re-run in place (append-only history)", () => {
  assert.throws(() => assertValidTransition("SUCCEEDED", "RUNNING"));
  assert.throws(() => assertValidTransition("SUCCEEDED", "SUCCEEDED"));
});
