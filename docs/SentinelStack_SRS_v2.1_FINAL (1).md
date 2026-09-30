SentinelStack | SRS v2.1 | PS 26105 

# **SentinelStack** 

## **Software Requirements Specification** 

AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform 

|**Document Attribute**|**Value**|
|---|---|
|Problem Statement|26105|
|Organization|All India Council for Technical Education (Cyber<br>SecurityCell)|
|Document Version|2.1 - Final Requirements Baseline(Polished)|
|Status|Final Draft for System Design/SDD|
|PrimaryBasis|PS 26105problem statement and description|



###### **Baseline intent** 

This SRS treats PS 26105 as the product specification. Every major PS capability is expressed as a testable system requirement and traced into the requirements matrix. Architecture and technology choices are intentionally deferred to the SDD. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

### **Contents** 

###### **1. Introduction** 

###### **1.1 Purpose** 

###### **1.2 Revision and Gap-Closure Note** 

**2. Scope** 

###### **2.1 In Scope** 

- **2.2 Out of Scope** 

**3. Intended Users** 

**4. Overall System Concept** 

**5. Functional Requirements** 

- **5.1 AI Decision Support Requirements** 

- **5.2 Investment Optimization Requirements** 

- **5.3 Dashboard Requirements** 

- **5.4 Compliance and Governance Requirements** 

**6. Non-Functional Requirements** 

**7. Data Requirements** 

**8. Core Outputs** 

**9. Key System Use Cases** 

**10. Design Decisions Deliberately Deferred** 

**11. Requirements Traceability Matrix** 

**12. Final SRS Scope Statement** 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

### **1. Introduction** 

#### **1.1 Purpose** 

This Software Requirements Specification (SRS) defines the functional and non-functional requirements of SentinelStack, an AI-powered platform designed to continuously quantify organizational cyber risk in monetary terms and support data-driven cybersecurity investment decisions. 

The system shall correlate technical cybersecurity telemetry with business asset criticality, service dependencies, control effectiveness, and threat intelligence to estimate cyber incident likelihood and financial impact; calculate financial risk exposure; identify major risk contributors; simulate mitigation scenarios; translate technical findings into business language; and recommend costeffective security investments under defined budget constraints. 

#### **1.2 Revision and Gap-Closure Note** 

This version supersedes SRS v1.0 and closes the remaining semantic gaps identified during a requirement-by-requirement comparison against PS 26105. The changes strengthen alignment without fixing implementation technologies that belong in the System Design Document (SDD). 

- FR-05 strengthened to explicitly require statistical and/or AI/ML-based financial-impact estimation, supplemented by deterministic business-impact models where appropriate. 

- FR-06B added for continuous risk-score quantification at enterprise, business-unit, and asset levels. 

- FR-11 strengthened so optimization-eligible recommendations require model-derived quantified risk reduction; non-quantifiable recommendations are explicitly identified and excluded from budget optimization. 

- FR-16 strengthened to make cost-effectiveness/value an explicit optimization consideration and output, alongside the budget constraint and modeled risk reduction objective. 

- FR-12A added to explicitly bridge technical findings to business services, business consequences, and financial implications. 

- FR-17 and FR-18 strengthened to explicitly support strategic planning and board-level security investment review. 

- FR-24 strengthened to explicitly cover regulatory reporting and regulatory filings. 

- FR-18 and FR-19 are elevated to Must Have because both capabilities are explicitly named in the PS 26105 Investment Optimization Module. NFR-10 is added to define configurable sourcetelemetry retention and evidence linkage for auditability. The Section 4 pipeline is also corrected so AI mitigation recommendations and what-if scenarios both feed the investment-optimization stage. 

### **2. Scope** 

#### **2.1 In Scope** 

**A. Security Data Integration:** Ingestion and normalization of data from Vulnerability Management, SIEM, IAM, EDR, CSPM, Asset Inventory, Threat Intelligence, and Business Context sources, via documented integration mechanisms. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

**B. Continuous Cyber Risk Quantification:** Ongoing estimation of incident likelihood, financial impact, continuous risk score, Expected Annual Loss (EAL), and Value at Risk (VaR) at organization, business-unit, and asset levels, with historical retention to support trend analysis. 

**C. Business Context and Risk Prioritization:** Weighting of technical findings by asset criticality and service dependency, and explicit translation of technical risk into affected business services and financial consequences. 

**D. Control Effectiveness:** Evaluation of control strength using configuration, incident history, compliance telemetry, and available security signals. 

**E. AI Decision Support:** Predictive analytics, AI-assisted mitigation recommendations, grounded natural-language interaction, and what-if scenario simulation. 

**F. Security Investment Optimization:** Budget-constrained optimization, cost-effectiveness analysis, ROSI, and investment-vs-risk-reduction visualization. 

**G. Dashboards and Reporting:** Executive and technical views, drill-down navigation, historical trend analysis, and evidence-based reporting suitable for audits, governance, and regulatory use. 

**H. Compliance and Framework Mapping:** Mapping against ISO/IEC 27001, NIST CSF, CIS Controls, RBI Cyber Security Framework, and SEBI Cybersecurity and Cyber Resilience Framework. 

**I. Cloud-Ready Deployment:** Deployable on cloud infrastructure as a cloud-native or cloud-portable system. 

#### **2.2 Out of Scope** 

- Replacing an organization's SIEM, EDR, vulnerability scanners, IAM, CSPM, or other existing source systems. 

- Performing offensive penetration testing as a core SentinelStack responsibility. 

- Guaranteeing prevention of every cyber incident or predicting exact future losses. 

- Predicting black-swan geopolitical or macroeconomic events. Such events may instead be represented through explicit stress-test scenarios when appropriate data/assumptions exist. 

- Functioning as an accounting or ERP system. 

SentinelStack is primarily a risk quantification and investment decision-support platform operating on data obtained from existing enterprise sources, not a replacement for those sources. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

### **3. Intended Users** 

|**User Role**|**Required Capabilities**|
|---|---|
|CISO / Security Leadership|View current enterprise cyber risk; understand<br>financial exposure; identify risk contributors; analyze<br>trends; evaluate mitigation options.|
|Risk Officers|Analyze quantified risk; compare scenarios; review risk<br>drivers; monitor risk reduction; generate governance<br>reports.|
|Security / IT Teams|Drill down from enterprise risk to assets and controls;<br>inspect vulnerabilities; view remediation backlog;<br>evaluate remediation actions; monitor control<br>effectiveness.|
|Executive / Board-Level Stakeholders|Understand financial cyber exposure; compare<br>investment options; evaluate budget impact;<br>understand modeled risk reduction and ROSI; review<br>strategic trade-offs and approval-readysummaries.|
|Compliance / Governance Teams|Map controls and risks to frameworks; access<br>supporting evidence; generate governance, audit, and<br>regulatoryreports/filings.|



Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

### **4. Overall System Concept** 

The system shall operate as a continuous analytical pipeline that closes the loop from security telemetry to a measurable business investment decision. 

Enterprise Security & IT Sources ↓ Data Ingestion (FR-01) ↓ Normalization (FR-02) ↓ Business + Security Correlation (FR-07, FR-08) ↓ Risk Quantification (FR-04–FR-06B) ↓ Financial Risk Estimation ↓ Risk Drivers (FR-09) ↓ AI Decision Support (FR-10–FR-12A) \                                  / What-If Simulation (FR-13)       AI Mitigation Recommendations (FR-11) /                                  \ Investment Optimization (FR-14–FR-19) ↓ Dashboards & Reports (FR-20–FR-24) ↓ Business Decision 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

###### **System principle** 

The analytical engine, not the language model, is authoritative for likelihood, financial impact, EAL, VaR, risk scores, and quantified risk reduction. AI language capabilities shall explain and query verified outputs rather than invent numerical risk values. 

### **5. Functional Requirements** 

##### **FR-01 - Data Source Integration  [Must Have]** 

- The system shall support ingestion of security and IT information from vulnerability management systems, SIEM systems, IAM systems, EDR systems, CSPM systems, asset inventory systems, threat intelligence feeds, and business-context sources. 

- Ingestion shall be supported through documented REST/webhook API connectors for realtime or near-real-time sources; scheduled batch/file-based import including CSV, JSON, and STIX/TAXII where applicable; and lightweight agent-based collectors where direct API access is unavailable. 

##### **FR-02 - Data Normalization  [Must Have]** 

- The system shall normalize heterogeneous source data into a common internal representation suitable for risk analysis, handling differences in identifiers, timestamps, severity formats, asset references, control representations, and event formats. 

##### **FR-03 - Continuous Risk Updating  [Must Have]** 

- The system shall recalculate relevant risk metrics when significant security, threat, asset, or control information changes rather than relying exclusively on periodic manual assessment. 

- Recalculation freshness targets shall conform to NFR-03A. 

##### **FR-04 - Incident Likelihood Estimation  [Must Have]** 

- The system shall use statistical and/or AI/ML methods to estimate the likelihood of cyber incidents based on available technical and contextual information including vulnerabilities, threat activity, asset exposure, control effectiveness, security telemetry, and business context. 

- The specific ML algorithm(s) shall remain a system-design decision. 

##### **FR-05 - Financial Impact Estimation  [Must Have]** 

- The system shall use statistical and/or AI/ML-based methods, supplemented by deterministic business-impact models where appropriate, to estimate potential financial/business impact of cyber incidents. 

- Impact estimation shall support factors including downtime costs, data breach costs, regulatory penalties, reputational effects, and other relevant business consequences. 

- The system shall preserve the assumptions and evidence used for the impact estimate so that the resulting financial exposure is interpretable and auditable. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

##### **FR-06 - Financial Risk Quantification  [Must Have]** 

- The platform shall transform incident likelihood and potential impact into monetary cyberrisk metrics including Expected Annual Loss (EAL), Value at Risk (VaR), and financial exposure. 

- These monetary metrics shall be available at enterprise, business-unit, and asset levels. 

##### **FR-06A - Historical Risk Data Retention and Trend Computation  [Must Have]** 

- The system shall persist time-stamped snapshots of computed risk metrics including Enterprise Risk Score, EAL, VaR, and Financial Exposure at a minimum daily granularity, or upon every material recalculation, whichever is more frequent. 

- The system shall retain historical risk snapshots for a minimum of 36 months to support trend analysis and audit/evidentiary requirements. 

- The system shall compute trend indicators such as period-over-period change and moving averages from retained history for dashboard consumption. 

##### **FR-06B - Continuous Risk Score Quantification  [Must Have]** 

- The system shall continuously compute and maintain a risk score at enterprise, businessunit, and asset levels, subject to available data. 

- The risk score shall update when material underlying risk factors change and shall remain traceable to the underlying risk drivers and source data. 

- The system shall distinguish the risk score from monetary measures such as EAL and VaR and shall not present either metric as a guaranteed prediction of future loss. 

##### **FR-07 - Asset Criticality Modeling  [Must Have]** 

- The system shall maintain business criticality information for assets and services, and the risk engine shall use asset criticality and service dependencies when calculating risk. 

##### **FR-08 - Control Effectiveness Evaluation  [Must Have]** 

- The system shall evaluate the effectiveness of security controls using available evidence including security telemetry, configuration strength, incident history, and compliance information. 

##### **FR-09 - Risk Driver Identification  [Must Have]** 

- For every material risk assessment, the system shall identify the major factors contributing to the resulting risk. 

- Identified drivers shall originate from the underlying model/data rather than being generated arbitrarily by a language model. 

#### **5.1 AI Decision Support Requirements** 

##### **FR-10 - Predictive Risk Analytics  [Must Have]** 

- The system shall provide predictive analytics for emerging threats, vulnerability trends, threat-intelligence trends, changing control performance, and evolving cyber risk. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

##### **FR-11 - AI Mitigation Recommendations  [Must Have]** 

- The platform shall generate prioritized mitigation recommendations, including patch deployment, access-control tightening, network segmentation, and additional monitoring. 

- Every recommendation that is eligible for investment optimization shall have a modelderived estimate of its expected risk reduction and relevant uncertainty/assumptions. 

- Recommendations for which a defensible quantified risk reduction cannot be established shall be explicitly labeled non-quantifiable and shall be excluded from automated budget optimization rather than assigned an invented value. 

- Recommendations shall identify the affected assets/services, expected financial-risk change where supported, estimated cost where available, and relevant dependencies. 

##### **FR-12 - Natural Language Query Interface  [Must Have]** 

- Users shall be able to query the platform using natural language, including questions such as “What is our highest financial cyber risk today?” and “Which vulnerabilities contribute most to our expected losses?”. 

- Responses shall be grounded in current system data and calculated risk outputs, not freeform generation. 

##### **FR-12A - Business Risk Translation  [Must Have]** 

- The system shall translate relevant technical cyber-risk findings into business-oriented explanations that identify the affected business service, potential business/financial consequence, principal risk drivers, and relevant mitigation options where data is available. 

- The translation layer shall reference verified analytical outputs and shall not introduce unsupported financial figures or causal claims. 

##### **FR-13 - What-If Scenario Simulation  [Must Have]** 

- The system shall allow users to simulate hypothetical mitigation scenarios such as increasing MFA coverage, delaying remediation, improving control coverage, or remediating selected vulnerabilities. 

- The system shall recalculate and display the resulting change in risk score, EAL, and VaR relative to the current baseline where those metrics are supported by the scenario data. 

- Scenario results shall identify changed assumptions and the resulting modeled risk reduction or increase. 

#### **5.2 Investment Optimization Requirements** 

##### **FR-14 - Budget Definition  [Must Have]** 

- The user shall be able to define an available cybersecurity investment budget. 

##### **FR-15 - Candidate Security Investments  [Must Have]** 

- The system shall represent potential remediation actions/security controls with attributes including estimated implementation cost, affected assets/services, expected risk reduction, dependencies, and applicability. 

- Candidate investments shall be linked to the underlying risk conditions that they are intended to mitigate. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

##### **FR-16 - Budget-Constrained and Cost-Effective Optimization  [Must Have]** 

- The platform shall identify a set of controls/remediation actions that maximizes modeled risk reduction within the specified budget, subject to applicable dependencies and constraints. 

- The optimization module shall explicitly expose cost-effectiveness/value information for candidate investments, including investment cost, modeled risk reduction, residual risk, and a comparable value metric such as risk reduction per unit of spend or ROSI where supported. 

- Non-quantifiable recommendations shall not be assigned artificial risk-reduction values merely to force inclusion in the optimization problem. 

- The optimization result shall clearly state the assumptions, constraints, selected investments, total cost, modeled risk reduction, and residual financial exposure. 

##### **FR-17 - ROSI Calculation and Strategic Investment Review  [Must Have]** 

- The platform shall calculate Return on Security Investment (ROSI) for supported security initiatives based on modeled risk reduction and investment cost. 

- ROSI and supporting calculations shall be presented in a form suitable for strategic planning and board-level security investment review, including assumptions and limitations. 

##### **FR-18 - Cost-Benefit Analysis  [Must Have]** 

- The system shall allow users to compare security initiatives using quantified cost, modeled cyber-risk reduction, residual risk, and relevant financial/business consequences. 

- The comparison view shall support strategic investment planning and board-level review without presenting model outputs as guaranteed returns or guaranteed avoidance of losses. 

##### **FR-19 - Investment vs. Risk Reduction Curve  [Must Have]** 

- The system shall visualize the relationship between security investment and modeled risk reduction to help identify diminishing returns and alternative spend zones. 

#### **5.3 Dashboard Requirements** 

##### **FR-20 - Executive Dashboard  [Must Have]** 

- The executive dashboard shall display Enterprise Risk Score, Total Financial Exposure, Risk Trend Analysis, Top Risk Contributors, and Risk Reduction Opportunities. 

- The dashboard shall support business-language interpretation of technical findings and investment implications. 

##### **FR-21 - Technical Dashboard  [Must Have]** 

- The technical dashboard shall provide asset-level findings, control-level findings, remediation backlog, security findings, and framework/policy mappings. 

##### **FR-22 - Drill-Down Navigation  [Must Have]** 

- Users shall be able to navigate from Enterprise -> Business Unit -> Service -> Asset -> Vulnerability/Control, where corresponding data is available. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

#### **5.4 Compliance and Governance Requirements** 

##### **FR-23 - Framework Mapping  [Must Have]** 

- The system shall map relevant risk/control information to ISO/IEC 27001, NIST Cybersecurity Framework, CIS Controls, RBI Cyber Security Framework, and SEBI Cybersecurity and Cyber Resilience Framework. 

##### **FR-24 - Evidence-Based Reporting and Regulatory Filing Support  [Must Have]** 

- The system shall generate reports and dashboards containing supporting evidence for audits, regulatory reporting, regulatory filings where applicable, internal governance, and riskmanagement committees. 

- Reports shall be exportable in at least PDF format. 

- Where a framework or filing requires specific evidence, the report shall retain traceability from the reported status to the underlying control/risk data and supporting evidence. 

### **6. Non-Functional Requirements** 

The following non-functional requirements are engineering targets for the requirements baseline. Numerical targets should be validated with the eventual deployment/evaluating organization before being treated as contractual SLAs. 

##### **NFR-01 - Security  [Must Have]** 

- The platform shall protect sensitive security and business information against unauthorized access using encryption in transit (TLS 1.2+) and at rest (AES-256 or equivalent). 

##### **NFR-02 - Access Control  [Must Have]** 

- The platform shall support role-based access control (RBAC) appropriate for executive, security, risk, and governance user classes, with least privilege applied by default. 

##### **NFR-03 - Scalability  [Should Have]** 

- The architecture shall target at least 100,000 tracked assets, 1,000,000 open findings, and 500 concurrent users per deployment without material degradation in dashboard response time; final sizing shall be validated against actual enterprise needs. 

##### **NFR-03A - Risk Recalculation Latency  [Must Have]** 

- High-severity changes such as a new critical/exploited vulnerability on a critical asset or a material control disablement shall trigger recalculation of affected risk metrics within 15 minutes of ingestion. 

- Routine/low-severity changes shall be reflected in a full recalculation cycle within 24 hours. 

##### **NFR-04 - Availability  [Should Have]** 

- The platform shall target a minimum of 99.5% monthly uptime for risk-monitoring and dashboard services; final SLA depends on deployment context. 

##### **NFR-05 - Explainability  [Must Have]** 

- Risk outputs and AI-driven recommendations shall expose relevant contributing factors and supporting evidence so outputs are not presented as opaque model scores. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

##### **NFR-06 - Data Privacy  [Must Have]** 

- Sensitive organizational information shall be handled according to applicable dataprotection requirements and the deploying organization’s security requirements, with data residency configurable per deployment. 

##### **NFR-07 - Interoperability  [Must Have]** 

- The platform shall use standardized interfaces/data contracts such as REST/JSON and STIX/TAXII where applicable so enterprise security products can be integrated without being replaced by SentinelStack. 

##### **NFR-08 - Auditability and Tamper Evidence  [Must Have]** 

- Material changes to risk assessments, recommendations, and investment decisions shall be traceable to source data and timestamp. 

- Audit logs shall be tamper-evident, for example through append-only storage or cryptographically chained records, and retained for a minimum of 36 months consistent with historical risk requirements and applicable evidence needs. 

##### **NFR-09 - Cloud Deployability  [Must Have]** 

- The platform shall be architected as cloud-ready with containerized services, externalized configuration, and no hard dependency on a specific on-premises resource. 

- The platform shall be deployable on at least one major public cloud (AWS, Azure, or GCP) and shall support independent scaling of ingestion and computation components from the presentation layer. 

- **NFR-10 - Source Telemetry Retention and Evidence Linkage  [Should Have]** 

- The platform shall support configurable retention policies for raw and normalized source telemetry by source and data class, subject to organizational privacy, storage, and regulatory requirements. 

- For source records that materially support a risk assessment, recommendation, or investment decision, the system shall retain the source record or an immutable reference to the retained record for at least 36 months, where permitted by the deploying organization's retention policy. 

### **7. Data Requirements** 

|**Category**|**Required Data Elements**|**Primary Purpose**|
|---|---|---|
|Security Data|Vulnerability data, SIEM/security<br>events, IAM information, EDR<br>telemetry, CSPM findings, asset<br>inventory, threat intelligence|Threat/exposure evidence, control<br>signals, attack activity, asset state<br>i|
|Business Context|Asset criticality, service dependencies,<br>business-impact parameters,<br>downtime impact, relevant financial-<br>impactparameters<br>i|Business prioritization and financial-<br>impact estimation<br>f|
|Control Context|Control configuration, control<br>coverage, control status, incident<br>history, compliance status|Control-effectiveness evaluation and<br>mitigation modeling|



Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

|**Category**|**Required Data Elements**|**Primary Purpose**|
|---|---|---|
|Historical / Time-Series|Timestamped Enterprise Risk Score,<br>EAL, VaR, Financial Exposure<br>snapshots; minimum 36-month<br>retention<br>f|Trend analysis, change detection,<br>audit/evidence support|
|Scenario / Investment Context|Candidate control costs, affected<br>assets/services, dependencies,<br>applicability, modeled risk reduction|What-if simulation and budget-<br>constrained investment optimization|
|Source Telemetry Retention|Raw/normalized source<br>records or immutable<br>references; source timestamps;<br>retention metadata; evidence<br>linkage|Audit traceability, re-analysis<br>of material risk decisions,<br>evidence preservation|



### **8. Core Outputs** 

- Enterprise Risk Score 

- Financial Exposure 

- Expected Annual Loss (EAL) 

- Value at Risk (VaR) 

- Incident Likelihood 

- Potential Financial Impact 

- Top Risk Drivers 

- Risk Trends 

- Recommended Mitigations 

- Scenario Outcomes 

- Risk Reduction 

- ROSI 

- Investment-vs-Risk-Reduction Curve 

- Budget-Optimized Investment Plan 

- Compliance Mappings 

- Evidence-Based Reports / Regulatory Filing Support 

### **9. Key System Use Cases** 

#### **9.1 UC-01 - Assess Current Enterprise Risk** 

User selects an enterprise -> system ingests latest available data -> risk calculation -> financial exposure and risk score computed -> risk drivers identified -> dashboard rendered. 

#### **9.2 UC-02 - Find Highest Financial Risk** 

Executive asks a natural-language question -> system retrieves current verified risk data -> AI explanation layer grounds the response in those outputs -> answer returned with relevant business context and evidence. 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

#### **9.3 UC-03 - Evaluate MFA Investment** 

Current state established -> user creates an “MFA = 100%” scenario -> scenario risk recalculated -> EAL/VaR compared with baseline -> modeled risk reduction calculated -> cost compared -> ROSI presented. 

#### **9.4 UC-04 - Optimize a Fixed Budget** 

Budget set -> available controls/remediations enumerated -> individual risk reductions and costs calculated -> optimization run -> selected investment set returned -> total cost, expected/modelled risk reduction, residual risk, and ROSI displayed. 

#### **9.5 UC-05 - Compliance Assessment** 

Security/control data collected -> framework mapping applied -> control status evaluated -> supporting evidence attached -> audit/regulatory/governance report generated. 

#### **9.6 UC-06 - Review Risk Trend Over Time** 

User selects an enterprise or business unit -> system retrieves historical risk snapshots -> trend indicators computed -> trend chart rendered on the executive dashboard. 

#### **9.7 UC-07 - Translate Technical Risk to Business Decision** 

Security finding identified -> affected service and asset criticality resolved -> financial-impact model evaluated -> top risk drivers identified -> business-language explanation generated -> relevant mitigation and investment options surfaced. 

### **10. Design Decisions Deliberately Deferred** 

The following are intentionally not locked at the requirements stage, to avoid adding constraints beyond PS 26105: 

- ML algorithm choice - the SRS does not mandate a specific algorithm for likelihood or financialimpact estimation. The SDD shall choose and justify models against FR-04 and FR-05. 

- Database technology - the SRS does not mandate a specific database engine. The SDD shall select technology against scalability, interoperability, cloud-readiness, security, and data-model requirements. 

- LLM/provider choice - the SRS defines grounding and behavior requirements, not a specific model/provider. 

- Blockchain implementation - PS 26105 does not define blockchain as the core computational engine. Where relevant to the Blockchain & Cybersecurity theme, blockchain or another cryptographic mechanism may be evaluated as an implementation option for NFR-08 tamper evidence; it is not a baseline risk-calculation requirement. 

- Deployment topology - SaaS, private cloud, on-premises, or hybrid deployment may be selected based on data sensitivity and enterprise requirements, provided NFR-09 is satisfied. 

### **11. Requirements Traceability Matrix** 

|**PS 26105 Requirement Area**|**SRS Reference**|
|---|---|
|Multi-source securitydata ingestion|FR-01, FR-02|



Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

|**PS 26105 Requirement Area**|**SRS Reference**|
|---|---|
|Cloud-ready platform|NFR-09|
|Continuous cyber risk / near-real-time visibility|FR-03, NFR-03A|
|Incident likelihood estimation|FR-04|
|Financial/business impact estimation using<br>statistical/AI/ML methods|FR-05|
|Continuous risk score|FR-06B|
|Financial exposure / EAL / VaR|FR-06|
|Historical trend visibility|FR-06A|
|Asset criticalityand service dependency|FR-07|
|Control effectiveness|FR-08|
|Risk drivers|FR-09|
|Predictive AI/ML analytics|FR-10|
|AI mitigation recommendations|FR-11|
|Quantified risk reduction for optimization-eligible<br>recommendations|FR-11, FR-16|
|Technical-to-business language bridge|FR-12A, FR-20|
|Natural-language interface|FR-12|
|What-if scenario analysis<br>i|FR-13|
|Budget definition|FR-14|
|Candidate investments and dependencies|FR-15|
|Budget-constrained optimization|FR-16|
|Cost-effective investment analysis|FR-16, FR-18, FR-19|
|ROSI / strategic and board-level investment review|FR-17, FR-18|
|Investment-vs-risk-reduction curve|FR-19|
|Executive dashboard|FR-20|
|Technical dashboard|FR-21|
|Drill-down|FR-22|
|Framework mapping|FR-23|
|Evidence-based reporting/ regulatoryfilings|FR-24|
|Security/privacy/ access control|NFR-01, NFR-02, NFR-06|
|Interoperability|NFR-07|
|Auditability/ tamper evidence|NFR-08|
|Traceability status<br>All major functional areas explicitly stated in<br>requirements. Gap closure makes financial-im     i<br>mitigation reduction, cost-effectiveness, busin<br>regulatory filings, and the complete AI-to-inve<br>Have; NFR-10 adds configurable source-telem<br>expanding the PS functional scope.|PS 26105 are mapped to one or more SRS<br>ipact modeling, continuous risk scores, quantified<br>f ess-language translation, strategic/board review,<br>i    stment pipeline explicit. FR-18 and FR-19 are Must<br>i etry retention and evidence linkage without|



### **12. Final SRS Scope Statement** 

SentinelStack shall be a continuous, cloud-ready cyber-risk decision-support platform that ingests heterogeneous enterprise security and business data; computes risk scores, EAL, VaR, and financial exposure; estimates incident likelihood and financial impact; identifies risk drivers; translates technical findings into business consequences; provides predictive analytics, grounded naturallanguage queries, mitigation recommendations, and what-if scenarios; and optimizes cybersecurity 

Requirements Baseline - Final Gap-Closed Draft 

SentinelStack | SRS v2.1 | PS 26105 

investment for modeled risk reduction and cost-effectiveness under explicit budgets. It shall provide executive and technical dashboards and drill-downs, historical trends, ROSI and investment comparisons for strategic and board review, tamper-evident audit trails, and compliance reporting/regulatory filing support mapped to ISO/IEC 27001, NIST CSF, CIS Controls, RBI Cyber Security Framework, and SEBI Cybersecurity and Cyber Resilience Framework. 

Requirements Baseline - Final Gap-Closed Draft 

