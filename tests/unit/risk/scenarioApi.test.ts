/**
 * P4 — Scenario API contract
 *
 * The HTTP layer must not weaken what the service layer enforces. Two things
 * are proved without a database:
 *
 *   • Every scenario route is registered, with sub-routes ordered ahead of the
 *     single-segment :scenarioId route.
 *   • Request validation rejects malformed input before any expensive work, and
 *     tenant scope is never taken from the request body.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { scenarioController } from "../../../src/controllers/scenario.controller";
import riskRouter from "../../../src/routes/risk.routes";

type Captured = { status: number; body: Record<string, unknown> };

/** A response double that records the status and body, and is itself passable. */
function fakeRes(): Captured & { res: { status: (n: number) => unknown; json: (b: unknown) => unknown } } {
  const captured: Captured = { status: 0, body: {} };
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(payload: unknown) {
      captured.body = payload as Record<string, unknown>;
      return res;
    },
  };
  return Object.assign(captured, { res });
}

function fakeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
    query: {},
    params: {},
    body: {},
    ...overrides,
  } as never;
}

const next = () => undefined;

function routePaths(): string[] {
  const stack = riskRouter.stack as unknown as Array<{ route?: { path: string } }>;
  return stack.filter((layer) => Boolean(layer.route)).map((layer) => layer.route!.path);
}

test("every P4 scenario route is registered", () => {
  const stack = riskRouter.stack as unknown as Array<{
    route?: { path: string; methods: Record<string, boolean> };
  }>;
  const registered = stack
    .filter((layer) => Boolean(layer.route))
    .map((layer) => `${Object.keys(layer.route!.methods).join(",")} ${layer.route!.path}`);

  assert.ok(registered.includes("post /scenarios"), "POST /scenarios must exist");
  assert.ok(registered.includes("get /scenarios"), "GET /scenarios must exist");
  assert.ok(registered.includes("get /scenarios/:scenarioId"), "GET a scenario must exist");
  assert.ok(registered.includes("post /scenarios/:scenarioId/validate"), "validate must exist");
  assert.ok(registered.includes("post /scenarios/:scenarioId/run"), "run must exist");
  assert.ok(registered.includes("get /scenarios/:scenarioId/compare"), "compare must exist");
});

test("scenario sub-routes are registered before the single-segment route", () => {
  const paths = routePaths();
  const single = paths.indexOf("/scenarios/:scenarioId");

  assert.ok(single >= 0, "/scenarios/:scenarioId must be registered");
  for (const sub of [
    "/scenarios/:scenarioId/validate",
    "/scenarios/:scenarioId/run",
    "/scenarios/:scenarioId/compare",
  ]) {
    assert.ok(paths.indexOf(sub) < single, `${sub} must precede /scenarios/:scenarioId`);
  }
});

// ── Request validation ─────────────────────────────────────────────────────

test("creating a scenario without a name is rejected", async () => {
  const response = fakeRes();
  await scenarioController.create(
    fakeReq({ body: { type: "CONTROL", baselineRiskAssessmentId: "a1" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 400);
  assert.match(String(response.body.message), /name/);
});

test("creating a scenario without a baseline is rejected", async () => {
  const response = fakeRes();
  await scenarioController.create(
    fakeReq({ body: { name: "Test", type: "CONTROL" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 400);
  assert.match(String(response.body.message), /baselineRiskAssessmentId/);
});

test("an unsupported scenario type is rejected with the valid set", async () => {
  const response = fakeRes();
  await scenarioController.create(
    fakeReq({ body: { name: "Test", type: "MAKE_IT_BETTER", baselineRiskAssessmentId: "a1" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 400);
  assert.match(String(response.body.message), /Unsupported type/);
});

test("an invalid change target, operation or sequence is rejected by index", async () => {
  const base = { name: "T", type: "CONTROL", baselineRiskAssessmentId: "a1" };

  const badTarget = fakeRes();
  await scenarioController.create(
    fakeReq({ body: { ...base, changes: [{ targetType: "PLANET", operation: "SET", targetId: "a", fieldPath: "x", sequence: 1 }] } }),
    badTarget.res as never,
    next as never
  );
  assert.equal(badTarget.status, 400);
  assert.match(String(badTarget.body.message), /changes\[0\]\.targetType/);

  const badOperation = fakeRes();
  await scenarioController.create(
    fakeReq({ body: { ...base, changes: [{ targetType: "ASSET", operation: "VAPORISE", targetId: "a", fieldPath: "x", sequence: 1 }] } }),
    badOperation.res as never,
    next as never
  );
  assert.match(String(badOperation.body.message), /changes\[0\]\.operation/);

  const badSequence = fakeRes();
  await scenarioController.create(
    fakeReq({ body: { ...base, changes: [{ targetType: "ASSET", operation: "SET", targetId: "a", fieldPath: "x", sequence: "first" }] } }),
    badSequence.res as never,
    next as never
  );
  assert.match(String(badSequence.body.message), /changes\[0\]\.sequence/);
});

test("a negative or non-numeric run cost is rejected", async () => {
  for (const cost of [-1, "free"]) {
    const response = fakeRes();
    await scenarioController.run(
      fakeReq({ params: { scenarioId: "s1" }, body: { cost } }),
      response.res as never,
      next as never
    );
    assert.equal(response.status, 400, `cost ${String(cost)} must be rejected`);
  }
});

test("a non-positive list limit is rejected", async () => {
  const response = fakeRes();
  await scenarioController.list(
    fakeReq({ query: { limit: "0" } }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 400);
});

// ── Tenancy ────────────────────────────────────────────────────────────────

test("every scenario endpoint refuses a query-supplied organisation", async () => {
  const cases: Array<[string, (res: never) => Promise<unknown>]> = [
    ["list", (res) => scenarioController.list(fakeReq({ user: { id: "u" }, query: { organizationId: "org-attacker" } }), res, next as never)],
    ["get", (res) => scenarioController.get(fakeReq({ user: { id: "u" }, params: { scenarioId: "s" }, query: { organizationId: "org-attacker" } }), res, next as never)],
    ["validate", (res) => scenarioController.validate(fakeReq({ user: { id: "u" }, params: { scenarioId: "s" }, query: { organizationId: "org-attacker" } }), res, next as never)],
    ["run", (res) => scenarioController.run(fakeReq({ user: { id: "u" }, params: { scenarioId: "s" }, query: { organizationId: "org-attacker" } }), res, next as never)],
    ["compare", (res) => scenarioController.compare(fakeReq({ user: { id: "u" }, params: { scenarioId: "s" }, query: { organizationId: "org-attacker" } }), res, next as never)],
  ];

  for (const [name, invoke] of cases) {
    const response = fakeRes();
    await invoke(response.res as never);
    assert.equal(response.status, 403, `${name} must refuse a query-supplied tenant`);
  }
});

test("a create body carrying a foreign organizationId cannot establish scope", async () => {
  // The body may carry an organizationId; the controller must ignore it and use
  // the session. With a scopeless session the request is refused outright.
  const response = fakeRes();
  await scenarioController.create(
    fakeReq({
      user: { id: "u", role: "ADMIN" },
      body: {
        name: "T",
        type: "CONTROL",
        baselineRiskAssessmentId: "a1",
        organizationId: "org-attacker",
      },
    }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 403, "the body must not be able to establish scope");
});

test("a missing user is refused with 401", async () => {
  const response = fakeRes();
  await scenarioController.list(
    fakeReq({ user: undefined }),
    response.res as never,
    next as never
  );

  assert.equal(response.status, 401);
});