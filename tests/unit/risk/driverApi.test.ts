/**
 * P3 — Driver API contract
 *
 * The HTTP layer must not weaken the guarantees the service layer already
 * enforces. Two things are proved here without a database:
 *
 *   • Filter values are allow-listed. An unknown driver type is a 400, not a
 *     silently empty result that reads as "this organisation has no risk".
 *   • Organisation scope is never read from the query string, so a caller
 *     cannot ask for another tenant's drivers by passing ?organizationId=.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { riskDriverController } from "../../../src/controllers/risk-driver.controller";
import riskRouter from "../../../src/routes/risk.routes";

type CapturedResponse = { status: number; body: Record<string, unknown> };

/** Minimal Express response double that records status + body. */
function fakeRes(): CapturedResponse & {
  res: CapturedResponse & { status: (n: number) => typeof self; json: (b: unknown) => typeof self };
} {
  const captured = { status: 0, body: {} as Record<string, unknown> };
  const res = {
    status(code: number) {
      captured.status = code;
      return res as never;
    },
    json(payload: unknown) {
      captured.body = payload as Record<string, unknown>;
      return res as never;
    },
  };
  return Object.assign(captured, { res }) as never;
}

function fakeReq(overrides: Record<string, unknown> = {}) {
  return {
    // Tenant scope is read from the authenticated user, never the query string
    // (see resolveOrganizationIdStrict).
    user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
    query: {},
    params: {},
    body: {},
    ...overrides,
  } as never;
}

const next = () => undefined;

/** Registered route paths, in registration order. */
function routePaths(): string[] {
  const stack = riskRouter.stack as unknown as Array<{ route?: { path: string } }>;
  return stack.filter((layer) => Boolean(layer.route)).map((layer) => layer.route!.path);
}

test("the P3 driver routes are registered on the risk API", () => {
  const stack = riskRouter.stack as unknown as Array<{
    route?: { path: string; methods: Record<string, boolean> };
  }>;
  const registered = stack
    .filter((layer) => Boolean(layer.route))
    .map((layer) => `${Object.keys(layer.route!.methods).join(",")} ${layer.route!.path}`);

  assert.ok(registered.includes("get /drivers"), "GET /drivers must exist");
  assert.ok(registered.includes("get /drivers/:driverId"), "GET /drivers/:driverId must exist");
  assert.ok(registered.includes("post /drivers/:driverId/review"), "review must exist");
  assert.ok(registered.includes("get /evidence/:evidenceId"), "GET /evidence/:evidenceId must exist");
  assert.ok(
    registered.includes("get /assessments/:id/changes"),
    "the risk-change endpoint must exist"
  );
});

test("changes is registered before the single-segment :id route", () => {
  // Express matches in registration order. If /assessments/:id came first it
  // would match "/assessments/abc" and shadow the /changes suffix entirely.
  const paths = routePaths();

  const changesIndex = paths.indexOf("/assessments/:id/changes");
  const singleIndex = paths.indexOf("/assessments/:id");

  assert.ok(changesIndex >= 0, "/assessments/:id/changes must be registered");
  assert.ok(singleIndex >= 0, "/assessments/:id must be registered");
  assert.ok(
    changesIndex < singleIndex,
    "/assessments/:id/changes must be registered before /assessments/:id"
  );
});

test("an unknown driver_type is rejected rather than returning nothing", async () => {
  const response = fakeRes();

  await riskDriverController.listDrivers(
    fakeReq({ query: { driver_type: "NOT_A_REAL_TYPE" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 400);
  assert.match(String(response.body.message), /driver_type/);
});

test("an unknown direction and review_status are both rejected", async () => {
  const badDirection = fakeRes();
  await riskDriverController.listDrivers(
    fakeReq({ query: { direction: "SIDEWAYS" } }),
    badDirection.res as never,
    next as never
  );
  assert.equal(badDirection.status, 400);

  const badReview = fakeRes();
  await riskDriverController.listDrivers(
    fakeReq({ query: { review_status: "MAYBE" } }),
    badReview.res as never,
    next as never
  );
  assert.equal(badReview.status, 400);
});

test("a non-numeric min_contribution or limit is rejected", async () => {
  const badContribution = fakeRes();
  await riskDriverController.listDrivers(
    fakeReq({ query: { min_contribution: "lots" } }),
    badContribution.res as never,
    next as never
  );
  assert.equal(badContribution.status, 400);

  const badLimit = fakeRes();
  await riskDriverController.listDrivers(
    fakeReq({ query: { limit: "-5" } }),
    badLimit.res as never,
    next as never
  );
  assert.equal(badLimit.status, 400);
});

test("a review without a valid reviewStatus is rejected", async () => {
  const response = fakeRes();

  await riskDriverController.reviewDriver(
    fakeReq({ params: { driverId: "d1" }, body: { reviewStatus: "APPROVED_WITHOUT_REVIEW" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 400);
  assert.match(String(response.body.message), /reviewStatus/);
});

test("a query-supplied organizationId cannot stand in for session scope", async () => {
  // The user has no organisation membership, but the query names one. The
  // request must be refused: tenant scope is never taken from the query string.
  const response = fakeRes();
  let reachedNext = false;

  await riskDriverController.listDrivers(
    fakeReq({
      user: { id: "user-1", role: "ADMIN" },
      query: { organizationId: "org-attacker" },
    }),
    response.res as never,
    (() => {
      reachedNext = true;
    }) as never
  );

  assert.equal(response.status, 403, "a query-supplied tenant must not grant scope");
  assert.equal(reachedNext, false, "the request must be refused, not delegated");
});

test("a query-supplied organizationId is refused by every P3 endpoint", async () => {
  const cases: Array<[string, (res: never) => Promise<unknown>]> = [
    [
      "listDrivers",
      (res) =>
        riskDriverController.listDrivers(
          fakeReq({ user: { id: "u" }, query: { organizationId: "org-attacker" } }),
          res,
          next as never
        ),
    ],
    [
      "getDriver",
      (res) =>
        riskDriverController.getDriver(
          fakeReq({ user: { id: "u" }, params: { driverId: "d" }, query: { organizationId: "org-attacker" } }),
          res,
          next as never
        ),
    ],
    [
      "getEvidence",
      (res) =>
        riskDriverController.getEvidence(
          fakeReq({ user: { id: "u" }, params: { evidenceId: "e" }, query: { organizationId: "org-attacker" } }),
          res,
          next as never
        ),
    ],
    [
      "getAssessmentChanges",
      (res) =>
        riskDriverController.getAssessmentChanges(
          fakeReq({ user: { id: "u" }, params: { assessmentId: "a" }, query: { organizationId: "org-attacker" } }),
          res,
          next as never
        ),
    ],
  ];

  for (const [name, invoke] of cases) {
    const response = fakeRes();
    await invoke(response.res as never);
    assert.equal(response.status, 403, `${name} must refuse a query-supplied tenant`);
  }
});

test("a scopeless session is refused before any validation or lookup", async () => {
  const response = fakeRes();

  await riskDriverController.getDriver(
    fakeReq({ user: { id: "u" }, params: { driverId: "d" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 403);
  assert.equal(response.body.message, "Organization context missing.");
});

test("a missing user is refused with 401", async () => {
  const response = fakeRes();

  await riskDriverController.getEvidence(
    fakeReq({ user: undefined, params: { evidenceId: "e" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 401);
});
