/**
 * P1.9 — Tenant scope resolution
 *
 * The legacy cyber-risk controller allowed a `?organizationId=` query override
 * for ADMIN users.  That behaviour must not be copied into the canonical
 * PS 26105 API surface, where scope must always come from the authenticated
 * user's validated membership.
 *
 * Both resolvers live here (rather than inline in the controller) so the
 * tenant-isolation guarantee can be unit tested without an HTTP server.
 */

import type { Request } from "express";

/** Minimal shape of an authenticated request needed to resolve tenant scope. */
export interface TenantScopeRequest extends Request {
  user?: {
    id?: string;
    role?: string;
    organizationId?: string;
  };
}

/**
 * Canonical resolver for PS 26105 v1 endpoints.
 *
 * Scope comes exclusively from the authenticated user's organisation
 * membership. A caller-supplied `?organizationId=` is deliberately ignored.
 */
export function resolveOrganizationIdStrict(req: TenantScopeRequest): string | undefined {
  return req.user?.organizationId;
}

/**
 * Legacy resolver, preserved only for the existing `/api/cyber-risk/*`
 * endpoints during the migration window. Allows a platform ADMIN to
 * cross-query another organisation explicitly.
 */
export function resolveOrganizationIdWithAdminOverride(
  req: TenantScopeRequest,
): string | undefined {
  if (req.user?.role === "ADMIN" && typeof req.query.organizationId === "string") {
    return req.query.organizationId;
  }
  return req.user?.organizationId;
}
