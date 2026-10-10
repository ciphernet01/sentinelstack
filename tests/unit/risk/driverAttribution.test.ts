/**
 * P2 — Driver attribution (COUNTERFACTUAL_V1)
 *
 * A driver must be a *measured* delta: remove the factor, recompute, compare.
 * These tests pin the properties that make the attribution trustworthy:
 * sign, determinism, ranking, and that removing risk actually lowers loss.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  analyticEnterpriseLoss,
  attributeDrivers,
  withoutInternetExposure,
  withoutVulnerabilities,
  DRIVER_ATTRIBUTION_METHOD,
  type CounterfactualState,
} from "../../../src/services/risk/driverAttribution.service";
import { buildRiskParameters } from "../../../src/services/risk/assumptions.service";
import {
  buildControl,
  buildDependency,
  buildEngineAsset,
} from "../../helpers/riskEngineFixture";
import type {
  RiskAssetContext,
  RiskDependencyContext,
} from "../../../src/services/risk/riskCalculationContext";

const parameters = buildRiskParameters();

function analytic(assets: RiskAssetContext[], dependencies: RiskDependencyContext[] = []) {
  return analyticEnterpriseLoss(assets, dependencies, parameters).enterpriseEal;
}

function attribute(
  assets: RiskAssetContext[],
  dependencies: RiskDependencyContext[] = [],
  baselineEal?: number
) {
  return attributeDrivers({
    assets,
    dependencies,
    parameters,
    baselineEal: baselineEal ?? analytic(assets, dependencies),
  });
}

test("analytic expected loss is positive when evidence exists", () => {
  const eal = analytic([buildEngineAsset()]);
  assert.ok(eal > 0, "fixture must produce modelled loss");
  assert.ok(Number.isFinite(eal));
});

test("removing internet exposure lowers analytic expected loss", () => {
  const assets = [buildEngineAsset({ internetExposed: true })];
  const state: CounterfactualState = { assets, dependencies: [] };

  assert.ok(analytic(withoutInternetExposure(state).assets) < analytic(assets));
});

test("removing exploitable vulnerabilities lowers analytic expected loss", () => {
  const assets = [buildEngineAsset()];
  const state: CounterfactualState = { assets, dependencies: [] };

  assert.ok(analytic(withoutVulnerabilities(state).assets) < analytic(assets));
});

test("internet exposure is attributed as a risk-increasing driver", () => {
  const drivers = attribute([buildEngineAsset({ internetExposed: true })]);
  const exposure = drivers.find((driver) => driver.type === "EXPOSURE");

  assert.ok(exposure, "expected an EXPOSURE driver");
  assert.equal(exposure?.direction, "INCREASES_RISK");
  assert.ok((exposure?.contributionToEal ?? 0) > 0);
  assert.ok(exposure?.evidenceRefs.includes("ASSET-001"));
});

test("exploitable vulnerabilities are attributed with their evidence refs", () => {
  const drivers = attribute([buildEngineAsset()]);
  const vulnerability = drivers.find((driver) => driver.type === "VULNERABILITY");

  assert.ok(vulnerability, "expected a VULNERABILITY driver");
  assert.ok((vulnerability?.contributionToEal ?? 0) > 0);
  assert.ok(vulnerability?.evidenceRefs.includes("vuln-001"));
});

test("a weak control is attributed as a gap, a strong control as a mitigation", () => {
  const weak = attribute([
    buildEngineAsset({ controls: [buildControl("ctl-endpoint", "ENDPOINT", 0.2, 0.1)] }),
  ]);
  const strong = attribute([
    buildEngineAsset({ controls: [buildControl("ctl-endpoint", "ENDPOINT", 1, 1)] }),
  ]);

  const gap = weak.find((driver) => driver.type === "CONTROL");
  const mitigation = strong.find((driver) => driver.type === "CONTROL");

  assert.equal(gap?.direction, "INCREASES_RISK");
  assert.equal(mitigation?.direction, "REDUCES_RISK");
  assert.equal(mitigation?.id, "driver:control:ENDPOINT-effective");
});

test("strong controls really reduce expected loss", () => {
  const weak = analytic([
    buildEngineAsset({ controls: [buildControl("ctl-endpoint", "ENDPOINT", 0.2, 0.1)] }),
  ]);
  const strong = analytic([
    buildEngineAsset({ controls: [buildControl("ctl-endpoint", "ENDPOINT", 1, 1)] }),
  ]);

  assert.ok(strong < weak);
});

test("dependency amplification is attributed through blast radius", () => {
  const target = buildEngineAsset({ assetId: "ASSET-001" });
  // A non-signalling asset that depends on the exposed one.
  const dependent = buildEngineAsset({
    assetId: "ASSET-002",
    internetExposed: false,
    controls: [],
    vulnerabilities: [],
    telemetry: [],
  });

  const withoutDependencies = analytic([target, dependent], []);
  const withDependencies = analytic(
    [target, dependent],
    [buildDependency("ASSET-002", "ASSET-001", "DATA")]
  );

  assert.ok(withDependencies >= withoutDependencies);

  const drivers = attribute(
    [target, dependent],
    [buildDependency("ASSET-002", "ASSET-001", "DATA")]
  );
  const dependencyDriver = drivers.find((driver) => driver.type === "DEPENDENCY");

  if (withDependencies > withoutDependencies) {
    assert.ok(dependencyDriver, "expected a DEPENDENCY driver when amplification exists");
    assert.ok((dependencyDriver?.contributionToEal ?? 0) > 0);
  }
});

test("business impact drivers name the dominant loss component", () => {
  const drivers = attribute([buildEngineAsset()]);
  const impact = drivers.find((driver) => driver.type === "BUSINESS_IMPACT");

  assert.ok(impact, "expected a BUSINESS_IMPACT driver for a material asset");
  assert.equal(impact?.entityRef, "ASSET-001");
  assert.ok((impact?.contributionToEal ?? 0) > 0);
});

test("drivers are deterministic and ranked with mitigations last", () => {
  const assets = [buildEngineAsset(), buildEngineAsset({ assetId: "ASSET-002" })];
  const first = attribute(assets);
  const second = attribute(assets);

  assert.deepEqual(
    first.map((driver) => [driver.id, driver.contributionToEal]),
    second.map((driver) => [driver.id, driver.contributionToEal])
  );

  const increasing = first.filter((driver) => driver.direction === "INCREASES_RISK");
  for (let i = 1; i < increasing.length; i += 1) {
    assert.ok(
      (increasing[i - 1].contributionToEal ?? 0) >= (increasing[i].contributionToEal ?? 0),
      "risk-increasing drivers must be sorted by contribution"
    );
  }

  const directions = first.map((driver) => driver.direction);
  const lastIncreasing = directions.lastIndexOf("INCREASES_RISK");
  const firstReducing = directions.indexOf("REDUCES_RISK");
  if (firstReducing >= 0) assert.ok(lastIncreasing < firstReducing);
});

test("every driver carries finite contributions and unique ids", () => {
  const drivers = attribute(
    [buildEngineAsset(), buildEngineAsset({ assetId: "ASSET-002" })],
    [buildDependency("ASSET-002", "ASSET-001")]
  );

  assert.equal(DRIVER_ATTRIBUTION_METHOD, "COUNTERFACTUAL_V1");
  assert.ok(drivers.length > 0);

  for (const driver of drivers) {
    const contribution = driver.contributionToEal ?? 0;
    assert.ok(Number.isFinite(contribution) && !Number.isNaN(contribution));
    assert.ok(contribution >= 0, `${driver.id} contribution must not be negative`);
    assert.ok(driver.id.startsWith(`driver:${driver.type.toLowerCase()}:`));
    assert.ok(["HIGH", "MEDIUM", "LOW"].includes(driver.confidence));
  }

  const ids = drivers.map((driver) => driver.id);
  assert.equal(new Set(ids).size, ids.length, "driver ids must be unique");
});

