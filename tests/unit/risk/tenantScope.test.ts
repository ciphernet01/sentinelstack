/**
 * P1.9 — Tenant isolation at the scope-resolver boundary
 *
 * Proves that the canonical PS 26105 resolver can never be talked into
 * reading another organisation's data by a query parameter, and that the
 * legacy override is confined to the legacy resolver.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveOrganizationIdStrict,
  resolveOrganizationIdWithAdminOverride,
} from "../../../src/services/risk/tenantScope";

type FakeReq = Parameters<typeof resolveOrganizationIdStrict>[0];

function makeReq(
  user: { id?: string; role?: string; organizationId?: string } | undefined,
  query: Record<string, unknown> = {},
): FakeReq {
  return { user, query } as unknown as FakeReq;
}

// ---------------------------------------------------------------------------
// Strict resolver (PS 26105 v1 API)
// ---------------------------------------------------------------------------

test("strict resolver returns the authenticated user's organisation", () => {
  const req = makeReq({ id: "user_a", role: "CLIENT", organizationId: "org_a" });
  assert.equal(resolveOrganizationIdStrict(req), "org_a");
});

test("strict resolver ignores a cross-org query override for a member", () => {
  const req = makeReq(
    { id: "user_a", role: "CLIENT", organizationId: "org_a" },
    { organizationId: "org_b" },
  );
  assert.equal(resolveOrganizationIdStrict(req), "org_a");
});

test("strict resolver ignores a cross-org query override even for an ADMIN", () => {
  const req = makeReq(
    { id: "admin_1", role: "ADMIN", organizationId: "org_a" },
    { organizationId: "org_b" },
  );
  assert.equal(resolveOrganizationIdStrict(req), "org_a");
});

test("strict resolver returns undefined when there is no organisation membership", () => {
  assert.equal(resolveOrganizationIdStrict(makeReq({ id: "user_x", role: "CLIENT" })), undefined);
  assert.equal(resolveOrganizationIdStrict(makeReq(undefined)), undefined);
});

// ---------------------------------------------------------------------------
// Legacy resolver (existing /api/cyber-risk/* endpoints)
// ---------------------------------------------------------------------------

test("legacy resolver still honours the admin cross-org override", () => {
  const req = makeReq(
    { id: "admin_1", role: "ADMIN", organizationId: "org_a" },
    { organizationId: "org_b" },
  );
  assert.equal(resolveOrganizationIdWithAdminOverride(req), "org_b");
});

test("legacy resolver does not let a non-admin override scope", () => {
  const req = makeReq(
    { id: "user_a", role: "CLIENT", organizationId: "org_a" },
    { organizationId: "org_b" },
  );
  assert.equal(resolveOrganizationIdWithAdminOverride(req), "org_a");
});
