# SentinelStack — P2 Monte Carlo Risk Engine v2: Implementation Record

Phase: **P2** — replace the deterministic point-estimate calculator with a
reproducible Monte Carlo loss engine, structured driver attribution, and a
versioned product risk score.

Companion specs:
`SentinelStack_P2_Risk_Engine_v2_Implementation_Specification_v1.0.md`,
`SentinelStack_Risk_Quantification_and_Mathematical_Model_Specification_v1.1.md`.

---

## 1. What is now authoritative

`riskAssessmentService.runEnterpriseRisk()` runs **`risk-engine-v2.0`** by
default. The P1 deterministic calculator (`deterministic-baseline-v0`) is still
reachable by passing `riskEngineVersion` explicitly, so a result can be compared
against, or rolled back to, without a deploy.

| Version field | Value |
| --- | --- |
| `riskEngineVersion` | `risk-engine-v2.0` |
| `parameterVersion` | `params-2026-09` |
| `modelBundleVersion` | `deterministic-baseline-v0` |
| `featureSetVersion` | `features-v1` |
| `simulationConfigVersion` | `mc-config-v2` |
| `riskScoreVersion` | `risk-score-v1` |
| driver method | `COUNTERFACTUAL_V1` |

## 2. Pipeline

```
evidence signals -> likelihood (versioned provider) -> frequency
  -> severity (per asset x event class, blast radius applied once)
  -> Monte Carlo aggregate annual loss
  -> driver attribution -> risk score -> result hash
```

Every stage is a separate module under `src/services/risk/`:

| Module | Responsibility |
| --- | --- |
| `simulationConfig.service.ts` | simulation count / seed / sampling + quantile method, seeded RNG, Poisson / lognormal samplers |
| `assumptions.service.ts` | versioned parameter and model bundles, validated overrides |
| `evidenceSignals.service.ts` | telemetry + findings + controls -> per-asset signal per event class |
| `likelihood.service.ts` | annual rate -> horizon probability, confidence, out-of-distribution guard |
| `frequency.service.ts` | probability -> annualised Poisson rate, near-certain boundary policy disclosure |
| `severity.service.ts` | loss components with single owners, event-class weights, lognormal severity scale |
| `dependency.service.ts` | blast radius multiplier (capped), applied once per asset |
| `lossDistribution.service.ts` | aggregate annual loss simulation and empirical quantiles |
| `riskScore.service.ts` | 0-100 index from weighted financial / likelihood / control components |
| `driverAttribution.service.ts` | counterfactual deltas per driver, analytic expected loss |
| `riskContext.builder.ts` | Prisma rows -> governed `RiskCalculationContext` |
| `riskEngine.service.ts` | orchestrates the stages, builds the result + hash |

## 3. Anti-double-counting rules that are enforced in code

* Each monetary loss component has exactly one data-model owner
  (`LOSS_COMPONENT_OWNERS`); severity composition never re-adds an amount that
  another owner already contributes.
* Event classes apply **weights** to components instead of adding new amounts.
* Blast radius multiplies one asset's severity **once**. A shared dependency
  amplifies severity; it does not create several independent losses.
* A class's annual rate is allocated to assets proportionally to their adjusted
  signal — the same rule in the analytic and simulated paths, so attribution and
  the Monte Carlo mean agree.

## 4. Reproducibility

* All randomness flows from `createSeededRandom(config.seed)`.
* `RiskCalculationResult.resultHash` covers the numeric result, drivers,
  versions, simulation block and `inputStateHash` — never a timestamp.
* `canonicalResultPayload()` is shared by the engine and the persistence layer,
  so `RiskRun.resultHash` equals the engine's `resultHash` by construction
  (asserted in the integration test).

## 5. Driver attribution

`COUNTERFACTUAL_V1`: remove one factor, recompute enterprise expected loss
analytically (`EAL = sum of lambda x expected severity`), attribute the delta,
rescaled onto the simulated EAL the engine reported. Driver types: `EXPOSURE`,
`VULNERABILITY`, `DEPENDENCY`, `CONTROL`, `MODEL_SIGNAL`, `BUSINESS_IMPACT`.

* A control category is either a **gap** (increases risk) or an **effective
  mitigation** (reduces risk) — measured, never asserted.
* `contributionToScore` is a documented first-order (marginal) sensitivity:
  `dScore = w_E x 100 x dEAL / appetite`, clamped to the 0-100 index.
* `contributionToVaR` is intentionally not populated in P2: per-driver tail
  attribution requires counterfactual simulation, which is P3 scope.

## 6. Uncertainty disclosure

`result.uncertainty` carries the worst confidence across event classes, coverage
counts (assets, controls, telemetry, exposure, dependencies, modelled classes),
an `ood` flag, and human-readable warnings for: near-certain probability caps,
out-of-distribution rates, event classes with no loss-bearing asset,
development-grade simulation counts, and insufficient evidence.

Development runs use fewer than the 50,000-simulation production reference
minimum and are labelled `developmentGrade: true` — the number is never quietly
downgraded.

## 7. API surface

`POST /api/v1/risk/recalculate` now returns the authoritative figures alongside
P1 provenance: `totals`, `riskScoreComponents`, `lossDistribution`, `frequency`,
`drivers`, `uncertainty`, `simulation`. An optional body field
`riskEngineVersion` selects the engine (invalid values are rejected with 400).

## 8. Verification

```bash
npm run test:risk              # engine maths, attribution, score, hashes
npm run test:risk:integration  # full lifecycle against Postgres (opt-in)
npx tsc -p tsconfig.backend.json --noEmit
```

Engine tests (`tests/unit/risk/monteCarloEngine.test.ts`,
`driverAttribution.test.ts`, `riskScore.test.ts`) pin: exact reproducibility for
an identical context, quantile ordering, seed stability of the mean,
monotonicity in business impact and controls, disclosure of development-grade
sampling, exact `financialExposure` composition, zero-rate handling without
NaNs, driver sign / ranking / uniqueness, and score reconstructability from the
persisted components.

The integration test additionally proves, against a real database, that the
persisted `RiskRun.resultHash` equals the engine's `resultHash` and that the
structured driver rows reach `RiskAssessment.drivers`.

## 9. Known limitations carried into P3

* Monte Carlo at the production 50,000-simulation reference is compute-bound;
  P2 ships `mc-config-v2` defaults at 10,000 simulations, explicitly labelled
  development-grade rather than silently reduced.
* VaR contribution per driver is not computed (see section 5).
* `averageLikelihood` is the mean modelled class probability, chosen to keep
  historical rows comparable; the score itself uses the *maximum* class
  probability, so the two figures intentionally differ.
* Counterfactual attribution is local (one factor removed at a time).
  Interaction effects between correlated drivers are P3 attribution work.


