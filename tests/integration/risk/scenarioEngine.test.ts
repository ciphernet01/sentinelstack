/**
 * P4 — Scenario engine integration
 *
 * Runs the real path end to end against PostgreSQL: a baseline assessment is
 * produced by the P2 pipeline, a scenario is defined against it, run through the
 * P2 engine, and the result persisted with its delta and P3 attribution.
 *
 * Proves:
 *   • a what-if is a real recalculation, not a multiplier on the baseline
 *   • the baseline assessment is not mutated by a run
 *   • the delta persists and matches the returned figures
 *   • re-running appends a result rather than mutating the previous one
 *   • tenant isolation holds on the scenario surface
 *
 * SAFETY: opt-in. Creates its own organisation and deletes it (cascading).
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

test("P4 runs, persists and compares a what-if scenario", async (t) => {
  if (!OPTED_IN) return t.skip(SKIP_REASON);
  if (!(await dbAvailable())) return t.skip("DATABASE_URL is not reachable");

  const { prisma } = await import("../../../src/config/db");
  const { riskAssessmentService } = await import(
    "../../../src/services/risk/riskAssessment.service"
  );
  const {
    createScenario,
    listScenarios,
    getScenario,
    validateScenario,
    runPersistedScenario,
    compareScenarioRuns,
    ScenarioNotFoundError,
  } = await import("../../../src/services/scenario/scenarioStore.service");

  const org = await prisma.organization.create({ data: { name: "P4 Scenario Test Org" } });
  const otherOrg = await prisma.organization.create({ data: { name: "P4 Other Tenant" } });

  try {
    const asset = await prisma.cyberAsset.create({
      data: {
        organizationId: org.id,
        assetId: "AST-P4-001",
        hostname: "p4.acme.test",
        serviceName: "P4 Integration API",
        environment: "INTERNET",
        criticality: "CRITICAL",
        internetExposed: true,
        revenueDependencyInr: 30_000_000n,
        downtimeCostPerHourInr: 1_200_000n,
        maxTolerableDowntimeHours: 4,
        dataSensitivity: 5,
        regulatoryExposureInr: 5_000_000n,
        breachCostInr: 12_000_000n,
        recoveryCostInr: 3_000_000n,
        reputationCostInr: 2_000_000n,
      },
    });

    const vulnerability = await prisma.cyberVulnerability.create({
      data: {
        organizationId: org.id,
        assetId: asset.id,
        cve: "CVE-2026-77777",
        title: "P4 exploitable RCE",
        cvss: 9.8,
        epss: 0.8,
        exploitAvailable: true,
        patchAvailable: false,
        status: "OPEN",
        source: "VULNERABILITY_MANAGER",
      },
    });

    // ── Baseline via the normal P2 pipeline ────────────────────────────────
    const baselineRun = await riskAssessmentService.runEnterpriseRisk({
      organizationId: org.id,
      triggeredBy: "p4-integration-test",
      triggerReason: "MANUAL",
    });

    const baselineAssessmentId = baselineRun._provenance.assessmentId;
    const baselineBefore = await prisma.riskAssessment.findUniqueOrThrow({
      where: { id: baselineAssessmentId },
    });

    // ── Define the scenario against that baseline ──────────────────────────
    const scenario = await createScenario({
      organizationId: org.id,
      name: "Patch critical CVE and raise patch coverage",
      type: "VULNERABILITY_REMEDIATION",
      baselineRiskAssessmentId: baselineAssessmentId,
      createdById: "p4-integration-test",
      changes: [
        {
          targetType: "VULNERABILITY",
          targetId: `AST-P4-001/${vulnerability.id}`,
          fieldPath: "status",
          operation: "PATCH",
          newValue: "PATCHED",
          sequence: 1,
        },
      ],
    });

    assert.equal(scenario.changeCount, 1);
    assert.equal(scenario.baselineRiskAssessmentId, baselineAssessmentId);

    // Validation is available before spending a run on it.
    const validation = await validateScenario(org.id, scenario.id);
    assert.equal(validation.applicable, true, "a well-formed scenario must validate");
    assert.equal(validation.issues.length, 0);

    // ── Run it ─────────────────────────────────────────────────────────────
    const run = await runPersistedScenario({
      organizationId: org.id,
      scenarioId: scenario.id,
      cost: 750_000,
      actor: "p4-integration-test",
    });

    assert.equal(run.status, "SUCCEEDED");
    assert.ok(run.result.scenario.eal > 0);
    assert.ok(
      run.result.scenario.eal < run.result.baseline.eal,
      "patching an exploitable finding must reduce modelled EAL"
    );
    assert.equal(
      run.result.delta.eal,
      run.result.scenario.eal - run.result.baseline.eal
    );
    assert.equal(run.result.riskReduction.eal, -run.result.delta.eal);
    assert.equal(run.result.cost, 750_000);
    assert.match(run.result.scenarioStateHash, /^sha256:/);
    assert.ok(run.attribution, "the scenario must carry P3 attribution");

    // ── The baseline assessment must be untouched ──────────────────────────
    const baselineAfter = await prisma.riskAssessment.findUniqueOrThrow({
      where: { id: baselineAssessmentId },
    });

    assert.equal(
      baselineAfter.expectedAnnualLossInr,
      baselineBefore.expectedAnnualLossInr,
      "a scenario must never mutate the baseline assessment"
    );
    assert.equal(baselineAfter.resultHash, baselineBefore.resultHash);

    // ── The persisted result matches what was returned ─────────────────────
    const stored = await prisma.scenarioAssessment.findUniqueOrThrow({
      where: { id: run.assessmentId },
    });

    assert.ok(Math.abs(stored.eal - run.result.scenario.eal) < 1e-6);
    assert.ok(Math.abs(stored.baselineEal - run.result.baseline.eal) < 1e-6);
    assert.ok(Math.abs(stored.deltaEal - run.result.delta.eal) < 1e-6);
    assert.equal(Number(stored.costInr), 750_000);
    assert.equal(stored.scenarioStateHash, run.result.scenarioStateHash);

    // ── Re-running appends rather than mutating ────────────────────────────
    const second = await runPersistedScenario({
      organizationId: org.id,
      scenarioId: scenario.id,
    });

    assert.notEqual(second.runId, run.runId, "a re-run must be a new run");
    assert.equal(
      second.result.scenarioStateHash,
      run.result.scenarioStateHash,
      "the same scenario must resolve to the same state"
    );
    assert.equal(
      second.result.scenarioResultHash,
      run.result.scenarioResultHash,
      "the same scenario must produce the same result"
    );

    const storedFirst = await prisma.scenarioAssessment.findUniqueOrThrow({
      where: { id: run.assessmentId },
    });
    assert.ok(
      Math.abs(storedFirst.eal - run.result.scenario.eal) < 1e-6,
      "the first result must not have been mutated by the second run"
    );

    const comparison = await compareScenarioRuns(org.id, scenario.id);
    assert.equal(comparison.comparable, true);
    assert.equal(comparison.sameScenarioState, true);

    // ── Tenant isolation ───────────────────────────────────────────────────
    assert.equal((await listScenarios(otherOrg.id)).length, 0);
    await assert.rejects(
      () => getScenario(otherOrg.id, scenario.id),
      (error: unknown) => error instanceof ScenarioNotFoundError
    );
    await assert.rejects(
      () => runPersistedScenario({ organizationId: otherOrg.id, scenarioId: scenario.id }),
      (error: unknown) => error instanceof ScenarioNotFoundError
    );
  } finally {
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  }
});
