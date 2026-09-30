SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

# **SentinelStack** 

## **Detailed Data Dictionary & Database Schema** 

### AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform 

|**Field**|**Value**|
|---|---|
|Problem Statement|26105|
|Organization|All India Council for Technical Education (Cyber Security<br>Cell)|
|Document Version|1.0 - Final EngineeringData Baseline|
|Document Status|Schema and Data Dictionary- SRS v2.1 / SDD v1.1 Aligned|
|Reference Database|PostgreSQL-compatible relational design|
|Primary Purpose|Canonical operational data model for ingestion, risk<br>analytics, AI decision support, scenarios, optimization,<br>compliance and audit|



**Engineering intent:** Define the authoritative logical data model behind the approved SRS and SDD. The schema separates raw-source provenance from normalized operational state, preserves model and risk lineage, and supports tenant isolation, historical risk snapshots, scenario simulation and budget optimization. 

Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **Contents** 

- 1. Document Purpose and Boundaries 

- 2. Data Architecture Principles 

- 3. Canonical Data Domains 

- 4. Logical Data Model and Relationships 

- 5. Core Entity Dictionary 

- 6. Security, Threat and Control Dictionary 

- 7. Risk, AI, Scenario and Investment Dictionary 

- 8. Ingestion, Provenance and Audit Dictionary 

- 9. Field Semantics and Controlled Vocabularies 

- 10. Retention, Partitioning and Lifecycle 

- 11. Indexing and Query Design 

- 12. Data Integrity, Tenant Isolation and Security 

- 13. Data Lineage and Evidence Design 

- 14. SRS / SDD Traceability 

- 15. Implementation Notes and Schema Evolution 

- Appendix A. PostgreSQL DDL Baseline 

- Appendix B. Verification Checklist 

#### **1. Document Purpose and Boundaries** 

This document converts the approved SentinelStack SRS v2.1 and SDD v1.1 into an implementable relational data contract. It defines the entities, fields, keys, relationships, constraints, indexes, retention rules, provenance model and database conventions required for the system to execute the PS 26105 workflow. 

- Operational truth is stored in normalized relational structures; high-volume raw telemetry may reside in object storage with database metadata and cryptographic hashes retained in source_records. 

- RiskAssessment is the authoritative persisted snapshot of computed EAL, VaR, Financial Exposure and Risk Score for a defined scope and timestamp. 

- ML/AI outputs are stored with model version, feature/prediction metadata and evidence/lineage references so model-generated inputs cannot silently overwrite deterministic risk outputs. 

- Scenario data is isolated from baseline operational state: scenario_changes are state mutations evaluated against a baseline assessment, not modifications to production asset/control records. 

- Evidence and audit records are append-oriented and link back to source data, assessments, recommendations and investment decisions. 

#### **2. Data Architecture Principles** 

|**Principle**|**Database realization**<br>i|**Why it matters for PS 26105**|
|---|---|---|
|Canonical representation|Source-specific records are normalized<br>into shared entities and controlled<br>vocabularies.|Supports FR-01/FR-02 multi-source<br>ingestion and correlation.|
|Business context first-class|Business units, services, criticality,<br>dependencies and financial parameters<br>are modeled explicitly.|Enables FR-07 and FR-05 business-impact<br>estimation.|
|Temporal state|Security findings, controls, threat signals<br>and risk assessments carry<br>observed/effective timestamps.|Enables FR-03 continuous updates and<br>FR-06A trend history.|
|Model lineage|Predictions reference model_versions; risk<br>assessments reference model versions|Supports FR-04/05, FR-09 and NFR-05<br>explainability.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

|**Principle**|**Database realization**|**Why it matters for PS 26105**|
|---|---|---|
||and input records.||
|Evidence integrity|Evidence carries content hashes; audit<br>events carry payload hashes.|Supports FR-24 and NFR-08<br>auditability/tamper evidence.|
|Data minimization|Raw payload bodies are not required in the<br>transactional schema; object storage and<br>retention are policy-driven.|Supports NFR-06 privacy and enterprise<br>deployment constraints.|
|Tenant isolation|Organization is the root scope and all<br>tenant-owned operational records carry<br>org_id directly or through an FK path.|Supports NFR-02 least privilege and multi-<br>tenant SaaS deployment.|



#### **3. Canonical Data Domains** 

|**Domain**|**Primary entities**|**Purpose**|
|---|---|---|
|Foundation & tenancy|organizations, user_profiles,<br>organization_memberships|Tenant scope, identity linkage and RBAC<br>context.<br>i|
|Business context|business_units, services, assets,<br>service_dependencies,<br>asset_service_links, financial_parameters|Connects technical findings to business<br>criticality, service dependencies and<br>financial impact.|
|Security telemetry|vulnerabilities, asset_vulnerabilities,<br>security_events, threat_signals, incidents<br>i|Stores normalized security evidence used<br>by the Digital Twin and risk engine.|
|Controls & compliance|control_definitions, control_states,<br>framework_controls,<br>control_framework_mappings|Models control posture, effectiveness and<br>framework mappings.|
|Risk analytics|model_versions, model_predictions,<br>risk_assessments, risk_drivers,<br>risk_assessment_inputs|Stores authoritative risk outputs,<br>predictive inputs and attribution/lineage.|
|Decision intelligence|scenarios, scenario_changes,<br>investment_options, optimization_runs,<br>optimization_results, recommendations,<br>investment_decisions|Supports what-if analysis,<br>recommendations, cost-effectiveness,<br>ROSI, optimization and governed approval.|
|Ingestion & provenance|integration_sources, ingestion_runs,<br>source_records, data_quality_issues|Provides source lifecycle, ingestion status,<br>data quality and provenance.|
|Governance & evidence|evidence, evidence_links, audit_events|Provides traceability, evidence packages<br>and tamper-evident audit records.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **4. Logical Data Model and Relationships** 



<!-- Start of picture text -->
SentinelStack Core Relational Data Model<br>organizations business_units services assets<br>PK org_id<br>Pk buid PK serviceid a PK asset_id<br>asset_vulnerabilities security_events ; threat_signals control_states model_predictions<br>PK finding_id PK Pk threat. signal id PK stateid PX pupiiction id<br>risk_assessments == Tisk_drivers scenarios investment_options recommendations evidence<br>PK absessment_id / EAL/ VaR/ $core PK driver_id PK scenario_id PK option_id PK recommendation_id PK evidence_id / SHA-256<br>Security/context: vulnerabilities, telemetry, threats and control state feed risk assessment.<br>Decision: risk + drivers / scenarios ~+ investments ~ recommendations + evidence.<br><!-- End of picture text -->

_Figure 1. Logical relational model grouped by data domain._ 

Cardinality rules follow the SDD but normalize many-to-many or temporal state where required. In particular, control definition is separated from control state, and vulnerability catalog data is separated from asset-specific vulnerability findings. This avoids duplicating reference data while retaining asset-level risk context. 

Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

##### **4.1 Relationship Rules** 

|**Relationship**|**Cardinality / rule**|**Design consequence**|
|---|---|---|
|Organization → BusinessUnit|1:N|Business units cannot exist outside an organization.|
|BusinessUnit → Service|1:N|Services inherit tenant scope through BU.<br>f|
|Service ↔ ServiceDependency ↔ Service|N:N|Explicit dependency edge with type, strength and effective<br>dates.|
|Asset ↔ Service via AssetServiceLink|N:N|Supports shared infrastructure/services while allowing one<br>primary service flag.<br>i|
|Vulnerability → AssetVulnerability|1:N|Catalog CVE separated from asset-specific state such as<br>patch status and exposure.<br>f|
|ControlDefinition → ControlState|1:N temporal|Control capability is stable; observed state/effectiveness<br>changes over time.|
|RiskAssessment → RiskDriver|1:N|Each material assessment can expose multiple model-<br>derived contributors.|
|Scenario → ScenarioChange|1:N|Scenario mutations are immutable inputs to scenario<br>execution.|
|Evidence → EvidenceLink|1:N|A single evidence package can support multiple related<br>records.|
|IngestionRun → SourceRecord|1:N|Every imported record can be tied to a source and ingestion<br>event.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **5. Core Entity Dictionary** 

The tables below define the database-level contract for tenancy, business context and enterprise topology. Types are PostgreSQL-oriented and may be adapted to a compatible relational engine without changing semantics. 

|**Entity**|**Purpose**|**Primary Key**|**Foreign Keys**|**Key constraints / notes**|
|---|---|---|---|---|
|organizations|Tenant root and monetary/reporting<br>context|org_id|—|currency is ISO-4217; timezone is<br>IANA; all operational records must<br>be tenant-scoped.|
|user_profiles|Application identity linkage|user_id|auth_subject external|Authentication secret/token<br>material is not stored here.|
|organization_memberships|RBAC and scoped authorization|membership_id|org_id, user_id|Unique(org_id,user_id,role)<br>recommended; scope_json<br>restricts assigned views.|
|business_units|Businessgroupingand criticality|bu_id|org_id|criticality_score 0–100.|
|services|Business/technical service and<br>impact context|service_id|bu_id|downtime_cost_per_hour in org<br>currency; criticality 0–100.|
|assets|Canonical technical asset|asset_id|org_id|Asset is the primary technical risk<br>object; exposure and criticality are<br>explicit.|
|asset_service_links|Asset ↔ service relationship|link_id|asset_id, service_id|Supports multiple service<br>associations and primary-service<br>semantics.|
|service_dependencies|Service dependency edges|dependency_id|service_id, depends_on_service_id|No self-dependency; strength 0–<br>100.|
|financial_parameters|Approved business-impact inputs|parameter_id|org_id|Versioned by validity window;<br>assumptions explicitly flagged.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **6. Security, Threat and Control Dictionary** 

|**Entity**|**Purpose**|**Key fields**|**Risk-engine usage**|
|---|---|---|---|
|vulnerabilities|CVE/reference vulnerability catalog|cve_id, cvss_score, epss_score, kev_flag,<br>exploit_available|Provides standardized vulnerability/exploit<br>evidence.|
|asset_vulnerabilities|Point-in-time vulnerability state on asset|asset_id, vulnerability_id, patch_state,<br>severity_normalized, exposure,<br>exploit_observed|Feeds exploitation likelihood and risk drivers.|
|security_events|Normalized SIEM/EDR/IAM/CSPM/other<br>telemetry|event_type, severity, observed_at, attributes,<br>source_confidence|Provides behavioral and control signals.|
|threat_signals|External or observed threat activity|signal_type, target_scope, confidence,<br>timestamps|Feeds threat activity and likelihood/trend<br>signals.|
|incidents|Confirmed historical security events|incident_type, occurred_at, loss_estimate|Supports incident-frequency and severity<br>calibration.|
|control_definitions|Stable security control catalog|name, family, implementation_type|Defines controls independently of observed<br>state.|
|control_states|Observed control posture/effectiveness|coverage, configuration_strength,<br>effectiveness_score, freshness|Provides control effectiveness input to risk<br>engine.|
|framework_controls|External framework reference|framework, control_code, version|Reference catalog for compliance mapping.|
|control_framework_mappings|Internal control to framework linkage|control_id, framework_control_id, coverage_pct|Supports FR-23 and evidence-backed<br>compliance reporting.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **7. Risk, AI, Scenario and Investment Dictionary** 

|**Entity**|**Purpose**|**Authoritative?**|**Key fields**|**Design rule**|
|---|---|---|---|---|
|model_versions|Model governance/version registry|Yes for model identity, not for risk<br>value|version, workload_type,<br>training_dataset_hash, metrics_json,<br>status|Only approved versions may feed<br>production risk calculations.|
|model_predictions|Persisted ML/statistical outputs|No; input to risk engine|prediction_type, prediction_value,<br>bounds, explanation_json|Prediction values are inputs; they do<br>not replace deterministic risk metrics.|
|risk_assessments|Canonical financial risk snapshot|Yes|EAL, VaR, risk_score,<br>financial_exposure, confidence,<br>calculation_hash|Authoritative system output for a<br>scope/time/model bundle.|
|risk_assessment_inputs|Assessment input lineage|Yes for lineage|source_record_id, prediction_id,<br>input_role, contribution_weight|Allows assessment<br>reconstruction/explanation.|
|risk_drivers|Model/data-derived attribution<br>records|Yes for attribution|rank, contribution, entity reference,<br>evidence_refs|Drivers must be reproducible from<br>underlying model/data.|
|scenarios|Non-production state mutation<br>container|No; scenario result is analytical|baseline_assessment_id, status,<br>result_assessment_id|Never mutate baseline operational<br>state.|
|scenario_changes|Individual scenario mutations|No|field_name, old/new JSON,<br>change_type|Deterministic application order<br>required.|
|investment_options|Candidate control/remediation<br>portfolio items|No; candidate input|cost, coverage, dependencies,<br>risk_reduction, applicability|Option is eligible for optimization only<br>when risk reduction is<br>quantified/validated.|
|recommendations|Action proposals grounded in<br>assessment/model data|No|priority_rank, risk_reduction, cost,<br>confidence, evidence_refs|LLM may explain; it may not invent<br>authoritative values.|
|optimization_runs|Optimizer execution and constraint<br>record|Yes for run metadata|budget, constraints_json,<br>optimizer_version, status|Makes budget-constrained<br>optimization reproducible.|
|optimization_results|Option-level/portfolio-level optimizer<br>output|No|selected, cost, risk reduction,<br>residual EAL/VaR, ROSI|Supports investment curves and<br>decision packs.|
|investment_decisions|Human-governed approval record|Yes for decision state|decision_status, approved_by,<br>approved_at, notes, evidence_refs|Separates analytical<br>recommendation from human<br>authorization.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **8. Ingestion, Provenance and Audit Dictionary** 

|**Entity**|**Purpose**<br>i|**Required provenance**|**Lifecycle**|
|---|---|---|---|
|integration_sources|Configured enterprise connector|source class, mechanism, schema version|Active → paused/error → retired.|
|ingestion_runs|One connector execution|start/end, counts, source|Append per run; errors retained.|
|source_records|Record-level source lineage registry|source-native id, timestamps, payload hash,<br>object URI|Hot → standard → archive → purge according to<br>policy.|
|data_quality_issues|Quarantine/quality workflow|rule code, severity, resolution state|Open → resolved/waived.|
|evidence|Evidence package for audit/decision support|source link, collected_at, content hash,<br>object URI|Retained according to evidence/audit policy.|
|evidence_links|Generic evidence relationship|entity type/id, link role|Append-oriented; used by reports and audits.|
|audit_events|Tamper-evident user/system action trail|actor, action, timestamp, payload hash,<br>previous hash|Append-only; minimum 36 months per SRS<br>NFR-08.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **9. Field-Level Data Dictionary** 

The field tables are the baseline physical/logical contract. “CHECK” values identify domain constraints; “FK” identifies relational references. All timestamps are UTC at storage level. 

##### **Foundation & Business Context** 

###### **organizations** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|org_id|uuid|NO|PK|Stable organization/tenant identifier.|
|name|varchar(200)|NO||Organization display name.|
|currency|char(3)|NO||ISO-4217 currency code for monetary<br>outputs.|
|timezone|varchar(64)|NO||IANA timezone used for business-local<br>views.|
|status|varchar(20)|NO|CHECK|active / suspended / archived.|
|created_at|timestamptz|NO||Creation timestamp.|
|updated_at|timestamptz|NO||Last metadata update.|



###### **user_profiles** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|user_id|uuid|NO|PK|Application user identifier; may<br>correspond to external auth subject.|
|auth_subject|varchar(255)|NO|UNIQUE|External identity-provider subject.|
|display_name|varchar(160)|YES||Display name.|
|email|varchar(320)|YES||Notification/login email when permitted<br>by deployment.|
|created_at|timestamptz|NO||Creation timestamp.|
|disabled_at|timestamptz|YES||Set when access is disabled.|



###### **organization_memberships** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|membership_id|uuid|NO|PK|Membership identifier.|
|org_id|uuid|NO|FK|Organization scope.|
|user_id|uuid|NO|FK|User profile.|
|||||CISO / RISK_OFFICER /|
|role|varchar(40)|NO|CHECK|SECURITY_ANALYST / EXECUTIVE /<br>COMPLIANCE / ADMIN.|
|scope_json|jsonb|NO||Optional business-unit or service scope<br>restrictions.|
|created_at|timestamptz|NO||Membership creation time.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

###### **business_units** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|bu_id|uuid|NO|PK|Business unit identifier.|
|org_id|uuid|NO|FK|Owning organization.|
|name|varchar(200)|NO||Business unit name.|
|criticality_score|numeric(5,2)|NO|0..100|Business criticality score.|
|owner|varchar(160)|YES||Business owner reference.|
|created_at|timestamptz|NO||Creation time.|



###### **services** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|service_id|uuid|NO|PK|Service identifier.|
|bu_id|uuid|NO|FK|Owning business unit.|
|name|varchar(200)|NO||Service name.|
|service_type|varchar(80)|YES||Application, API, data platform,<br>infrastructure service, etc.|
|criticality_score|numeric(5,2)|NO|0..100|Business/service criticality.|
|downtime_cost_per_hour|numeric(20,2)|YES|>=0|Modeled business downtime cost in org<br>currency.|
|rto_minutes|integer|YES|>=0|Recovery time objective when available.|
|status|varchar(20)|NO|CHECK|active / retired.|
|created_at|timestamptz|NO||Creation time.|



###### **assets** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|asset_id|uuid|NO|PK|Canonical asset identifier.|
|org_id|uuid|NO|FK|Owning organization.|
|asset_type|varchar(50)|NO||Host, application, cloud resource,<br>identity set, database, etc.|
|name|varchar(255)|NO||Asset display name.|
|external_identifier|varchar(255)|YES||Source-native identifier.|
|owner|varchar(160)|YES||Asset owner.|
|criticality_score|numeric(5,2)|NO|0..100|Asset criticality.|
|internet_exposed|boolean|NO|DEFAULT false|Whether externally reachable.|
|environment|varchar(40)|YES||prod / stage / dev / unknown.|
|status|varchar(20)|NO|CHECK|active / retired / unknown.|
|first_seen_at|timestamptz|YES||First observed.|
|last_seen_at|timestamptz|YES||Last observed.|



###### **asset_service_links** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|link_id|uuid|NO|PK|Relationship identifier.|
|asset_id|uuid|NO|FK|Asset.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

||||SentinelStack|Data Dictio|nary& Database Schema v1.0|PS 26105|
|---|---|---|---|---|
|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|service_id|uuid|NO|FK|Service.|
|relationship_type|varchar(40)|NO||hosts / supports / depends_on /<br>processes_data.|
|is_primary|boolean|NO|DEFAULT false|Primary service association.|
|effective_from|timestamptz|NO||Relationship start.|
|effective_to<br>**ervice_dependencies**|timestamptz|YES||Relationship end.|
|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**<br>i|
|dependency_id|uuid|NO|PK|Dependency edge identifier.|
|service_id|uuid|NO|FK|Dependent service.|
|depends_on_service_id|uuid|NO|FK|Upstream service.|
|dependency_type|varchar(50)|NO||runtime / data / identity / infrastructure /<br>external.|
|strength|numeric(5,2)|NO|0..100|Dependency strength used for<br>propagation.|
|effective_from|timestamptz|NO||Start of relationship.|
|effective_to|timestamptz|YES||End of relationship.|



###### **service_dependencies** 

###### **financial_parameters** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|parameter_id|uuid|NO|PK|Financial parameter identifier.|
|org_id|uuid|NO|FK|Tenant.|
|scope_type|varchar(20)|NO|CHECK|organization / business_unit / service.|
|scope_id|uuid|NO||Target scope identifier; validated by<br>application layer.|
|parameter_name|varchar(100)|NO||e.g. downtime_cost_per_hour,<br>breach_cost_per_record.|
|value_numeric|numeric(20,4)|NO||Numeric parameter value.|
|currency|char(3)|NO||ISO-4217 code.|
|valid_from|timestamptz|NO||Effective start.|
|valid_to|timestamptz|YES||Effective end.|
|source_type|varchar(40)|NO||admin_input / finance_system /<br>approved_assumption / derived.|
|assumption_flag|boolean|NO|DEFAULT false|True when value is an explicit<br>assumption rather than observed data.|



##### **Security & Controls** 

###### **vulnerabilities** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|vulnerability_id|uuid|NO|PK|Canonical vulnerability identifier.<br>i|
|cve_id|varchar(32)|YES|UNIQUE|CVE identifier when available.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|title|varchar(500)|YES||Vulnerability title.|
|cvss_score|numeric(4,2)|YES|0..10|CVSS score.|
|published_at|timestamptz|YES||Public publication date.|
|epss_score|numeric(8,6)|YES|0..1|EPSS probability when available.|
|kev_flag|boolean|NO|DEFAULT false|Known exploited vulnerability indicator.|
|exploit_available|boolean|YES||Exploit availability indicator.|
|created_at|timestamptz|NO||Catalog record creation time.|



###### **asset_vulnerabilities** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|finding_id|uuid|NO|PK|Asset-specific vulnerability finding<br>identifier.|
|asset_id|uuid|NO|FK|Affected asset.|
|vulnerability_id|uuid|NO|FK|Vulnerability catalog entry.|
|first_seen_at|timestamptz|NO||First observed on asset.|
|last_seen_at|timestamptz|NO||Most recent observation.|
|vulnerability_age_days|integer|YES|>=0|Derived age at observation.|
|patch_state|varchar(30)|NO|CHECK|unpatched / partial / patched /<br>not_applicable / unknown.|
|severity_normalized|numeric(4,2)|NO|0..10|Canonical severity after source<br>normalization.|
|internet_exposed_at_observation|boolean|YES||Observed exposure state.|
|exploit_observed|boolean|YES||Whether exploitation was observed in<br>local evidence.|
|source_confidence|numeric(5,4)|YES|0..1|Source confidence.|
|observed_at|timestamptz|NO||Point-in-time state timestamp.|



###### **security_events** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|security_event_id|uuid|NO|PK|Normalized event identifier.|
|org_id|uuid|NO|FK|Tenant.|
|asset_id|uuid|YES|FK|Associated asset.|
|service_id|uuid|YES|FK|Associated service.|
|source_record_id|uuid|YES|FK|Provenance link.|
|event_type|varchar(100)|NO||Normalized event type.|
|severity|numeric(4,2)|YES|0..10|Normalized severity.|
|observed_at|timestamptz|NO||Observed event time.|
|attributes|jsonb|NO||Source-specific normalized attributes.|
|source_confidence|numeric(5,4)|YES|0..1|Source confidence.|



###### **threat_signals** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**<br>i|
|---|---|---|---|---|
|threat_signal_id|uuid|NO|PK|Threat intelligence signal identifier.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|org_id|uuid|NO|FK|Tenant.|
|source_record_id|uuid|YES|FK|Provenance.|
|signal_type|varchar(100)|NO||Threat indicator, campaign, actor<br>activity, KEV, etc.|
|target_scope_type|varchar(20)|YES||asset / service / organization.|
|target_scope_id|uuid|YES||Target identifier.|
|confidence|numeric(5,4)|NO|0..1|Signal confidence.|
|severity|numeric(4,2)|YES|0..10|Normalized severity when supplied.|
|observed_at|timestamptz|NO||Signal time.|
|expires_at|timestamptz|YES||Expiry time when applicable.|



###### **incidents** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|incident_id|uuid|NO|PK|Confirmed incident identifier.|
|org_id|uuid|NO|FK|Tenant.|
|service_id|uuid|YES|FK|Affected service.|
|asset_id|uuid|YES|FK|Primary affected asset.|
|incident_type|varchar(100)|NO||Ransomware, breach, outage,<br>compromise, etc.|
|occurred_at|timestamptz|NO||Incident occurrence/start.|
|closed_at|timestamptz|YES||Incident closure.|
|status|varchar(30)|NO|CHECK|open / contained / closed.|
|loss_estimate|numeric(20,2)|YES|>=0|Observed/estimated incident loss.|
|loss_currency|char(3)|YES||Currency for loss estimate.|
|confirmed|boolean|NO|DEFAULT true|Whether confirmed by authorized<br>source.|



###### **control_definitions** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|control_id|uuid|NO|PK|Canonical control identifier.|
|name|varchar(250)|NO||Control name.|
|control_family|varchar(120)|YES||Logical control family.|
|description|text|YES||Control description.|
|implementation_type|varchar(40)|YES||technical / process / governance /<br>physical.|
|created_at|timestamptz|NO||Creation time.|



###### **control_states** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|state_id|uuid|NO|PK|Observed control-state identifier.|
|control_id|uuid|NO|FK|Control definition.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

||||SentinelStack|Data Dictio|nary& Database Schema v1.0|PS 26105<br>**i**|
|---|---|---|---|---|
|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|org_id|uuid|NO|FK|Tenant.|
|asset_id|uuid|YES|FK|Affected asset where control is asset<br>scoped.|
|service_id|uuid|YES|FK|Affected service where scoped.|
|implementation_status|varchar(30)|NO||implemented / partial / planned /<br>absent / unknown.|
|coverage_pct<br>i|numeric(5,2)|YES|0..100|Observed coverage.<br>i|
|configuration_strength|numeric(5,2)|YES|0..100|Configuration strength.|
|effectiveness_score|numeric(5,4)|YES|0..1|Model-derived control effectiveness.|
|effectiveness_confidence|numeric(5,4)|YES|0..1|Confidence in effectiveness.|
|incident_history_signal|numeric(5,4)|YES|0..1|Historical signal used by model.|
|evidence_fresh_at|timestamptz|YES||Freshness of supporting evidence.|
|observed_at|timestamptz|NO||Point-in-time state.|



###### **framework_controls** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|framework_control_id|uuid|NO|PK|Framework control identifier.|
|framework|varchar(80)|NO|CHECK|ISO27001 / NIST_CSF / CIS / RBI_CSF /<br>SEBI_CYBER_RESILIENCE.|
|control_code|varchar(80)|NO||Framework control reference.|
|title|varchar(250)|YES||Control title.|
|description|text|YES||Framework description.|
|version|varchar(40)|YES||Framework version/reference.|



###### **control_framework_mappings** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|mapping_id|uuid|NO|PK|Mapping identifier.|
|control_id|uuid|NO|FK|Internal control.|
|framework_control_id|uuid|NO|FK|Mapped framework control.|
|mapping_type|varchar(40)|NO||primary / supporting / partial /<br>informative.|
|coverage_pct|numeric(5,2)|YES|0..100|How fully the internal control satisfies<br>mapping.|
|evidence_refs|jsonb|NO||Evidence identifiers for mapping<br>support.|



##### **Risk & Decision Intelligence** 

###### **model_versions** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|model_version_id|uuid|NO|PK|Model version identifier.|
|model_name|varchar(120)|NO||Model/workload name.|
|version|varchar(50)|NO||Semantic or build version.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

|||SentinelStack|Data Dictio|nary& Database Schema v1.0|PS 26105<br>**i**|
|---|---|---|---|
|**Field**|**PostgreSQL type**|**Null**<br>**Key / constraint**|**Definition**|
|workload_type|varchar(50)|NO|likelihood / impact / anomaly / trend /<br>recommendation.|
|training_dataset_hash|char(64)|YES|SHA-256 hash of training dataset<br>snapshot/manifest.|
|metrics_json|jsonb|NO|Validation metrics and calibration<br>statistics.|
|feature_schema_hash|char(64)|YES|Hash of expected feature schema.|
|approved_at|timestamptz|YES|Governance approval time.|
|status|varchar(30)|NO<br>CHECK|candidate / approved / retired.|



###### **model_predictions** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|prediction_id|uuid|NO|PK|Prediction identifier.|
|model_version_id|uuid|NO|FK|Model version.|
|org_id|uuid|NO|FK|Tenant.|
|asset_id|uuid|YES|FK|Asset scope when applicable.|
|service_id|uuid|YES|FK|Service scope when applicable.|
|prediction_type|varchar(50)|NO||exploitation_probability /<br>incident_frequency /<br>impact_parameter / anomaly_score /<br>trend.|
|prediction_value|numeric(20,8)|NO||Point estimate or score.|
|lower_bound|numeric(20,8)|YES||Lower uncertainty bound.|
|upper_bound|numeric(20,8)|YES||Upper uncertainty bound.|
|prediction_time|timestamptz|NO||Prediction timestamp.|
|valid_until|timestamptz|YES||Expected validity end.|
|explanation_json|jsonb|YES||Feature contribution / supporting<br>metadata.|



###### **risk_assessments** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|assessment_id|uuid|NO|PK|Authoritative risk assessment snapshot.|
|org_id|uuid|NO|FK|Tenant.|
|scope_type|varchar(20)|NO|CHECK|organization / business_unit / service /<br>asset.|
|scope_id|uuid|NO||Scope identifier.|
|assessed_at|timestamptz|NO||Timestamp of computed assessment.|
|risk_score|numeric(6,2)|NO|0..100|Normalized risk score.|
|incident_probability|numeric(8,6)|YES|0..1|Primary modeled incident likelihood<br>probability for the declared horizon<br>when applicable.|
|annual_incident_frequency|numeric(12,6)|YES|>=0|Modeled expected incident frequency<br>per year when the risk model uses<br>frequency.|
|potential_financial_impact|numeric(20,2)|NO|>=0|Modeledpotential financial/business|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|||||impact for the assessment scope.|
|eal|numeric(20,2)|NO|>=0|Expected Annual Loss in org currency.|
|var_horizon_days|integer|NO|>0|VaR horizon.|
|var_confidence|numeric(6,4)|NO|0..1|VaR confidence percentile.|
|var_value|numeric(20,2)|NO|>=0|Value at Risk.|
|financial_exposure|numeric(20,2)|NO|>=0|Declared financial exposure metric for<br>dashboard/reporting.|
|currency|char(3)|NO||Currency.|
|likelihood_summary|jsonb|NO||Frequency/probability summary.|
|impact_summary|jsonb|NO||Severity/impact distribution summary.|
|control_effectiveness_summary|jsonb|NO||Control effectiveness roll-up.|
|data_coverage_pct|numeric(5,2)|NO|0..100|Coverage indicator.|
|confidence_score|numeric(5,4)|NO|0..1|Overall estimate confidence.|
|model_bundle_version|varchar(100)|NO||Risk engine/model bundle identifier.|
|calculation_hash|char(64)|NO||Hash of canonicalized assessment<br>inputs/outputs.|



###### **risk_assessment_inputs** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|input_id|uuid|NO|PK|Input-lineage identifier.|
|assessment_id|uuid|NO|FK|Risk assessment.|
|source_record_id|uuid|YES|FK|Source record used.|
|prediction_id|uuid|YES|FK|Model prediction used.|
|entity_type|varchar(50)|NO||Entity/data type.|
|entity_id|uuid|YES||Canonical entity id.|
|input_role|varchar(80)|NO||likelihood_feature / impact_parameter /<br>control_state / threat_signal /<br>business_context.|
|contribution_weight|numeric(10,6)|YES||Optional sensitivity/weight used for<br>attribution.|
|created_at|timestamptz|NO||Lineage record creation.|



###### **risk_drivers** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|driver_id|uuid|NO|PK|Risk-driver identifier.|
|assessment_id|uuid|NO|FK|Parent assessment.|
|driver_type|varchar(80)|NO||Vulnerability, exposure, control<br>weakness, service criticality, etc.|
|entity_type|varchar(40)|YES||asset / service / vulnerability / control /<br>threat.|
|entity_id|uuid|YES||Contributing entity.|
|rank|integer|NO|>0|Driver rank.|
|contribution_value|numeric(20,6)|YES||Model-derived contribution metric.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

||||SentinelStack|Data Dictio|nary& Database Schema v1.0|PS 26105<br>**i**|
|---|---|---|---|---|
|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|contribution_share|numeric(10,6)|YES||Share of risk attribution.|
|direction|varchar(20)|NO|CHECK|increases / decreases / mixed.|
|explanation|text|YES||Human-readable explanation derived<br>from model output.|
|evidence_refs|jsonb|NO||Supporting evidence identifiers.|



###### **scenarios** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|scenario_id|uuid|NO|PK|Scenario identifier.|
|org_id|uuid|NO|FK|Tenant.|
|baseline_assessment_id|uuid|NO|FK|Baseline assessment.|
|name|varchar(200)|NO||Scenario name.|
|description|text|YES||Scenario description.|
|created_by|uuid|YES|FK|Creating user.|
|created_at|timestamptz|NO||Creation time.|
|status|varchar(30)|NO|CHECK|draft / running / completed / failed /<br>archived.|
|result_assessment_id|uuid|YES|FK|Scenario result assessment when<br>persisted.|



###### **scenario_changes** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|change_id|uuid|NO|PK|Scenario mutation identifier.|
|scenario_id|uuid|NO|FK|Scenario.|
|entity_type|varchar(60)|NO||asset / control_state / vulnerability /<br>financial_parameter /<br>service_dependency.|
|entity_id|uuid|YES||Affected entity.|
|field_name|varchar(100)|NO||Field being changed in scenario.|
|old_value_json|jsonb|YES||Baseline value snapshot.|
|new_value_json|jsonb|NO||Scenario value.|
|change_type|varchar(30)|NO|CHECK|set / increase / decrease / add / remove.|
|created_at|timestamptz|NO||Mutation creation time.|



###### **investment_options** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|option_id|uuid|NO|PK|Candidate investment/remediation<br>option.|
|org_id|uuid|NO|FK|Tenant.|
|name|varchar(250)|NO||Investment/control/remediation name.|
|option_type|varchar(50)|NO||patch / MFA / segmentation /<br>monitoring / access_control / other.|
|cost|numeric(20,2)|NO|>=0|Implementation cost.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

||||SentinelStack|Data Dictio|nary& Database Schema v1.0|PS 26105<br>**i**|
|---|---|---|---|---|
|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|currency|char(3)|NO||Currency.|
|affected_scope_json|jsonb|NO||Affected assets/services.|
|dependencies_json|jsonb|NO||Option dependency constraints.|
|applicability_json|jsonb|NO||Applicability conditions.|
|base_risk_reduction|numeric(20,2)|YES|>=0|Modeled financial risk reduction under<br>baseline context.|
|risk_reduction_confidence|numeric(5,4)|YES|0..1|Confidence.|
|derived_from_conditions_json|jsonb|NO||Risk-condition references used to derive<br>impact.|
|status|varchar(30)|NO|CHECK|candidate / active / deprecated.|



###### **recommendations** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|recommendation_id|uuid|NO|PK|Recommendation identifier.|
|org_id|uuid|NO|FK|Tenant.|
|assessment_id|uuid|NO|FK|Source risk assessment.|
|option_id|uuid|YES|FK|Mapped investment option.|
|action|varchar(250)|NO||Recommended action.|
|priority_rank|integer|NO|>0|Model-derived prioritization rank.|
|expected_financial_change|numeric(20,2)|YES||Expected financial risk change.|
|risk_reduction|numeric(20,2)|YES|>=0|Quantified modeled risk reduction.|
|cost|numeric(20,2)|YES|>=0|Estimated implementation cost.|
|rosI|numeric(20,6)|YES||ROSI where supported.|
|confidence|numeric(5,4)|NO|0..1|Recommendation confidence.|
|rationale|text|YES||Grounded explanation.|
|evidence_refs|jsonb|NO||Evidence identifiers.|
|risk_condition_refs|jsonb|NO||Conditions under which<br>recommendation applies.|
|created_at|timestamptz|NO||Creation time.|



###### **optimization_runs** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|optimization_run_id|uuid|NO|PK|Optimization execution identifier.|
|org_id|uuid|NO|FK|Tenant.|
|baseline_assessment_id|uuid|NO|FK|Risk baseline used for optimization.|
|budget|numeric(20,2)|NO|>=0|Available investment budget.|
|currency|char(3)|NO||Budget currency.|
|objective|varchar(80)|NO||Primary optimization objective.|
|constraints_json|jsonb|NO||Dependencies, exclusions, capacity and<br>applicability constraints.|
|optimizer_version|varchar(80)|NO||Optimizer algorithm/build version.|
|status|varchar(30)|NO|CHECK|queued / running / completed / failed.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

||||SentinelStack|Data Dictionary& Database Schema v1.0|PS 26105<br>**i**|
|---|---|---|---|
|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**<br>**Definition**|
|started_at|timestamptz|NO|Run start.|
|completed_at|timestamptz|YES|Run completion.|



###### **optimization_results** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|optimization_result_id|uuid|NO|PK|Optimization output record.|
|optimization_run_id|uuid|NO|FK|Parent optimization run.|
|option_id|uuid|NO|FK|Candidate option.|
|selected|boolean|NO||Whether option is selected in the<br>candidate portfolio.|
|individual_risk_reduction|numeric(20,2)|YES|>=0|Modeled incremental/individual<br>financial risk reduction.|
|portfolio_risk_reduction|numeric(20,2)|YES|>=0|Modeled risk reduction in the evaluated<br>portfolio.|
|portfolio_cost|numeric(20,2)|YES|>=0|Total portfolio cost at this result.|
|residual_eal|numeric(20,2)|YES|>=0|Residual Expected Annual Loss.|
|residual_var|numeric(20,2)|YES|>=0|Residual Value at Risk.|
|rosi|numeric(20,6)|YES||ROSI for portfolio/result where<br>supported.|



###### **investment_decisions** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|decision_id|uuid|NO|PK|Human-governed investment decision<br>record.|
|org_id|uuid|NO|FK|Tenant.|
|optimization_run_id|uuid|NO|FK|Optimization run whose portfolio was<br>reviewed.|
|decision_status|varchar(30)|NO|CHECK|proposed / approved / rejected /<br>superseded.|
|approved_by|uuid|YES|FK|Authorizing user.|
|approved_at|timestamptz|YES||Approval time.|
|decision_notes|text|YES||Human decision rationale/notes.|
|evidence_refs|jsonb|NO||Evidence references supporting the<br>decision.|
|created_at|timestamptz|NO||Decision record creation time.|



##### **Ingestion & Governance** 

###### **integration_sources** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|source_id|uuid|NO|PK|Configured source connector.|
|org_id|uuid|NO|FK|Tenant.|
|source_name|varchar(160)|NO||Source name.|
|source_class|varchar(40)|NO|CHECK|vulnerability/ siem / iam / edr / cspm /|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|||||asset / threat / business.|
|mechanism|varchar(40)|NO||REST / webhook / batch / agent / STIX-<br>TAXII.|
|endpoint_ref|varchar(500)|YES||Reference to endpoint/config; secrets<br>stored outside this table.|
|status|varchar(20)|NO|CHECK|active / paused / error / retired.|
|schedule_json|jsonb|YES||Schedule metadata.|
|schema_version|varchar(40)|YES||Source schema version.|
|**gestion_runs**<br>**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|run_id|uuid|NO|PK|Ingestion run identifier.|
|source_id|uuid|NO|FK|Source.|
|started_at|timestamptz|NO||Run start.|
|completed_at|timestamptz|YES||Run completion.|
|status|varchar(20)|NO|CHECK|running / completed / partial / failed.|
|records_received|integer|NO|>=0|Total records received.|
|records_accepted|integer|NO|>=0|Accepted records.|
|records_quarantined|integer|NO|>=0|Quarantined records.|
|error_summary|jsonb|YES||Error counts/types.|



###### **ingestion_runs** 

###### **source_records** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|source_record_id|uuid|NO|PK|Provenance registry record.|
|run_id|uuid|NO|FK|Ingestion run.|
|source_native_id|varchar(500)|YES||Source identifier.|
|observed_at|timestamptz|YES||Source event observation time.|
|collected_at|timestamptz|NO||Collection timestamp.|
|payload_type|varchar(60)|NO||json / csv_row / stix_bundle / event /<br>document.|
|object_uri|text|NO||Location of raw payload in controlled<br>storage.|
|payload_hash|char(64)|NO||SHA-256 of canonical payload.|
|normalized_entity_type|varchar(60)|YES||Canonical entity type produced.|
|normalized_entity_id|uuid|YES||Canonical entity identifier.|
|schema_version|varchar(40)|YES||Canonical/source schema version.|
|retention_class|varchar(40)|NO||Hot / standard / archive / purge_policy.|



###### **data_quality_issues** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|issue_id|uuid|NO|PK|Data-quality issue identifier.|
|source_record_id|uuid|NO|FK|Source record.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|rule_code|varchar(80)|NO||DQ rule identifier.|
|severity|varchar(20)|NO|CHECK|info / warning / error / critical.|
|description|text|NO||Issue detail.|
|resolution_status|varchar(20)|NO|CHECK|open / resolved / waived.|
|created_at|timestamptz|NO||Issue creation.|
|resolved_at|timestamptz|YES||Resolution time.|



###### **evidence** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|evidence_id|uuid|NO|PK|Evidence package identifier.|
|org_id|uuid|NO|FK|Tenant.|
|source_record_id|uuid|YES|FK|Originating source record.|
|evidence_type|varchar(60)|NO||telemetry / configuration / report /<br>assessment / approval / decision.|
|collected_at|timestamptz|NO||Collection time.|
|content_hash|char(64)|NO||SHA-256 content hash.|
|object_uri|text|YES||Controlled-storage location.|
|metadata_json|jsonb|NO||Metadata and collection context.|
|retention_until|timestamptz|YES||Retention expiry if policy sets explicit<br>date.|



###### **evidence_links** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|evidence_link_id|uuid|NO|PK|Evidence relation identifier.|
|evidence_id|uuid|NO|FK|Evidence.|
|entity_type|varchar(60)|NO||Type of linked object.|
|entity_id|uuid|NO||Linked object id.|
|link_role|varchar(60)|NO||supports / derived_from / approved_by /<br>cited_by.|
|created_at|timestamptz|NO||Link creation.|



###### **audit_events** 

|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**|**Definition**|
|---|---|---|---|---|
|audit_event_id|uuid|NO|PK|Audit event identifier.|
|org_id|uuid|NO|FK|Tenant.|
|actor_user_id|uuid|YES|FK|Actor.|
|action|varchar(100)|NO||CREATE / UPDATE / APPROVE / RUN /<br>EXPORT / etc.|
|entity_type|varchar(60)|NO||Affected entity type.|
|entity_id|uuid|YES||Affected entity identifier.|
|event_at|timestamptz|NO||Event time.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

||||SentinelStack|Data Dictionary& Database Schema v1.0|PS 26105<br>**i**|
|---|---|---|---|
|**Field**|**PostgreSQL type**|**Null**|**Key / constraint**<br>**Definition**|
|payload_hash|char(64)|NO|Hash of canonical audit payload.|
|previous_event_hash|char(64)|YES|Hash-chain predecessor.|
|metadata_json|jsonb|NO|Non-sensitive event metadata.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **10. Field Semantics and Controlled Vocabularies** 

##### **10.1 Numeric Semantics** 

|**Metric**|**Allowed range / unit**|**Interpretation**|
|---|---|---|
|Risk Score|0–100|Normalized decision-support score; higher means greater<br>modeled cyber risk.|
|Probability / confidence|0–1|Probability/confidence value, never a percentage string in<br>storage.|
|CVSS|0–10|CVSS score preserved as source value.|
|Severity normalized|0–10|Internal canonical severity scale.|
|Criticality / coverage / configuration strength|0–100|Business/coverage scale; semantics documented per field.|
|EAL / Financial Exposure / loss|>=0|Monetary values in organization or assessment currency.|
|VaR confidence|0–1|Percentile for VaR, e.g. 0.95.|
|VaR value|>=0|Loss threshold at declared confidence and horizon; not<br>maximum possible loss.|
|ROSI|Derived ratio|Stored as numeric when computed; formula/version recorded<br>by service layer.|



##### **10.2 Controlled Vocabularies** 

|**Domain**|**Baseline values**|**Validation rule**|
|---|---|---|
|Framework|ISO27001, NIST_CSF, CIS, RBI_CSF, SEBI_CYBER_RESILIENCE|No free-form framework names in mapping records.|
|Integration mechanism|REST, WEBHOOK, BATCH, AGENT, STIX-TAXII|Must match configured connector implementation.|
|Patch state|UNPATCHED, PARTIAL, PATCHED, NOT_APPLICABLE, UNKNOWN|Lowercase/canonical application code may be used but values<br>must be normalized.|
|Recommendation direction|INCREASES, DECREASES, MIXED|Used by driver attribution.|
|Scenario status|DRAFT, RUNNING, COMPLETED, FAILED, ARCHIVED|Baseline data never modified by scenario execution.|
|Model status|CANDIDATE, APPROVED, RETIRED|Only APPROVED models allowed in production scoring.|
|Retention class|HOT, STANDARD, ARCHIVE, PURGE_POLICY|Determines storage tier and lifecycle service.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **11. Retention, Partitioning and Lifecycle** 

The SRS requires risk snapshots and audit logs to be retained for a minimum of 36 months. The SDD additionally treats raw/high-volume telemetry retention as 

deployment-configurable with lineage preserved when payloads age out. The following is the implementation baseline; customer policy can extend but not shorten mandatory periods. 

|**Data class**|**Baseline retention**|**Partition / storage strategy**|**Deletion rule**|
|---|---|---|---|
|Risk assessments + trend snapshots|>=36 months|Monthly partition by assessed_at for large<br>tenants; B-tree on org/scope/time.|Archive then purge only after policy/contractual<br>retention window.|
|Audit events|>=36 months|Monthly partition by event_at; append-only<br>store/chain.|No in-place update; purge only after retention<br>period.|
|Evidence packages|>=36 months or policy-specific|Object storage + metadata table; optional<br>WORM/immutable tier for regulated evidence.|Delete only after evidence retention and<br>approval.|
|Raw source payloads|Deployment/source-policy configurable|Object storage by org/source/date; database<br>stores metadata + hash.|Payload may age out while source_record<br>metadata and hashes remain for lineage.|
|Normalized security events|Deployment/source-policy configurable|Time partition by observed_at; indexes on<br>org/asset/service/event_type/time.|Archive/purge by source volume and audit<br>needs.|
|Model predictions|At least aligned with risk-assessment history<br>where used for explanation|Partition by prediction_time; model_version<br>index.|Retain while referenced by retained<br>assessments; then archive.|
|Scenarios/recommendations|At least aligned with audit decision history|Standard relational tables; archive<br>completed/old scenarios.|Do not delete records that are referenced by<br>retained decisions/evidence.|



Retention is a deployment policy input, not a hardcoded global value. The system shall prevent premature destruction of records needed to reconstruct a retained material risk decision or regulatory evidence package. 

##### **11.1 Indexing Baseline** 

|**Table**|**Recommended indexes**|**Reason**|
|---|---|---|
|assets|(org_id,status), (org_id,criticality_score), (org_id,last_seen_at)|Tenant filtering, risk prioritization, freshness.|
|asset_vulnerabilities|(asset_id,observed_at DESC), (vulnerability_id,observed_at DESC),<br>(patch_state,observed_at)|Asset drill-down and current-state filtering.|
|security_events|(org_id,observed_at DESC), (asset_id,observed_at DESC),<br>(event_type,observed_at)|Continuous ingestion and anomaly/risk windows.|
|risk_assessments|(org_id,scope_type,scope_id,assessed_at DESC), (org_id,assessed_at<br>DESC)|Dashboard, trend and drill-down queries.|
|risk_drivers|(assessment_id,rank), (entity_type,entity_id)|Explainability and entity drill-down.|
|recommendations|(assessment_id,priority_rank), (org_id,created_at DESC)|Decision views and prioritization.|
|source_records|(run_id), (payload_hash), (normalized_entity_id), (collected_at DESC)|Provenance lookup and duplicate detection.|
|audit_events|(org_id,event_at DESC), (entity_type,entity_id,event_at DESC)|Audit queries and evidence reconstruction.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **12. Data Integrity, Tenant Isolation and Security** 

##### **12.1 Tenant Isolation** 

- Organization is the tenant root. Application queries must always constrain operational reads/writes to an authorized org_id or an authorized scoped descendant. 

- For platforms supporting PostgreSQL Row-Level Security, tenant predicates should be enforced at the database layer in addition to API authorization. 

- Cross-tenant identifiers are not accepted from untrusted client input without authorization checks; scope_id relationships are validated against org_id before writes. 

- Generic evidence_links and scope_id fields require application/service-layer referential validation because polymorphic targets cannot be fully enforced by ordinary foreign keys. 

##### **12.2 Integrity Constraints** 

|**Constraint**|**Baseline rule**|**Failure behavior**|
|---|---|---|
|Money|Monetary values >= 0 unless explicitly modeled as signed<br>delta|Reject invalid write.|
|Probability|0 <= p <= 1|Reject/quarantine source/prediction outside range.|
|Risk score|0 <= score <= 100|Reject invalid assessment.|
|CVSS|0 <= score <= 10|Reject/quarantine invalid source value after preserving<br>original raw value if required.|
|Time windows|valid_to >= valid_from; observed timestamps not null when<br>required|Reject invalid temporal state.|
|Scenario isolation|Scenario writes must not update baseline<br>asset/control/vulnerability rows|Service transaction guard + integration test.|
|Audit immutability|audit_events append-only; hashes chain material events|Updates/deletes denied to application role.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **13. Data Lineage and Evidence Design** 



_Figure 2. Data lineage from enterprise evidence to business decision and verification._ 

The database does not require the complete raw telemetry body to remain in PostgreSQL. source_records retains enough metadata to identify the originating source record, canonical payload hash, collection time, storage location and normalized entity. risk_assessment_inputs then creates the explicit bridge between an authoritative risk assessment and the inputs/predictions that produced it. 

|**Evidence question**|**Data path**|**Verification mechanism**|
|---|---|---|
|Where did this value come from?|risk_assessment → risk_assessment_inputs → source_record /<br>model_prediction|Source IDs, model version, timestamp, input role.|
|Can the historical assessment be reconstructed?|risk_assessment → calculation_hash + inputs +<br>model_bundle_version|Recompute canonical inputs/outputs and compare hash where<br>retained data permits.|
|Why was this asset high-risk?|risk_assessment → risk_drivers → entity/evidence refs|Driver attribution stored independently of LLM text.|
|Why was this control recommended?|recommendation → option → risk condition refs + evidence|Grounded recommendation lineage.|
|Who approved the investment decision?|audit_event + evidence_links|Actor, timestamp, action, hash chain and evidence package.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **14. SRS / SDD Traceability** 

|**SRS requirement(s)**|**Schema/service realization**|**Coverage**|
|---|---|---|
|FR-01 / FR-02|integration_sources, ingestion_runs, source_records,<br>data_quality_issues + canonical normalization|Source registration, run tracking, canonical IDs and quality gates.|
|FR-03 / NFR-03A|security_events, asset_vulnerabilities, control_states,<br>threat_signals + risk_assessments|Point-in-time state and material recalculation inputs.|
|FR-04|model_versions, model_predictions, risk_assessments<br>i|Likelihood predictions stored with model version; risk engine<br>persists authoritative result.|
|FR-05|financial_parameters, incidents, model_predictions,<br>risk_assessments|Business impact parameters, historical losses and modeled<br>impact inputs.|
|FR-06 / FR-06A / FR-06B|risk_assessments, risk_drivers|EAL/VaR/Financial Exposure/Risk Score + historical snapshots +<br>attribution.|
|FR-07 / FR-08|services, assets, service_dependencies, control_states|Criticality/dependency propagation and control effectiveness<br>state.|
|FR-09|risk_drivers, risk_assessment_inputs|Reproducible data/model-derived drivers.|
|FR-10 / FR-11 / FR-12 / FR-12A|model_predictions, recommendations + API/service layer|Prediction, grounded recommendations and business-language<br>translation.|
|FR-13|scenarios, scenario_changes, risk_assessments|Immutable baseline + state mutations + scenario result<br>assessment.|
|FR-14 / FR-15 / FR-16 / FR-17 / FR-18 / FR-19|investment_options, optimization_runs, optimization_results,<br>investment_decisions, recommendations, scenarios,<br>risk_assessments|Budget, candidate option, reproducible optimization outputs,<br>ROSI, cost-benefit, investment curve inputs and governed<br>approval.|
|FR-20 / FR-21 / FR-22|risk_assessments, risk_drivers, assets, services, control_states,<br>recommendations|Executive and technical dashboard query paths.|
|FR-23 / FR-24|framework_controls, control_framework_mappings, evidence,<br>evidence_links, audit_events|Framework mapping and evidence-based PDF/report packages.|
|NFR-01 / NFR-02 / NFR-06|organizations, memberships, source_records, evidence|Tenant scope, RBAC metadata, data-minimization/provenance.|
|NFR-05 / NFR-08|model_versions, risk_drivers, risk_assessment_inputs, evidence,<br>audit_events|Explainability, auditability and tamper-evidence.|
|NFR-09|Schema is deployment-neutral; PostgreSQL reference supports<br>cloud portability|No on-prem resource dependency encoded in data model.|
|NFR-10|source_records retention_class + evidence retention_until +<br>policy service|Configurable raw/normalized telemetry retention with lineage<br>preservation.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **15. Implementation Notes and Schema Evolution** 

##### **15.1 Migration Rules** 

- Every production schema change is versioned through migration scripts. Never edit an applied migration in place. 

- Backward-compatible additive changes are preferred: add nullable fields, backfill, switch readers, then enforce NOT NULL where safe. 

- Enumerated values are handled through controlled lookup/check constraints and application validation; avoid silently accepting vendor-specific strings. 

- Risk calculation schema changes must record model_bundle_version/schema_version so historical assessments remain interpretable. 

- Source adapter changes must preserve source_record payload_hash and source-native identifiers so data lineage remains stable across connector revisions. 

##### **15.2 Reference PostgreSQL Conventions** 

|**Convention**|**Decision**|
|---|---|
|Primary keys|UUIDgenerated server-side; external IDs stored separately.|
|Time|timestamptz stored in UTC; original timezone may be retained in attributes where required.|
|Money|numeric(20,2) for currency amounts; currency code stored explicitly.<br>i      i|
|Flexible attributes|jsonb only for source-specific or extensible metadata; core query fields remain typed columns.|
|Soft delete|Use status/retired_at for business entities; avoid deleting objects referenced by historical<br>assessments/evidence.|
|Audit|Material changes produce audit_events; risk decisions additionally reference evidence<br>packages.|
|Security|Database credentials/secrets are not stored in source configuration rows; secret references<br>point to external secret management.|



Data Dictionary & Database Schema - Final Engineering Baseline | Page 

SentinelStack | Data Dictionary & Database Schema v1.0 | PS 26105 

#### **Appendix B. Verification Checklist** 

|**Check**|**Acceptance condition**|
|---|---|
|Schema validity|All DDL executes cleanly in target PostgreSQL version; extensions required are documented.|
|Tenant isolation|A user cannot read/write records outside assigned orgscope; RLS/API tests pass.|
|FR-03|Material security/control changes can be represented with timestamped state and trigger a<br>new risk assessment.|
|FR-06A|Risk snapshots can be queried over 36 months with trend calculations.|
|FR-09|Each displayed top risk driver has a stored underlyingattribution and evidence reference.|
|FR-12/12A|Natural-language responses can retrieve typed risk values and business context through<br>backend contracts.|
|FR-13|Scenario execution leaves baseline rows unchanged and produces a comparable result<br>assessment.|
|FR-16|Investment portfolio cost never exceeds requested budget and dependencies are validated.<br>i|
|FR-17/18/19|ROSI, cost-benefit and investment-vs-risk-reduction data can be computed from persisted<br>option/risk records and optimization runs.|
|Investment decisions|Approved/rejected portfolio decisions identify the optimizer run, approver, timestamp and<br>evidence.<br>f|
|FR-23/24|Framework mappings and evidence links are sufficient to assemble audit/regulatory report<br>packages.|
|NFR-08|Material audit-event hash-chain tamperingis detectable.|
|NFR-10|Raw data can be aged out while source_record lineage/hash metadata remains and linked<br>assessments remain explainable.|
|Model governance|Every production prediction references an approved model version and model<br>metrics/schema hash.|
|Schema evolution|Historical assessments remain interpretable after schema/model version changes.|



#### **Appendix A. PostgreSQL DDL Baseline** 

The executable DDL is delivered as a companion .sql file. The document intentionally provides the logical contract rather than embedding hundreds of lines of migration code in the main body. 

Companion artifact: SentinelStack_Data_Dictionary_and_Database_Schema_v1.0_FINAL.sql 

###### **End of Data Dictionary & Database Schema v1.0** 

Data Dictionary & Database Schema - Final Engineering Baseline | Page 

