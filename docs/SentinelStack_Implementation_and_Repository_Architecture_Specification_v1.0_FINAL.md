SentinelStack | Implementation & Repository Architecture Specification v1.0 

# **SentinelStack** 

## **Implementation & Repository Architecture Specification** 

AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform 

|**Problem Statement**|26105|
|---|---|
|**Requirements Baseline**|SRS v2.1|
|**System Design Baseline**|SDD v1.1|
|**Data / ML / API Baselines**|Data Dictionary v1.0 • Risk Model v1.0 • ML Spec v1.0 • API<br>Contract v1.0|
|**Document Status**|Implementation Planning Baseline — Final|



##### **Implementation constraint** 

The MVP must be buildable at ₹0 software licensing cost using open-source, free-tier, student/free-license, public-data, and self-hosted components. Pirated/cracked software is not a dependency, and no architecture decision may require it. 

### **Document Navigation** 

- 1. Purpose and Baseline 

- 2. Implementation Principles 

- 3. Free-First Technology Baseline 

- 4. Repository and Monorepo Structure 

- 5. Service / Module Boundaries 

- 6. Runtime Data Flow 

- 7. Environment and Configuration 

- 8. Local Development and Docker 

- 9. Development Sequence 

- 10. CI/CD and Quality Gates 

- 11. Testing Strategy 

- 12. Security and Secrets 

- 13. Data / ML / API Integration Rules 

- 14. Definition of Done 

- 15. Traceability to Previous Artifacts 

- 16. Deferred Decisions and Change Control 

### **1. Purpose and Baseline** 

This specification converts the finalized SentinelStack requirements and design artifacts into a practical, low-cost implementation plan. It does not redefine product scope. It defines the repository, runtime components, development sequence, interfaces between code modules, and engineering gates needed to implement the existing baselines. 

##### **Baseline chain** 

PS 26105 → SRS v2.1 → SDD v1.1 → Data Dictionary / DB Schema v1.0 → Risk Quantification & Mathematical Model v1.0 → ML Dataset & Training Spec v1.0 → API & Integration Contract v1.0. 

PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 

### **2. Implementation Principles** 

|**Principle**|**Implementation rule**|
|---|---|
|PS-first|Every implementation task maps to one or more SRS/SDD<br>requirements. Do not add a feature merely because it looks<br>impressive.|
|Free-first|Prefer open-source libraries, public datasets, free tiers, and local<br>execution. Paid enterprise services remain optional adapters, never<br>hard dependencies.|
|Deterministic authority|The Risk Engine owns authoritative EAL, VaR and Risk Score<br>calculations. ML estimates uncertain variables; the LLM explains<br>verified outputs.|
|Evidence lineage|Every material result must be traceable to source data versions,<br>model versions, assumptions, scenario state and calculation<br>timestamp.|
|Replaceable adapters|External security products are integrated through connector<br>contracts and normalized schemas, not embedded throughout<br>business logic.|
|Build locally first|Any feature that cannot run locally should provide a local fallback<br>before cloud deployment is attempted.|
|Secure by default|Tenant isolation, RBAC, secrets management, validation and<br>auditability are built into the platform core rather than added at the<br>end.|



### **3. Free-First Technology Baseline** 

These choices are implementation defaults for the MVP. They may be replaced only when a measurable technical reason exists and the replacement does not introduce a mandatory paid dependency. 

|**Layer**|**Baseline**|**Role**|
|---|---|---|
|Frontend|Next.js + TypeScript|Web UI, executive/technical dashboards,<br>scenario and optimizer views|
|Backend API|FastAPI + Python|REST API, authentication integration,<br>orchestration|
|Database|PostgreSQL|Operational data, relational graph,<br>configurations, computed outputs|
|DB extensions|pgvector where needed|Embeddings / grounded NLQ retrieval<br>without a separate vector database|
|ML|scikit-learn; XGBoost/LightGBM if justified|Likelihood/prediction and anomaly models|
|Numerical risk|NumPy + SciPy|Sampling, distributions, Monte Carlo,<br>statistics|
|Optimization|OR-Tools / SciPy optimize|Budget-constrained portfolio optimization|
|ETL|Python + Pandas|Normalization, enrichment, feature<br>generation|
|Threat data|Public feeds/APIs; replayable fixtures|NVD/KEV/EPSS and other permitted sources|
|LLM|Free-tier API or local/open model|Grounded explanation and NLQ only|
|Containerization|Docker / Docker Compose|Reproducible local runtime|
|Reverse proxy|Caddy or Nginx|TLS termination and routing|
|Observability|Prometheus + Grafana + structured logs|Metrics, health, latency and model/service<br>monitoring|
|CI/CD|GitHub Actions|Lint, unit tests, schema checks, build and<br>security checks|



PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 

|**Layer**|**Baseline**|**Role**|
|---|---|---|
|Evidence integrity|SHA-256 hash chain; blockchain/testnet only<br>as optional extension|Tamper-evident audit/provenance|



##### **No-crack rule** 

A missing paid license must never be “worked around” using cracked software. The supported fallback is: open-source component, free tier, local self-hosting, public dataset, synthetic fixture, or a disabled adapter. 

### **4. Repository and Monorepo Structure** 

A monorepo is selected for the MVP to keep shared schemas, risk contracts, migrations, test fixtures and developer tooling synchronized. 

sentinelstack/ 

├── apps/ 

- │├── web/                         # Next.js frontend │└── api/                         # FastAPI application ├── services/ 

- │├── ingestion/                   # source connectors + normalization │├── risk_engine/                 # deterministic risk calculations │├── ml_engine/                   # model training/inference adapters │├── scenario_engine/             # what-if state mutation + recalculation │├── optimizer/                   # budget portfolio optimization 

- │├── nlq/                         # grounded natural-language query layer │├── compliance/                  # framework mappings + evidence packaging 

- │└── reporting/                   # PDF/CSV/report assembly ├── packages/ 

- │├── contracts/                   # Pydantic/JSON schemas + API DTOs │├── risk_models/                 # versioned risk formulas/config │├── feature_contracts/           # ML feature schemas │└── ui/                          # reusable frontend components ├── data/ │├── raw/                         # local development only; gitignored │├── normalized/                  # local development only │├── fixtures/                    # committed small deterministic fixtures │└── samples/                     # public/synthetic sample data ├── db/ 

- │├── migrations/ 

- │├── seeds/ │└── views/ ├── ml/ 

- │├── 

   - datasets/ 

- │├── notebooks/                   # exploration only 

- │├── 

   - training/ 

PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 

- │├── evaluation/ │└── registry/                    # model metadata, not large binaries ├── infra/ 

- │├── docker/ 

- │├── compose/ 

- │└── cloud/                       # portable deployment manifests ├── tests/ 

- │├── unit/ │├── integration/ │├── contract/ │├── e2e/ │├── performance/ │└── security/ 

- ├── docs/ 

- │├── architecture/ │├── api/ 

- │├── risk_model/ 

- │└── runbooks/ 

- ├── .github/workflows/ 

- ├── .env.example 

- ├── docker-compose.yml 

- ├── Makefile 

- └── README.md 

##### **Code ownership rule** 

Business calculations must not live in API route handlers or UI components. UI calls API contracts; API orchestrates services; services own domain logic; shared contracts are versioned. 

### **5. Service / Module Boundaries** 

|**Module**|**Traceability**|**Owns**|**Produces**|
|---|---|---|---|
|Ingestion|FR-01/02/03|Connectors, polling/webhooks,<br>batch import, agent adapters,<br>retries, source metadata|Normalized events/findings +<br>provenance|
|Digital Twin|FR-07/08/22|Enterprise<br>BU<br>service<br>→<br>→<br>→<br>asset relationships; criticality;<br>control state|Context graph / relational<br>projection|
|Risk Engine|FR-04/05/06/06B/09|Likelihood inputs, impact<br>model, loss distribution, EAL,<br>VaR, Risk Score, drivers|Risk Assessment + Risk Drivers|
|ML Engine|FR-04/05/10|Feature extraction, model<br>loading, inference, calibration<br>metadata, drift signals|Predictions + uncertainty|
|Scenario Engine|FR-13|Copies baseline state, applies<br>hypothetical changes, invokes<br>same risk pipeline|Scenario result + delta<br>EAL/VaR/score|
|AI Decision Layer|FR-10/11/12/12A|Trend insights, grounded<br>recommendations, NLQ,<br>business-language translation|Recommendation / grounded<br>answer|



PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 

|**Module**|**Traceability**|**Owns**|**Produces**|
|---|---|---|---|
|Optimizer|FR-14–19|Candidate filtering,<br>dependencies, constraints,<br>objective, portfolio scoring|Optimization result +<br>cost/benefit/ROSI|
|Compliance|FR-23/24|Framework mappings, evidence<br>linkage, report package<br>assembly|Compliance status + evidence<br>package|
|Reporting|FR-20/21/24|Dashboard read models,<br>PDF/CSV exports, board pack<br>data|Reports / export files|
|Audit|NFR-08|Material-change events, hash<br>chain, lineage references|Tamper-evident audit record|



### **6. Runtime Data Flow** 

1. Connector receives source record/event. 

2. Ingestion validates envelope and records source metadata. 

3. Normalizer maps the record into canonical contracts. 

4. Enrichment resolves CVE/asset/control/service relationships. 

5. Digital Twin updates affected entities and dependency state. 

6. Material changes trigger targeted or full risk recalculation. 

7. Risk Engine invokes ML predictions where required. 

8. Risk Engine calculates authoritative Risk Score, EAL and VaR. 

9. Risk Drivers are extracted from model/data contributions. 

10. Results are persisted with model/version/assumption provenance. 

11. Scenario Engine can clone state and rerun steps 6–10 without mutating baseline. 

12. Optimizer consumes verified scenario/control deltas and applies budget constraints. 

13. Dashboards/reporting read computed outputs, not raw model internals. 

14. NLQ retrieves verified metrics first; LLM generates explanation from that evidence. 

15. Material outputs are added to the audit/provenance chain. 

#### **6.1 Continuous Recalculation Triggers** 

|**Trigger**|**Required behavior**|
|---|---|
|High-severity vulnerability / known exploitation|Affected asset/service risk within NFR-03A high-severity window|
|Control disablement or material coverage change|Affected risk recalculated|
|Threat-intelligence change with material linkage|Affected threat/asset paths recalculated|
|Asset/service/dependency criticality change|Affected service and upstream/downstream risk recalculated|
|Routine low-severity update|Included in scheduled full recalculation|
|Manual analyst-triggered recalculation|Allowed with audit event|



### **7. Environment and Configuration** 

Configuration is environment-driven. Secrets are never committed. Every environment declares its data mode and whether external integrations are enabled. 

ENVIRONMENT=local 

APP_ENV=development 

PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 DATABASE_URL=postgresql://... 

JWT_ISSUER=... 

JWT_AUDIENCE=... 

OBJECT_STORAGE_MODE=local 

LLM_PROVIDER=local|free_api|disabled MODEL_REGISTRY_MODE=filesystem|db TELEMETRY_MODE=fixture|live RISK_RECALC_HIGH_SEVERITY_MINUTES=15 RISK_RECALC_ROUTINE_HOURS=24 

AUDIT_RETENTION_MONTHS=36 

RISK_HISTORY_RETENTION_MONTHS=36 

#### **7.1 Deployment Modes** 

|**Mode**|**Behavior**|
|---|---|
|Local development|Docker Compose; public/synthetic fixtures; no paid services|
|Hackathon/demo|Single cloud VM/free tier or local machine; limited data volume; all<br>core flows enabled|
|Enterprise/private|Customer-controlled infrastructure; real connectors; private data;<br>optional managed services|
|Hybrid|Sensitive telemetry stays local; only derived/approved risk features<br>cross the trust boundary|



### **8. Local Development and Docker** 

The first “works on my machine” target is a single command that starts the complete MVP stack with no proprietary dependency. 

docker compose up --build 

# Expected core containers 

web 

api 

postgres 

worker 

prometheus 

grafana 

(optional) local-llm 

1. Clone the repository and copy .env.example to .env. 

2. Start PostgreSQL and apply migrations/seeds. 

3. Load deterministic public/synthetic fixtures. 

4. Start API and workers. 

5. Open the web application and execute the baseline acceptance scenarios. 

6. Run test and lint gates before committing. 

PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 

### **9. Development Sequence** 

|**Phase**|**Workstream**|**Exit outcome**|
|---|---|---|
|Phase 0|Repository bootstrap|Monorepo, Python environment, Node<br>environment, linting, Docker, migrations, CI<br>skeleton|
|Phase 1|Foundation|Auth/RBAC, tenant model,<br>organization/BU/service/asset CRUD,<br>connector registry, audit primitives|
|Phase 2|Data plane|Canonical contracts, ingestion adapters,<br>normalization, provenance, fixture replay,<br>data-quality checks|
|Phase 3|Risk core|Likelihood integration, financial-impact<br>model, loss distribution, EAL/VaR, Risk<br>Score, risk drivers, history|
|Phase 4|ML|Dataset pipelines, baseline models,<br>calibration, inference service, model<br>registry, drift metrics|
|Phase 5|Decision support|Predictive trends, recommendations,<br>business translation, grounded NLQ|
|Phase 6|Scenario + optimization|What-if engine, control candidates, budget<br>constraints, optimization, ROSI, curve|
|Phase 7|Dashboards + compliance|Executive/technical views, drill-down,<br>framework mappings, evidence/reporting|
|Phase 8|Hardening|Security tests, performance, observability,<br>data-retention tests, cloud deployment|
|Phase 9|PS acceptance|Run full traceability-based acceptance suite<br>and record evidence per requirement|



##### **Build-order rule** 

Do not build the chatbot or polished dashboard first. The minimum vertical slice must prove: real input → normalized evidence → risk calculation → financial exposure → driver explanation → mitigation scenario → budget optimization. 

### **10. CI/CD and Quality Gates** 

|**Gate**|**Required checks**|
|---|---|
|Commit|Formatting, lint, type checks, unit tests|
|Pull Request|Unit + contract tests, migration validation, secret scan, dependency<br>scan, build|
|Merge to main|Integration tests, API schema export, container build|
|Release candidate|E2E, performance smoke tests, security tests, model artifact<br>validation|
|Production/demo release|Database backup check, migration rollback plan, health checks,<br>evidence bundle|



### **11. Testing Strategy** 

|**Test class**|**Primary focus**|
|---|---|
|Unit|Risk formulas, distributions, score transforms, feature transforms,<br>optimizer constraints|
|Contract|API request/response schemas match OpenAPI; connector payloads<br>map to canonical contracts|



PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 

|**Test class**|**Primary focus**|
|---|---|
|Integration|Ingestion<br>DB<br>risk engine<br>API; scenario<br>risk engine;<br>→<br>→<br>→<br>→<br>optimizer<br>decision persistence<br>→|
|E2E|UC-01 through UC-06 from SRS with representative fixtures|
|Model validation|Temporal split, PR-AUC/ROC-AUC, calibration, reliability curve, drift<br>and ablation checks|
|Financial validation|Sanity bounds, monotonicity tests, simulation reproducibility,<br>sensitivity tests|
|Security|RBAC, tenant isolation, authz bypass attempts, secret handling,<br>injection, export access|
|Performance|Ingestion latency, high-severity recalculation window, dashboard<br>response, optimization runtime|



### **12. Security and Secrets** 

- Use environment/secret stores; never commit tokens, keys or customer data. 

- Enforce tenant_id at every data-access boundary. 

- Use least-privilege service accounts and separate DB roles for migration/read/write paths. 

- Validate all connector input against canonical schemas before persistence. 

- Treat imported data as untrusted input; sanitize report/export content. 

- Record authentication, authorization failures and material decisions in audit logs. 

- Do not expose raw sensitive telemetry to the LLM layer unless explicitly permitted by deployment policy. 

- Use encryption in transit and at rest according to the SRS deployment baseline. 

### **13. Data / ML / API Integration Rules** 

|**Boundary**|**Rule**|
|---|---|
|Data<br>Risk<br>→|Only canonical, validated records may enter the risk engine.|
|Risk<br>ML<br>→|ML receives a versioned feature contract and returns a versioned<br>prediction contract with confidence/calibration metadata.|
|ML<br>Risk<br>→|ML does not write EAL/VaR/Risk Score directly; Risk Engine<br>consumes prediction outputs.|
|Risk<br>API<br>→|API returns calculation metadata sufficient for traceability:<br>timestamp, model version, assumptions, data coverage.|
|Scenario isolation|Scenario calculations must never mutate the baseline state.|
|Optimizer input|Only optimization-eligible controls with valid cost and modeled risk-<br>reduction estimates enter the optimizer.|
|NLQ|Natural-language queries resolve into approved backend data<br>operations; no unrestricted SQL generation; no free-form risk-<br>number generation.|
|Reporting|Reports are generated from persisted verified outputs and evidence<br>links, not recomputed ad hoc in the UI.|



### **14. Definition of Done** 

A feature is considered complete only when all applicable conditions below are met. 

- Mapped to an SRS/SDD requirement or documented engineering task. 

- Uses the approved data/API contract rather than an ad hoc payload. 

- Has unit/integration tests appropriate to its risk. 

- Produces audit/provenance metadata when the output is material. 

PS 26105 • Engineering Baseline • Free-first MVP 

SentinelStack | Implementation & Repository Architecture Specification v1.0 

- Does not introduce a mandatory paid or pirated dependency. 

- Works in local Docker mode or has an explicit, documented local fallback. 

- Passes security and authorization checks for affected endpoints. 

- Documentation and configuration examples are updated. 

- Included in the end-to-end regression suite when it changes a baseline user journey. 

### **15. Traceability to Previous Artifacts** 

|**Baseline**|**Implementation realization**|
|---|---|
|SRS FR-01/02/03|Ingestion + normalization modules; canonical contracts; trigger<br>engine|
|SRS FR-04/05/06/06B/09|Risk Engine + ML inference contracts + risk persistence|
|SRS FR-10/11/12/12A/13|AI decision, NLQ, recommendation and scenario modules|
|SRS FR-14–19|Optimizer + investment option/result/decision entities|
|SRS FR-20–22|Read models + dashboard/API endpoints + drill-down|
|SRS FR-23/24|Compliance + reporting + evidence package|
|SRS NFR-01/02/06/08|Security, RBAC, privacy, audit modules|
|SRS NFR-03/03A/04/09/10|Scaling, recalculation SLA, availability, cloud and telemetry<br>retention|
|Risk Model v1.0|Risk engine formulas and calculation pipeline|
|ML Spec v1.0|Dataset/label/features/training/calibration/model registry|
|API Contract v1.0|REST paths, payloads, schemas, async jobs and error model|
|Data Dictionary v1.0|Database entities, constraints, lineage and retention|



### **16. Deferred Decisions and Change Control** 

- Do not freeze a specific cloud provider if a portable implementation meets the SRS/SDD target. 

- Do not add a separate graph database, message broker, vector database or search cluster until measured scale/feature requirements justify it. 

- LLM provider remains replaceable; local/free modes are supported. 

- Blockchain remains an optional evidence/tamper-evidence implementation extension consistent with the SRS baseline. 

- Any change affecting an existing FR/NFR, schema, risk formula, ML contract or API path requires versioned change notes and regression of dependent artifacts. 

##### **Implementation checkpoint** 

Before writing feature code, create the repository skeleton, run the local stack, apply the finalized database migrations, publish the OpenAPI contract, and execute one complete vertical slice using deterministic fixtures. This becomes the first engineering milestone. 

### **Revision Record** 

|**Version**|**Status**|**Change**|
|---|---|---|
|1.0|Final Engineering Planning Baseline|Free-first implementation architecture,<br>repository structure, service boundaries,<br>development sequence, testing and quality<br>gates.|



PS 26105 • Engineering Baseline • Free-first MVP 

