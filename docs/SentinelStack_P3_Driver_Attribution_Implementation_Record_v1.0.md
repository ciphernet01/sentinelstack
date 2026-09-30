# P3 — Risk Driver Attribution & Evidence: implementation record

Companion spec: `SentinelStack_P3_Risk_Driver_Attribution_and_Evidence_Implementation_Specification_v1.0.md`
Predecessor record: `SentinelStack_P2_Risk_Engine_v2_Implementation_Record_v1.0.md`

---

## 1. What P3 adds

P1/P2 stored drivers as a JSON blob on `RiskAssessment`. That is fine for
display and useless for analysis: it cannot be filtered by type, cannot be
linked to the source records that justify it, and cannot be compared across
runs.

P3 makes the driver a first-class, evidence-linked record:

```
RiskAssessment (P1, immutable result)
     |
     +--> RiskDriver          normalized, one factor, one contribution
              |
              +--> EvidenceRecord   (many-to-many)
              +--> RiskRun          (which calculation produced it)
              +--> reviewStatus     (human governance, never overwrites)
```

## 2. Data model (`prisma/migrations/20260930000002_...`)

| Model | Purpose |
| --- | --- |
| `RiskDriver` | one attributable factor, bound to an assessment and a run |
| `EvidenceRecord` | immutable source reference, deduplicated per source record |
| `RiskDriverEvidence` | many-to-many link with a relationship type |

Design decisions worth stating:

* **`contributionToVar95` / `contributionToVar99` are nullable.** P2 does not
  attribute the tail per driver. `NULL` means "not computed"; storing `0` would
  be a fabricated claim that the driver contributes nothing to the tail.
* **A driver is unique per `(riskAssessmentId, driverKey)`, not globally.** The
  same factor legitimately appears in every run.
* **`driverKey` is the cross-run identity** (`type:entityType:entityId`). Change
  comparison matches on it, never on id or rank — both are run-specific, and
  using them would report every driver as NEW.
* **`reviewStatus` sits beside the model columns, never on top of them.** A
  human annotation cannot change a contribution or an attribution hash. There is
  a test that asserts exactly this.
* All foreign keys cascade, so deleting an assessment cannot leave orphaned
  drivers or dangling evidence links.

## 3. Modules

| Module | Responsibility |
| --- | --- |
| `evidence.service.ts` | typed evidence drafts, freshness, quality, dedupe, source mapping |
| `riskAttribution.service.ts` | P2 drivers → normalized, evidence-linked, hashed driver records |
| `driverStore.service.ts` | persistence (transactional) + tenant-scoped queries + review annotation |
| `riskChange.service.ts` | run-to-run comparison and version-drift separation |

`driverAttribution.service.ts` (P2) is **unchanged** — it still owns the
measurement. P3 owns the persistence and the explanation. The two never
overlap.

## 4. Rules the implementation holds to

* **P3 does not recalculate risk.** EAL / VaR / score come from P2 untouched
  (spec §5.2). Attribution is downstream of the authoritative number.
* **Evidence can only lower confidence, never raise it.** A driver with no
  evidence is `INSUFFICIENT`; stale evidence caps it at `LOW`; fresh evidence
  cannot promote a method's own `LOW` to `HIGH`.
* **Freshness is measured against `RiskRun.asOf`, not wall-clock now.** A
  re-run of a historical calculation reports the freshness it had at the time,
  and produces the same evidence hash and the same driver hash.
* **Budget overruns are disclosed.** Exceeding `maxDriverCandidates` or
  `maxCounterfactualRuns` yields a partial result plus an explicit warning and a
  `droppedByBudget` count. Attribution is never silently truncated (spec §36).
* **Model/parameter/simulation drift are separate categories.** A model upgrade
  is never reported as a cyber-control failure (spec §22).
* **Tenancy is structural.** `organizationId` is in every `where` and every
  write; writes additionally verify the target assessment belongs to the caller.

## 5. A bug the tests caught

`evidenceForVulnerability` originally derived `observedAt` from `Date.now()`.
That made every driver hash different on each run — a direct violation of the
reproducibility requirement. The test *"the same result always produces the same
driver set"* failed on it. Fixed by threading the calculation's `asOf` through
the evidence builders.

## 6. Verification

```bash
npm run test:risk              # 104 unit + contract tests
$env:RUN_RISK_INTEGRATION_TESTS="true"; npm run test:risk:integration
npx tsc -p tsconfig.backend.json --noEmit
```

The integration test runs the **real** pipeline against PostgreSQL and proves:
attribution is produced by `runEnterpriseRisk`, evidence is deduplicated, a
driver resolves its assessment and run, a valid driver id from another
organisation is refused, a review annotation leaves the attribution hash intact,
and two runs over an unchanged estate produce **zero** `NEW` drivers — which is
the real proof that `driverKey` is stable.

## 7. Not yet built

Deferred, and deliberately so:

* **The driver HTTP API** (`GET /api/v1/risk/drivers`, `/evidence/{id}`,
  `/assessments/{id}/changes`). The service layer and tenancy rules are in place
  and tested; the Express routes are not wired.
* **Frontend consumption.** `RiskDrivers` in the command center still reads the
  legacy `topRiskDrivers`.
* **VaR attribution** — the per-driver tail contribution P2 left `null`.
* **Interaction effects.** Attribution is one-factor-at-a-time; a driver pair
  whose combined effect exceeds the sum of isolated effects is not detected.
  The spec (§17.3) requires that this not be presented as additive, and the
  current shape makes no additive claim across the two, but no interaction
  term is computed.
