/**
 * P1.16 — Risk run lifecycle integration
 *
 * Exercises the real Prisma/PostgreSQL path for:
 *   • RiskRun creation + lifecycle (QUEUED -> RUNNING -> SUCCEEDED)
 *   • RiskAssessment persistence with full version + hash lineage
 *   • append-only history (a second run never mutates the first assessment)
 *   • STALE marking of superseded runs
 *   • tenant isolation (one organisation can never read another's assessment)
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

test("RiskRun lifecycle persists a reproducible, lineage-complete assessment", async (t) => {
  if (!OPTED_IN) return t.skip(SKIP_REASON);
  if (!(await dbAvailable())) return t.skip("DATABASE_URL is not reachable");

  const { prisma } = await import("../../../src/config/db");
  const { riskAssessmentService } = await import(
    "../../../src/services/risk/riskAssessment.service"
  );

  const org = await prisma.organization.create({ data: { name: "PS26105 Lifecycle Test Org" } });

  try {
    const asset = await prisma.cyberAsset.create({
      data: {
        organizationId: org.id,
        assetId: "AST-IT-001",
        hostname: "it.acme.test",
        serviceName: "Integration Test API",
        environment: "INTERNET",
        criticality: "CRITICAL",
        internetExposed: true,
        revenueDependencyInr: 10_000_000n,
        downtimeCostPerHourInr: 500_000n,
        maxTolerableDowntimeHours: 2,
        dataSensitivity: 5,
        regulatoryExposureInr: 1_000_000n,
        breachCostInr: 5_000_000n,
        recoveryCostInr: 800_000n,
        reputationCostInr: 1_200_000n,
      },
    });

    await prisma.cyberVulnerability.create({
      data: {
        organizationId: org.id,
        assetId: asset.id,
        cve: "CVE-2026-99999",
        title: "Integration test RCE",
        cvss: 9.1,
        epss: 0.5,
        exploitAvailable: true,
        patchAvailable: true,
        status: "OPEN",
        source: "VULNERABILITY_MANAGER",
      },
    });

    await runLifecycleAssertions(prisma, riskAssessmentService, org.id);
  } finally {
    await prisma.organization.delete({ where: { id: org.id } });
  }
});

async function runLifecycleAssertions(
  prisma: typeof import("../../../src/config/db").prisma,
  riskAssessmentService: import("../../../src/services/risk/riskAssessment.service").RiskAssessmentService,
  organizationId: string,
) {
  // ── First run ────────────────────────────────────────────────────────────
  const first = await riskAssessmentService.runEnterpriseRisk({
    organizationId,
    budgetInr: 5_000_000,
    triggeredBy: "integration-test",
    triggerReason: "MANUAL",
  });

  const run = await prisma.riskRun.findUniqueOrThrow({
    where: { id: first._provenance.riskRunId },
    include: { assessments: true },
  });

  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.organizationId, organizationId);
  assert.equal(run.scopeType, "ENTERPRISE");
  assert.match(run.inputStateHash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(run.resultHash, "a succeeded run must record a result hash");
  assert.match(run.resultHash!, /^sha256:[0-9a-f]{64}$/);
  assert.equal(run.riskEngineVersion, first._provenance.riskEngineVersion);
  assert.equal(run.parameterVersion, first._provenance.parameterVersion);
  assert.equal(run.modelBundleVersion, first._provenance.modelBundleVersion);
  assert.equal(run.featureSetVersion, "features-v1");
  assert.equal(run.simulationConfigVersion, "mc-config-v2");
  assert.match(first._provenance.calculationHash, /^sha256:[0-9a-f]{64}$/);

  // ── P2: Monte Carlo Risk Engine v2 is the authoritative calculator ───────
  type RiskEngineResult = Awaited<
    ReturnType<typeof import("../../../src/services/risk/riskEngine.service").calculateRisk>
  >;
  const engineV2 = (first as { riskEngineV2?: RiskEngineResult }).riskEngineV2;

  assert.ok(engineV2, "the v2 engine block must be returned alongside the payload");
  assert.equal(run.riskEngineVersion, "risk-engine-v2.0");
  assert.equal(engineV2.versions.riskEngine, run.riskEngineVersion);
  assert.equal(engineV2.versions.simulation, run.simulationConfigVersion);
  assert.ok(engineV2.simulation.simulationCount > 0);
  assert.ok(engineV2.eal > 0, "an internet-exposed asset with an exploitable CVE must cost");
  assert.ok(engineV2.var95 >= engineV2.eal);
  assert.ok(engineV2.var99 >= engineV2.var95);
  assert.ok(engineV2.drivers.length > 0, "P2 must attribute drivers, not just rank assets");
  assert.ok(
    engineV2.drivers.every((driver) => Number.isFinite(driver.contributionToEal ?? NaN)),
    "every driver contribution must be a measured number"
  );
  assert.equal(
    run.resultHash,
    engineV2.resultHash,
    "the persisted run hash and the engine result hash are the same fingerprint"
  );

  // ── Assessment persistence ───────────────────────────────────────────────
  assert.equal(run.assessments.length, 1);
  const firstAssessment = run.assessments[0];
  assert.equal(firstAssessment.riskRunId, run.id);
  assert.equal(firstAssessment.organizationId, organizationId);
  assert.equal(firstAssessment.inputStateHash, run.inputStateHash);
  assert.ok(firstAssessment.resultHash);
  assert.ok(typeof firstAssessment.riskScore === "number");
  assert.ok(firstAssessment.expectedAnnualLossInr >= 0n);
  assert.ok(Array.isArray(firstAssessment.drivers), "structured driver attribution must persist");
  assert.equal(
    (firstAssessment.drivers as unknown[]).length,
    engineV2!.drivers.length,
    "the persisted driver rows must match the engine output"
  );
  assert.equal(firstAssessment.riskScore, engineV2!.riskScore);

  // ── Audit ledger is append-only and ordered ──────────────────────────────
  const auditActions = (
    await prisma.riskAuditEvent.findMany({
      where: { riskRunId: run.id },
      orderBy: { createdAt: "asc" },
    })
  ).map((event) => event.action);

  assert.deepEqual(auditActions, [
    "RISK_RUN_CREATED",
    "RISK_RUN_COMPLETED",
    "RISK_ASSESSMENT_PERSISTED",
  ]);

  // ── Second run: history must stay append-only ────────────────────────────
  const second = await riskAssessmentService.runEnterpriseRisk({
    organizationId,
    budgetInr: 5_000_000,
    triggeredBy: "integration-test",
    triggerReason: "MANUAL",
  });

  assert.notEqual(second._provenance.assessmentId, first._provenance.assessmentId);
  assert.notEqual(second._provenance.riskRunId, first._provenance.riskRunId);

  const reloadedFirst = await prisma.riskAssessment.findUniqueOrThrow({
    where: { id: firstAssessment.id },
  });
  assert.equal(reloadedFirst.resultHash, firstAssessment.resultHash);
  assert.equal(reloadedFirst.computedAt.toISOString(), firstAssessment.computedAt.toISOString());

  const reloadedFirstRun = await prisma.riskRun.findUniqueOrThrow({ where: { id: run.id } });
  assert.equal(reloadedFirstRun.status, "STALE");

  assert.equal(await prisma.riskAssessment.count({ where: { organizationId } }), 2);

  // ── Tenant isolation ─────────────────────────────────────────────────────
  const otherOrg = await prisma.organization.create({
    data: { name: "PS26105 Other Tenant Org" },
  });
  try {
    assert.equal(
      await riskAssessmentService.getAssessment(otherOrg.id, firstAssessment.id),
      null,
      "another tenant must not be able to read this assessment",
    );

    assert.ok(await riskAssessmentService.getAssessment(organizationId, firstAssessment.id));

    assert.equal((await riskAssessmentService.listAssessmentHistory(organizationId, 10)).length, 2);
    assert.equal((await riskAssessmentService.listAssessmentHistory(otherOrg.id, 10)).length, 0);
  } finally {
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  }
}
