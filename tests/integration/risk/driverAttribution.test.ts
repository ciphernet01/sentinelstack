/**
 * P3 — Driver attribution + evidence integration
 *
 * Exercises the real Prisma/PostgreSQL path for the normalized driver layer:
 * persistence and atomicity, evidence deduplication, tenant isolation,
 * drill-down to lineage, governance annotations that do not overwrite the model,
 * and run-to-run comparison matched on the stable driver key.
 *
 * SAFETY: these tests write to whatever database DATABASE_URL points at, and
 * are therefore opt-in.  Run them explicitly with:
 *
 *   $env:RUN_RISK_INTEGRATION_TESTS="true"; npm run test:risk:integration
 *
 * The test creates its own organisation and deletes it (cascading) on teardown.
 */

import test from "node:test";
import assert from "node:assert/strict";

const OPTED_IN = process.env.RUN_RISK_INTEGRATION_TESTS === "true";
const SKIP_REASON =
  "set RUN_RISK_INTEGRATION_TESTS=true to run risk integration tests against DATABASE_URL";

async function dbAvailable(): Promise<boolean> {
  try {
    const { prisma } = await import("../../../src/config/db");
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

test("P3 persists normalized, evidence-linked drivers with tenant isolation", async (t) => {
  if (!OPTED_IN) return t.skip(SKIP_REASON);
  if (!(await dbAvailable())) return t.skip("DATABASE_URL is not reachable");

  const { prisma } = await import("../../../src/config/db");
  const { riskAssessmentService } = await import(
    "../../../src/services/risk/riskAssessment.service"
  );
  const {
    listRiskDrivers,
    getRiskDriver,
    annotateDriverReview,
    RiskDriverNotFoundError,
  } = await import("../../../src/services/risk/driverStore.service");
  const { compareAssessments } = await import("../../../src/services/risk/riskChange.service");

  const org = await prisma.organization.create({ data: { name: "P3 Attribution Test Org" } });
  const otherOrg = await prisma.organization.create({ data: { name: "P3 Other Tenant Org" } });

  try {
    const asset = await prisma.cyberAsset.create({
      data: {
        organizationId: org.id,
        assetId: "AST-P3-001",
        hostname: "p3.acme.test",
        serviceName: "P3 Integration API",
        environment: "INTERNET",
        criticality: "CRITICAL",
        internetExposed: true,
        revenueDependencyInr: 20_000_000n,
        downtimeCostPerHourInr: 900_000n,
        maxTolerableDowntimeHours: 3,
        dataSensitivity: 5,
        regulatoryExposureInr: 4_000_000n,
        breachCostInr: 9_000_000n,
        recoveryCostInr: 2_000_000n,
        reputationCostInr: 1_500_000n,
      },
    });

    await prisma.cyberVulnerability.create({
      data: {
        organizationId: org.id,
        assetId: asset.id,
        cve: "CVE-2026-88888",
        title: "P3 integration RCE",
        cvss: 9.4,
        epss: 0.71,
        exploitAvailable: true,
        patchAvailable: false,
        status: "OPEN",
        source: "VULNERABILITY_MANAGER",
      },
    });

    // ── Run once through the full pipeline ─────────────────────────────────
    const first = await riskAssessmentService.runEnterpriseRisk({
      organizationId: org.id,
      triggeredBy: "p3-integration-test",
      triggerReason: "MANUAL",
    });

    const attribution = (first as { riskAttribution?: { driverCount: number } }).riskAttribution;
    assert.ok(attribution, "P3 attribution must be produced by the risk pipeline");
    assert.ok(attribution!.driverCount > 0, "expected at least one persisted driver");

    const drivers = await listRiskDrivers({ organizationId: org.id });
    assert.ok(drivers.length > 0, "drivers must be queryable");

    // ── Every driver traces to an assessment, never floats free ───────────
    for (const driver of drivers) {
      assert.equal(driver.organizationId, org.id);
      assert.ok(driver.riskAssessmentId, "driver must belong to an assessment");
      assert.ok(driver.riskRunId, "driver must belong to a run");
      assert.match(driver.attributionHash ?? "", /^sha256:/);
      assert.ok(driver.rank >= 1);
    }

    // ── Evidence is deduplicated, not duplicated per driver ───────────────
    const evidence = await prisma.evidenceRecord.findMany({ where: { organizationId: org.id } });
    const evidenceKeys = evidence.map((record) => `${record.sourceType}:${record.sourceRecordId}`);
    assert.equal(
      new Set(evidenceKeys).size,
      evidenceKeys.length,
      "evidence must be unique per source record"
    );
    assert.ok(evidence.length > 0, "drivers must be backed by evidence");

    // ── Drill-down reaches evidence and lineage ──────────────────────────
    const topDriver = drivers[0];
    const detail = await getRiskDriver(org.id, topDriver.id);
    assert.equal(detail.id, topDriver.id);
    assert.ok(detail.evidenceLinks.length > 0, "driver must expose its evidence links");
    assert.ok(detail.riskAssessment, "driver must resolve its assessment");
    assert.ok(detail.riskRun, "driver must resolve its run");

    // ── Tenant isolation: a valid id from another org is still refused ────
    await assert.rejects(
      () => getRiskDriver(otherOrg.id, topDriver.id),
      (error: unknown) => error instanceof RiskDriverNotFoundError,
      "a driver id must never grant cross-tenant access"
    );

    const crossTenantList = await listRiskDrivers({ organizationId: otherOrg.id });
    assert.equal(crossTenantList.length, 0, "another org must see no drivers");

    // ── Review annotates; it never overwrites the model attribution ──────
    const hashBefore = topDriver.attributionHash;
    const contributionBefore = topDriver.contributionToEal;

    const annotated = await annotateDriverReview({
      organizationId: org.id,
      driverId: topDriver.id,
      reviewStatus: "ACCEPTED",
      actor: "analyst-1",
      rationale: "Confirmed against the vulnerability manager.",
    });

    assert.equal(annotated.reviewStatus, "ACCEPTED");
    assert.equal(annotated.attributionHash, hashBefore, "attribution hash must not change");
    assert.ok(annotated.reviewedAt instanceof Date);

    const afterReview = await prisma.riskDriver.findUniqueOrThrow({
      where: { id: topDriver.id },
    });
    assert.equal(afterReview.contributionToEal, contributionBefore);
    assert.equal(afterReview.reviewStatus, "ACCEPTED");

    // ── Second run, then compare: drivers match on the stable key ─────────
    const second = await riskAssessmentService.runEnterpriseRisk({
      organizationId: org.id,
      triggeredBy: "p3-integration-test",
      triggerReason: "MANUAL",
    });

    const secondAssessmentId = second._provenance.assessmentId;
    const comparison = await compareAssessments({
      organizationId: org.id,
      currentAssessmentId: secondAssessmentId,
    });

    assert.equal(comparison.currentAssessmentId, secondAssessmentId);
    assert.ok(comparison.previousAssessmentId);
    assert.equal(typeof comparison.metricDeltas.eal, "number");

    // Same estate, same drivers -> matched by key, not reported as NEW.
    const newOnes = comparison.driverChanges.filter((c) => c.changeType === "NEW");
    assert.equal(
      newOnes.length,
      0,
      "an unchanged estate must not produce NEW drivers; the key is unstable"
    );
  } finally {
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  }
});
