# SentinelStack — P5 Investment Optimization, Cost-Benefit, ROSI & Investment-vs-Risk-Reduction Implementation Specification v1.0

**Problem Statement:** 26105  
**Platform:** SentinelStack — AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform  
**Document Version:** 1.0  
**Document Status:** P5 Implementation Engineering Baseline  
**Repository:** `github.com/ciphernet01/sentinelstack`  
**Primary Runtime:** Existing Express + TypeScript + Prisma/PostgreSQL  
**Primary Dependencies:** P2 Risk Engine v2 + P3 Risk Driver Attribution & Evidence + P4 Scenario Engine / What-If Recalculation  
**Date:** 29 September 2026  
**Baselines:** PS 26105 • SRS v2.1 • SDD v1.2 • Data Dictionary v1.1 • Risk Model v1.1 • ML Spec v1.1 • API Contract v1.1 • Implementation Architecture v1.1 • P0/P1 Runbook v1.0 • P2 Risk Engine v2 Specification v1.0 • P3 Driver Attribution & Evidence Specification v1.0 • P4 Scenario Engine Specification v1.0

> **Purpose:** Define the investment decision-support layer that converts validated risk-treatment scenarios into explicit cost, quantified risk-reduction, cost-benefit and constrained portfolio-optimization outputs.

> **Core rule:** P5 optimizes among modeled investment alternatives; it does not invent risk reductions. Quantified benefit comes from P4 scenario results, while P5 solves the budget and dependency allocation problem.

---

# 1. Objective

P5 answers the business question:

```text
Given a finite cybersecurity budget, which modeled security investments
and combinations should be evaluated together, what risk reduction do
they produce, what do they cost, and how does the trade-off change
as additional budget is made available?
```

The P5 pipeline is:

```text
P3 Risk Drivers
        |
        v
Treatment / Recommendation
        |
        v
P4 Scenario
        |
        v
Scenario Risk Outcome
        |
        +--> Avoided EAL
        +--> VaR reduction
        +--> Risk Score reduction
        +--> Residual risk
        |
        v
Investment Option
        |
        +--> Cost
        +--> Dependencies
        +--> Constraints
        +--> Implementation metadata
        |
        v
Optimization Engine
        |
        +--> Budget constraint
        +--> Mandatory controls
        +--> Dependencies
        +--> Exclusions
        +--> Capacity
        |
        v
Portfolio Recommendation Set
        |
        +--> Cost
        +--> Modeled risk reduction
        +--> Residual risk
        +--> ROSI / benefit metrics
        +--> Trade-off curve
        |
        v
Executive Decision Support
```

---

# 2. Current Repository Gap

The current SentinelStack implementation contains:

```text
optimizeRecommendations()
```

with a greedy ratio-based approach and hardcoded recommendation costs / reduction assumptions.

That is transitional prototype logic.

P5 replaces the authoritative optimization path with:

```text
investment option catalog
+
scenario-derived risk outcomes
+
explicit constraints
+
exact/declared optimization algorithm
```

The previous greedy path may remain temporarily as a compatibility fallback but must not be represented as the final PS-26105 investment optimizer.

---

# 3. P5 Entry Criteria

P5 depends on:

## P2

```text
authoritative EAL
VaR95
VaR99
Risk Score
financial exposure
versioned model/parameters
calculation hashes
```

## P3

```text
risk drivers
evidence
driver attribution
risk-change explanation
```

## P4

```text
Scenario
ScenarioChange
ScenarioRun
ScenarioAssessment
baseline-vs-scenario delta
avoided EAL
residual risk
scenario cost inputs
```

---

# 4. P5 Exit Criteria

P5 is complete when:

```text
[ ] Investment options are normalized and versioned
[ ] Each quantified option can reference one or more P4 scenarios
[ ] Costs have explicit units and accounting semantics
[ ] Risk reduction is sourced from scenario calculations
[ ] Dependencies and incompatibilities are modeled
[ ] Mandatory / optional options are supported
[ ] Budget constraints are supported
[ ] Exact or formally defined optimization is implemented
[ ] Multiple objective modes are supported
[ ] Portfolio results are persisted
[ ] Investment-vs-risk-reduction curves are generated
[ ] Cost-benefit metrics are exposed
[ ] ROSI is calculated under declared convention
[ ] Marginal benefit is available
[ ] Residual risk and risk appetite status are visible
[ ] Scenario interactions are respected
[ ] Optimization explanations are traceable
[ ] Tenant isolation is enforced
[ ] Optimization jobs are bounded and auditable
[ ] Frontend can inspect alternatives without hidden ranking logic
[ ] P5 results can feed governance / investment decisions
```

---

# 5. P5 Design Principles

## 5.1 Benefit Must Be Calculated, Not Guessed

Preferred:

```text
Investment Option
    ->
P4 Scenario
    ->
P2 Risk Engine
    ->
Avoided EAL
```

Avoid:

```text
Investment Option
    ->
"30% risk reduction"
```

unless explicitly labeled as a provisional heuristic before scenario calculation.

---

# 6. Investment Option Definition

An investment option is a discrete treatment that can be evaluated financially and operationally.

Examples:

```text
Deploy MFA to privileged users
Expand EDR coverage
Segment internet-facing services
Patch critical KEV vulnerabilities
Implement cloud posture hardening
Add backup resilience
Increase SOC monitoring coverage
```

An option may represent:

```text
one control
one project
one remediation package
one phased program
one technology deployment
one service engagement
```

---

# 7. Investment Option Object

Recommended logical model:

```ts
type InvestmentOption = {
  id: string;
  organizationId: string;

  name: string;
  description?: string;

  category:
    | "IDENTITY"
    | "ENDPOINT"
    | "NETWORK"
    | "VULNERABILITY"
    | "CLOUD"
    | "DATA"
    | "RESILIENCE"
    | "MONITORING"
    | "GOVERNANCE"
    | "OTHER";

  status:
    | "DRAFT"
    | "ACTIVE"
    | "ARCHIVED";

  source:
    | "RECOMMENDATION"
    | "SCENARIO"
    | "USER"
    | "CATALOG"
    | "INTEGRATION";

  priorityClass?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

---

# 8. Investment Cost Model

Cost must be explicit.

Recommended structure:

```ts
type InvestmentCost = {
  currency: "INR" | "USD" | string;

  oneTime?: number;
  annualRecurring?: number;
  monthlyRecurring?: number;

  implementation?: number;
  licensing?: number;
  personnel?: number;
  consulting?: number;
  migration?: number;
  training?: number;

  costBasis:
    | "USER_PROVIDED"
    | "CATALOG"
    | "VENDOR_QUOTE"
    | "INTERNAL_ESTIMATE"
    | "MODEL_ASSUMPTION";

  sourceReference?: string;

  validFrom: string;
  validTo?: string;
};
```

---

# 9. Cost Normalization

Optimization needs a comparable budget unit.

Define:

```text
Budget Horizon
```

Examples:

```text
12 months
24 months
36 months
```

Then calculate:

```text
NormalizedCost(option, horizon)
```

using declared financial rules.

Example:

```text
One-time cost = ₹4M
Annual recurring = ₹1M

12-month normalized cost = ₹5M
36-month normalized cost = ₹7M
```

The system must not silently compare:

```text
one-time cost
```

against:

```text
3-year recurring cost
```

without normalization.

---

# 10. Cost Horizon

Every optimization request should specify:

```text
budget
currency
horizon
cost treatment
```

Example:

```json
{
  "budget": 10000000,
  "currency": "INR",
  "horizonMonths": 12
}
```

---

# 11. Cost Basis Governance

Cost may be:

```text
observed
quoted
estimated
assumed
```

The UI must disclose the basis.

Example:

```text
Cost: ₹4.5M
Basis: Internal estimate
Valid through: 31 Dec 2026
```

---

# 12. Risk Benefit Model

For an investment option linked to a scenario:

```text
AvoidedEAL = BaselineEAL - ScenarioEAL
```

Similarly:

```text
VaR95Reduction = BaselineVaR95 - ScenarioVaR95

VaR99Reduction = BaselineVaR99 - ScenarioVaR99

RiskScoreReduction =
    BaselineRiskScore - ScenarioRiskScore
```

The signed scenario delta remains available separately.

---

# 13. Benefit Dimensions

P5 should support multiple benefit metrics:

```text
AVOIDED_EAL
VAR95_REDUCTION
VAR99_REDUCTION
RISK_SCORE_REDUCTION
FINANCIAL_EXPOSURE_REDUCTION
APPETITE_GAP_REDUCTION
```

Not every optimization objective must use every metric.

---

# 14. Primary Optimization Objective

A default optimization objective can be:

```text
maximize modeled EAL reduction
```

subject to:

```text
budget
+
dependencies
+
mandatory controls
+
eligibility
+
incompatibilities
```

Generic form:

```text
maximize Σ benefit_i x_i
```

where:

```text
benefit_i = scenario-derived avoided EAL
```

and:

```text
x_i ∈ {0,1}
```

for binary investment selection.

---

# 15. Binary Option Model

For a simple portfolio:

```text
x_i = 1
```

means:

```text
select investment i
```

and:

```text
x_i = 0
```

means:

```text
do not select investment i
```

Example:

```text
MFA       x1
EDR       x2
Segment   x3
Patching  x4
```

---

# 16. Budget Constraint

Primary:

```text
Σ Cost_i * x_i <= Budget
```

where:

```text
Cost_i = normalized cost over selected horizon
```

---

# 17. Mandatory Investments

Some investments may be mandatory due to:

```text
policy
contract
regulation
internal governance
risk appetite
known critical exposure
```

Constraint:

```text
x_i = 1
```

for mandatory option i.

The reason must be persisted.

---

# 18. Optional Investments

Optional options use:

```text
0 <= x_i <= 1
```

for binary selection represented as:

```text
x_i ∈ {0,1}
```

unless a fractional/scale model is explicitly supported.

---

# 19. Dependency Constraints

Example:

```text
EDR rollout
requires
endpoint inventory
```

Constraint:

```text
x_EDR <= x_Inventory
```

Another example:

```text
Advanced analytics
requires
log pipeline
```

Constraint:

```text
x_Analytics <= x_LogPipeline
```

---

# 20. Mutual Exclusion

Some options cannot both be selected.

Example:

```text
Option A = Vendor X platform
Option B = Vendor Y platform
```

Constraint:

```text
x_A + x_B <= 1
```

The exclusion reason should be stored.

---

# 21. At-Least-One Constraints

Example:

```text
choose one identity control
```

Constraint:

```text
x_A + x_B + x_C >= 1
```

This enables policy-oriented portfolios.

---

# 22. At-Most-N Constraints

Example:

```text
maximum 3 transformation initiatives
```

Constraint:

```text
Σ x_i <= 3
```

---

# 23. Organizational Capacity Constraints

Investment implementation may be limited by:

```text
engineering capacity
change-management capacity
vendor onboarding
deployment windows
security staffing
```

Example:

```text
Σ implementation_days_i * x_i <= available_days
```

This prevents financially feasible but operationally impossible portfolios from appearing executable.

---

# 24. Multi-Budget Constraints

Optional:

```text
CAPEX budget
OPEX budget
people budget
vendor budget
```

Example:

```text
Σ capex_i*x_i <= capex_budget
Σ opex_i*x_i <= opex_budget
Σ people_days_i*x_i <= capacity
```

---

# 25. Regulatory Constraint

Some investments can be linked to:

```text
mandatory requirement
```

where the option is required for a specified control obligation.

The optimization model can use the requirement as a constraint.

P5 must not claim that selecting an option alone establishes compliance.

---

# 26. Risk Appetite Constraint

Optimization can be configured as:

```text
find minimum-cost portfolio such that
post-portfolio risk <= appetite
```

This is a different objective from:

```text
maximize risk reduction under fixed budget
```

Both should be supported.

---

# 27. Objective Modes

Recommended optimization modes:

## Mode A — Maximize Risk Reduction

```text
maximize avoided EAL
subject to budget
```

## Mode B — Minimize Cost to Meet Appetite

```text
minimize normalized cost
subject to residual risk <= appetite
```

## Mode C — Maximize Risk Reduction Under Multiple Constraints

```text
maximize avoided EAL
subject to:
budget
capacity
dependencies
```

## Mode D — Multi-Objective Exploration

Generate a family of efficient portfolios across different trade-offs.

P5 should not hide objective selection.

---

# 28. Pareto Frontier

For multi-objective analysis, show portfolios that are not dominated across selected metrics.

Potential axes:

```text
cost
avoided EAL
residual EAL
VaR95 reduction
implementation burden
```

The frontend presents these as trade-offs.

The platform should not label one frontier point as universally best.

---

# 29. Investment-vs-Risk-Reduction Curve

The curve should represent actual modeled portfolio outcomes.

Axes:

```text
X = total normalized investment
Y = avoided EAL
```

Optional alternative:

```text
X = total normalized investment
Y = residual EAL
```

Each point should identify:

```text
portfolio
selected options
cost
risk reduction
residual risk
confidence
```

---

# 30. Marginal Risk Reduction

For a portfolio:

```text
MarginalReduction_i =
Benefit(Portfolio + i) - Benefit(Portfolio)
```

This is useful for explaining diminishing returns and sequencing.

Do not infer marginal benefit by simply dividing total benefit by option count.

---

# 31. Diminishing Returns

Security investment may show diminishing returns.

Example:

```text
₹5M -> ₹2.5M avoided EAL
₹10M -> ₹3.8M avoided EAL
₹15M -> ₹4.3M avoided EAL
```

The curve is an empirical result of the evaluated scenarios.

Do not hardcode a generic diminishing-return formula.

---

# 32. Scenario Interaction

P4 explicitly supports interactions.

Therefore P5 must distinguish:

```text
standalone benefit
```

from:

```text
combined portfolio benefit
```

Example:

```text
Benefit(A)
Benefit(B)
Benefit(A+B)
```

If:

```text
Benefit(A+B) != Benefit(A) + Benefit(B)
```

P5 must use:

```text
Benefit(A+B)
```

for the combined portfolio calculation.

---

# 33. Portfolio Scenario Generation

For a candidate set:

```text
A, B, C, D
```

small sets may evaluate all combinations.

For larger sets:

```text
candidate filtering
+
optimization
+
selective portfolio scenario evaluation
```

should be used.

P5 must not assume exhaustive enumeration is scalable.

---

# 34. Two-Stage Optimization Architecture

Recommended:

```text
Stage 1
Optimization over available option outcomes
        |
        v
candidate portfolio
        |
        v
Stage 2
P4 combined scenario recalculation
        |
        v
authoritative portfolio risk
```

This is useful because interaction effects may not be fully known until combined state recalculation.

If the final portfolio changes materially after Stage 2:

```text
iterate
```

under a bounded policy.

---

# 35. Optimization Iteration Guard

Recommended configuration:

```text
MAX_PORTFOLIO_RECALCULATION_ITERATIONS
```

Example:

```text
3
```

If convergence is not reached:

```text
return last validated candidate
+
warning
```

Do not silently claim exact optimum if the final evaluation is heuristic or incomplete.

---

# 36. Optimization Algorithm

Preferred free/open-source implementation options:

```text
OR-Tools CP-SAT
HiGHS
SciPy optimization where appropriate
custom dynamic programming for small binary knapsack cases
```

The exact solver should be selected based on constraint types and deployment packaging.

A solver adapter should prevent the application domain from becoming coupled to one vendor/library.

---

# 37. Solver Adapter

Create:

```text
src/services/optimization/solver/
```

Suggested:

```text
solver.interface.ts
orToolsSolver.adapter.ts
highsSolver.adapter.ts
```

Interface:

```ts
interface PortfolioSolver {
  solve(model: OptimizationModel): Promise<OptimizationSolution>;
}
```

---

# 38. Optimization Model Object

```ts
type OptimizationModel = {
  objective:
    | "MAX_EAL_REDUCTION"
    | "MIN_COST_TO_APPETITE"
    | "MAX_MULTI_CONSTRAINT_REDUCTION";

  budget: number;
  currency: string;
  horizonMonths: number;

  options: InvestmentOptionVariable[];

  constraints: OptimizationConstraint[];

  riskTarget?: {
    metric: "EAL" | "RISK_SCORE" | "VAR95";
    threshold: number;
  };
};
```

---

# 39. Investment Variable

```ts
type InvestmentOptionVariable = {
  optionId: string;
  cost: number;

  benefit: {
    avoidedEal: number;
    var95Reduction: number;
    riskScoreReduction: number;
  };

  mandatory: boolean;

  implementationCapacity?: number;

  dependencies: string[];
  conflicts: string[];
};
```

When interactions are material, standalone benefit is only the initial optimization input and must be validated by P4.

---

# 40. Optimization Solution

```ts
type OptimizationSolution = {
  status:
    | "OPTIMAL"
    | "FEASIBLE"
    | "INFEASIBLE"
    | "TIME_LIMIT"
    | "ERROR";

  selectedOptionIds: string[];

  objectiveValue: number;

  totalCost: number;

  lowerBound?: number;
  optimalityGap?: number;

  warnings: string[];
};
```

If the solver stops due to time limit:

```text
do not label the result OPTIMAL
```

unless the solver itself certifies optimality.

---

# 41. Exactness Metadata

Persist:

```text
solver
solverVersion
status
runtime
objective
constraints
optimalityGap
```

Example:

```text
solver: OR-Tools CP-SAT
status: OPTIMAL
gap: 0
```

or:

```text
status: TIME_LIMIT
gap: 3.2%
```

---

# 42. Optimization Run

Recommended:

```text
OptimizationRun
```

fields:

```text
id
organizationId
baselineRiskAssessmentId
status
objectiveType
budget
currency
horizonMonths
startedAt
completedAt
solver
solverVersion
modelHash
solutionHash
optimalityGap
createdBy
```

---

# 43. Optimization Portfolio

Recommended:

```text
OptimizationPortfolio
```

fields:

```text
id
optimizationRunId
name
status
totalCost
avoidedEal
var95Reduction
riskScoreReduction
residualEal
residualVar95
residualRiskScore
scenarioAssessmentId
confidence
```

---

# 44. Portfolio Option Link

```text
OptimizationPortfolioOption
```

fields:

```text
portfolioId
investmentOptionId
selected
allocationQuantity
normalizedCost
scenarioId
```

For binary options:

```text
allocationQuantity = 1
```

For phased options, it may support a scale if the option model explicitly allows it.

---

# 45. Portfolio Scenario

Each proposed portfolio should link to:

```text
P4 combined scenario
```

Example:

```text
Portfolio:
MFA + EDR + segmentation

P4 Scenario:
SCN-PORT-001

Scenario result:
EAL = ...
```

This is essential for interaction-aware financial modeling.

---

# 46. Portfolio Result Authority

Final portfolio risk metrics must come from:

```text
P4/P2 calculated portfolio scenario
```

not:

```text
sum of individual option benefits
```

when interactions are possible.

The optimization solver can use approximated/standalone benefits for search if necessary, but the final reported portfolio metrics must be validated against the combined scenario.

---

# 47. Investment Recommendations

P5 can generate:

```text
Recommended portfolio for specified constraints
```

but the UI should expose:

```text
objective
constraints
assumptions
alternatives
```

rather than presenting a hidden universal choice.

---

# 48. Cost-Benefit Model

At minimum:

```text
Benefit = AvoidedEAL
Cost = NormalizedInvestmentCost
NetBenefit = Benefit - Cost
```

Possible ratio:

```text
BenefitCostRatio = Benefit / Cost
```

provided:

```text
Cost > 0
```

---

# 49. ROSI

A versioned organizational convention can define:

```text
ROSI = ((AvoidedEAL - Cost) / Cost) * 100
```

Example:

```text
Avoided EAL = ₹3M
Cost = ₹2M

Net benefit = ₹1M
ROSI = 50%
```

These numbers are illustrative.

The exact ROSI formula should be configurable because organizations may use different treatment of:

```text
one-time costs
recurring costs
taxes
discounting
secondary benefits
```

---

# 50. ROSI Limitations

ROSI is not:

```text
guaranteed financial return
```

It is a decision-support metric based on:

```text
modeled avoided loss
and
declared cost assumptions
```

The UI/report should make this distinction explicit.

---

# 51. Discounted Cash Flow Extension

Future versions may support:

```text
Net Present Value
Internal Rate of Return
discount rate
multi-year benefits
```

P5 v1 can keep the primary implementation simpler:

```text
normalized horizon cost
+
modeled avoided risk
```

and preserve an extensible financial-model interface.

---

# 52. Secondary Benefits

Some investments have benefits not represented by avoided cyber loss:

```text
operational efficiency
customer trust
audit effort reduction
regulatory process efficiency
```

These may be stored as:

```text
non-risk benefit
```

but should remain separate from:

```text
avoided EAL
```

unless the risk model explicitly monetizes them.

---

# 53. Risk Appetite Gap

Define:

```text
AppetiteGap = CurrentMetric - AppetiteThreshold
```

where positive/negative semantics depend on the metric.

For EAL:

```text
Gap = EAL - EAL_appetite
```

For:

```text
Risk Score
```

use the configured appetite threshold.

Scenario outputs can show:

```text
current gap
portfolio gap
gap reduction
```

---

# 54. Minimum-Cost-to-Appetite Mode

Optimization formulation:

```text
minimize Σ Cost_i*x_i

subject to:

PortfolioRisk <= Appetite
dependencies
mandatory controls
other constraints
```

If no feasible portfolio exists:

```text
return INFEASIBLE
+
constraint diagnostics
```

Do not fabricate a solution by relaxing a constraint silently.

---

# 55. Infeasibility Diagnostics

Explain:

```text
budget too low
mandatory investments consume budget
dependency chain exceeds budget
capacity limit exceeded
conflicting mandatory options
risk threshold unreachable
```

Example:

```text
No feasible portfolio under ₹5M
because required controls cost ₹7.2M
```

---

# 56. Budget Sensitivity

Run optimization across:

```text
₹2M
₹4M
₹6M
₹8M
₹10M
```

and record:

```text
budget
selected portfolio
cost
avoided EAL
residual EAL
risk score
```

This creates:

```text
budget-vs-risk-reduction curve
```

---

# 57. Investment-vs-Risk-Reduction Curve Architecture

For each budget point:

```text
Optimization Run
    |
    v
Candidate Portfolio
    |
    v
Combined P4 Scenario
    |
    v
Validated Risk Outcome
```

Store:

```text
curve series
curve point
optimization run
portfolio
```

---

# 58. Curve Point Model

```ts
type RiskReductionCurvePoint = {
  budget: number;
  currency: string;

  portfolioId: string;

  totalCost: number;

  baselineEal: number;
  residualEal: number;
  avoidedEal: number;

  baselineVar95: number;
  residualVar95: number;

  baselineRiskScore: number;
  residualRiskScore: number;

  validated: boolean;
};
```

---

# 59. Curve Integrity

A curve should not mix results generated with:

```text
different baselines
different model versions
different parameter versions
```

unless the chart explicitly indicates the difference.

Prefer:

```text
one baseline
one model bundle
one parameter set
```

for a comparable curve.

---

# 60. Portfolio Sequencing

Optimization can also produce a sequence:

```text
Phase 1
MFA

Phase 2
Patch critical exposures

Phase 3
EDR

Phase 4
Segmentation
```

Sequencing should consider:

```text
dependencies
implementation capacity
time
risk reduction
```

The sequence should remain a planning artifact unless P4/P5 defines execution-state semantics.

---

# 61. Phased Investments

Future model:

```text
0%
25%
50%
75%
100%
```

coverage levels.

Example:

```text
MFA investment
coverage 60 -> 75 -> 90 -> 95
```

P4 sensitivity scenarios can generate the actual risk outcomes for each stage.

---

# 62. Phase Cost Model

If phased implementation is supported:

```text
quantity
unit cost
fixed cost
variable cost
```

then:

```text
Cost(q)
```

should be evaluated with declared assumptions.

Do not assume linear cost unless documented.

---

# 63. Recommendation-to-Investment Conversion

A P3/P4 recommendation may become an investment option:

```text
Recommendation
    |
    +--> target
    +--> treatment
    +--> estimated cost
    |
    v
P4 scenario
    |
    v
quantified outcome
    |
    v
InvestmentOption
```

This preserves traceability.

---

# 64. Investment Option Evidence

Each option should retain:

```text
source driver
source recommendation
scenario reference
cost evidence
assumptions
```

This lets the executive ask:

```text
Why was this investment considered?
```

and receive a traceable answer.

---

# 65. Investment Evidence Hierarchy

Example:

```text
Option
 |
 +--> Risk Driver
 |      |
 |      +--> Evidence
 |
 +--> Scenario
 |      |
 |      +--> ScenarioAssumption
 |
 +--> Cost
        |
        +--> Quote / estimate / catalog
```

---

# 66. Investment Option Lifecycle

```text
DISCOVERED
    |
    v
EVALUATED
    |
    v
MODELED
    |
    v
OPTIMIZATION_CANDIDATE
    |
    v
SELECTED_FOR_REVIEW
    |
    v
APPROVED / REJECTED
    |
    v
IMPLEMENTATION_TRACKED
```

P5 v1 owns the analytical states; downstream implementation tracking may be added separately.

---

# 67. Human Governance

The optimizer can produce:

```text
solution
```

but an authorized human decision maker controls:

```text
approval
budget commitment
implementation
risk acceptance
```

A system-generated portfolio is not an automatic authorization to spend.

---

# 68. Scenario Revalidation Before Approval

Before an investment decision becomes final:

```text
check baseline freshness
check scenario freshness
check cost validity
check model version
check evidence coverage
```

If material inputs changed:

```text
recalculate
```

or require explicit acceptance of stale analysis.

---

# 69. Optimization Staleness

Store:

```text
baselineAssessmentId
baselineRiskRunId
createdAt
currentAssessmentId
```

When current risk differs materially:

```text
optimization_result_status = STALE
```

Thresholds must be configurable.

---

# 70. Material Change Detection

Possible triggers:

```text
EAL change > configured threshold
Risk Score change > configured threshold
new critical vulnerability
major control coverage change
model version change
cost estimate expiration
```

A stale optimizer result must not silently be reused as current.

---

# 71. Optimization Comparison

Support:

```text
Portfolio A
Portfolio B
Portfolio C
```

with:

```text
cost
avoided EAL
residual EAL
VaR reduction
risk score
capacity
dependencies
ROSI
assumptions
confidence
```

This is an alternative-analysis view.

---

# 72. No Hidden Ranking

The UI may sort by a user-selected field:

```text
cost
avoided EAL
ROSI
residual EAL
```

but the platform should not silently define one universal “best” investment portfolio.

The objective function and constraints must be visible.

---

# 73. Optimization Explanation

For a generated portfolio:

```text
Objective:
maximize avoided EAL

Budget:
₹10M

Selected:
MFA
EDR
Segmentation

Total cost:
₹9.6M

Validated avoided EAL:
₹4.2M

Residual EAL:
₹8.2M

Constraint status:
all satisfied

Solver:
optimal
```

---

# 74. Why an Option Was Not Selected

The system should explain constraint-based exclusion.

Example:

```text
Option:
Cloud hardening

Not selected because:
incremental cost exceeded remaining budget
after mandatory controls.

Alternative portfolio:
...
```

This is a factual solver explanation, not a qualitative judgment about the option.

---

# 75. Shadow Price / Marginal Budget Value

Where supported by the solver, expose:

```text
marginal value of additional budget
```

Example:

```text
Additional ₹1M budget could unlock
an evaluated portfolio with X additional avoided EAL.
```

This should come from the optimization model / sensitivity analysis, not a generic heuristic.

---

# 76. Optimization Constraints Registry

Create a reusable domain:

```text
src/services/optimization/constraints/
```

Possible modules:

```text
budget.constraint.ts
dependency.constraint.ts
conflict.constraint.ts
mandatory.constraint.ts
capacity.constraint.ts
appetite.constraint.ts
regulatory.constraint.ts
```

---

# 77. Objective Registry

Create:

```text
src/services/optimization/objectives/
```

Examples:

```text
maximizeEalReduction.ts
minimizeCostToAppetite.ts
multiObjective.ts
```

Each objective has:

```text
identifier
definition
required metrics
validation
explanation
```

---

# 78. P5 Service Layout

Recommended:

```text
src/services/optimization/
    optimization.service.ts
    investmentOption.service.ts
    portfolio.service.ts
    costNormalization.service.ts
    benefit.service.ts
    rosi.service.ts
    curve.service.ts
    sensitivity.service.ts

    objectives/
    constraints/
    solver/
    validation/
```

---

# 79. Investment Option Service

Responsibilities:

```text
CRUD
versioning
scenario linkage
cost management
dependency metadata
eligibility
```

Suggested:

```ts
interface InvestmentOptionService {
  create(...): Promise<InvestmentOption>;
  update(...): Promise<InvestmentOption>;
  list(...): Promise<InvestmentOption[]>;
  get(...): Promise<InvestmentOption>;
}
```

---

# 80. Benefit Service

Suggested:

```ts
interface InvestmentBenefitService {
  calculateFromScenario(
    scenarioResult: ScenarioResult
  ): InvestmentBenefit;
}
```

Benefit output must include:

```text
baseline metric
scenario metric
reduction
method
scenario ID
risk run ID
```

---

# 81. Cost Normalization Service

Suggested:

```ts
interface CostNormalizationService {
  normalize(
    cost: InvestmentCost,
    horizonMonths: number,
    currency: string
  ): NormalizedCost;
}
```

Currency conversion is outside the core optimizer unless an approved FX source is configured.

---

# 82. ROSI Service

Suggested:

```ts
interface RosiService {
  calculate(
    cost: NormalizedCost,
    avoidedEal: number,
    convention: RosiConvention
  ): RosiResult;
}
```

Store:

```text
conventionVersion
```

---

# 83. Portfolio Service

Responsibilities:

```text
portfolio persistence
option membership
validated P4 scenario linkage
financial metrics
governance state
```

---

# 84. Curve Service

Responsibilities:

```text
generate budget points
run optimization per budget
validate scenario outcomes
store curve
```

---

# 85. Sensitivity Service

Supports variation of:

```text
budget
cost
control effectiveness
scenario assumptions
risk appetite
```

Outputs:

```text
portfolio result
metric range
assumption sensitivity
```

---

# 86. API Design

## 86.1 Investment Options

### `GET /api/v1/investment-options`

Filters:

```text
category
status
source
driver_id
scenario_id
```

### `POST /api/v1/investment-options`

Creates an option.

### `GET /api/v1/investment-options/{id}`

Returns:

```text
option
cost
scenario linkage
drivers
constraints
```

---

# 87. Option Evaluation

### `POST /api/v1/investment-options/{id}/evaluate`

Triggers:

```text
P4 scenario creation/resolution
+
risk calculation
+
benefit calculation
```

Return:

```text
evaluation ID
```

for asynchronous execution where required.

---

# 88. Optimization Run

### `POST /api/v1/optimization/runs`

Request example:

```json
{
  "objective": "MAX_EAL_REDUCTION",
  "budget": 10000000,
  "currency": "INR",
  "horizonMonths": 12,
  "baselineRiskAssessmentId": "risk-001",
  "optionIds": [
    "inv-001",
    "inv-002",
    "inv-003"
  ],
  "constraints": {
    "maxImplementationDays": 180
  }
}
```

Response:

```text
202 Accepted
optimizationRunId
```

for asynchronous execution.

---

# 89. Optimization Result

### `GET /api/v1/optimization/runs/{id}`

Return:

```text
run metadata
solver status
objective
constraints
selected portfolios
optimality gap
warnings
```

---

# 90. Portfolio Result

### `GET /api/v1/optimization/portfolios/{id}`

Return:

```text
selected options
cost
risk metrics
ROSI
scenario
assumptions
evidence
```

---

# 91. Investment-Risk Curve

### `POST /api/v1/optimization/curves`

Request:

```json
{
  "baselineRiskAssessmentId": "risk-001",
  "objective": "MAX_EAL_REDUCTION",
  "budgets": [
    2000000,
    4000000,
    6000000,
    8000000,
    10000000
  ],
  "currency": "INR",
  "horizonMonths": 12
}
```

Return:

```text
curve job ID
```

---

# 92. Curve Result

### `GET /api/v1/optimization/curves/{id}`

Return:

```text
baseline
budget points
portfolio IDs
risk reduction
residual risk
validation state
```

---

# 93. Compare Portfolios

### `POST /api/v1/optimization/compare`

Request:

```json
{
  "portfolioIds": [
    "portfolio-a",
    "portfolio-b",
    "portfolio-c"
  ]
}
```

Return a comparable structured response.

---

# 94. Explain Portfolio

### `GET /api/v1/optimization/portfolios/{id}/explanation`

Return:

```text
objective
selected constraints
binding constraints
excluded options
driver coverage
scenario impact
cost basis
solver status
```

This can feed the AI explanation layer.

---

# 95. Investment Decision Handoff

P5 can create:

```text
InvestmentDecisionCandidate
```

containing:

```text
portfolioId
requestedBudget
selectedOptions
riskOutcome
cost outcome
approver
status
```

P5 does not authorize the final spend.

---

# 96. Investment Decision Audit

Events:

```text
OPTIMIZATION_RUN_CREATED
OPTIMIZATION_COMPLETED
PORTFOLIO_SELECTED_FOR_REVIEW
PORTFOLIO_EXPORTED
INVESTMENT_DECISION_CREATED
INVESTMENT_DECISION_APPROVED
INVESTMENT_DECISION_REJECTED
```

The existing `AuditLog` should continue to capture product/account activity.

Analytical traceability should use the newer risk/governance audit model introduced by P1/P3.

---

# 97. Optimization Evidence

Store references to:

```text
RiskDriver
Scenario
ScenarioAssessment
RiskRun
CostEvidence
```

This provides:

```text
risk -> treatment -> money
```

traceability.

---

# 98. AI / NLQ Integration

The natural-language layer may support:

```text
"What can we do with a ₹1 crore budget?"

"How much EAL could be reduced with ₹50 lakh?"

"What portfolio gets us within risk appetite?"

"Why wasn't EDR selected?"

"Show investment options under ₹10 lakh."
```

Flow:

```text
Natural language
   |
   v
intent parser
   |
   v
structured optimization query
   |
   v
P5 API
   |
   v
verified results
   |
   v
LLM explanation
```

The LLM does not perform the authoritative optimization itself.

---

# 99. AI Guardrails

LLM may:

```text
translate user intent
summarize optimization output
explain constraint effects
describe trade-offs
```

LLM may not:

```text
invent option costs
invent avoided EAL
change budget without authorization
claim optimizer optimality when status is FEASIBLE
claim compliance
```

---

# 100. Natural-Language Query Example

User:

```text
What if I have ₹1 crore?
```

System should clarify through structured context if available:

```text
currency = INR
horizon = configured default
objective = current/selected objective
scope = enterprise
```

Then return:

```text
budget
portfolio alternatives
cost
modeled avoided EAL
residual risk
assumptions
solver status
```

---

# 101. Frontend Investment Workspace

Recommended layout:

```text
Investment Optimization

Current Risk
EAL | VaR95 | Risk Score

Budget
₹10,000,000

Objective
[Maximize EAL Reduction]

Constraints
[12 month horizon]
[180 implementation days]

Candidate Investments
...

Optimized Portfolio
...

Cost
...

Modeled Risk Reduction
...

Residual Risk
...

ROSI
...

Investment vs Risk Reduction
[Curve]

Portfolio Alternatives
[Comparison]

Why these investments?
[Evidence / drivers / scenarios]
```

---

# 102. Portfolio Card

Show:

```text
Portfolio name
Total cost
Avoided EAL
Residual EAL
VaR reduction
Risk Score reduction
ROSI
Solver status
Confidence
```

Do not display an unlabeled single “best portfolio” badge.

---

# 103. Option Card

Show:

```text
Investment
Cost
Scenario
Modeled avoided EAL
Dependencies
Affected risk drivers
Evidence quality
Implementation burden
```

---

# 104. Curve Interaction

Hovering over a curve point should display:

```text
Budget
Selected portfolio
Total cost
Avoided EAL
Residual EAL
ROSI
Risk appetite state
Solver status
```

Clicking opens the actual portfolio.

---

# 105. Globe Integration

The globe can visualize:

```text
investment option scope
affected asset locations
affected services
blast radius
financial risk change
```

Example:

```text
Portfolio:
Segment public customer services

Globe:
affected service locations highlighted

Panel:
baseline EAL
scenario EAL
reduction
```

The globe must consume actual scenario/portfolio context.

---

# 106. Business Unit Allocation

P5 should optionally provide:

```text
budget by business unit
```

Example:

```text
Retail Banking
₹4M

Corporate Banking
₹2M

Shared Services
₹3M
```

Allocation should derive from selected option scope.

---

# 107. Budget Allocation Constraint

For multi-BU budgeting:

```text
Σ Cost_i,BU <= BU_Budget
```

for each budget-controlled unit.

A shared-service investment may have:

```text
cost allocation policy
```

but should not double-count cost.

---

# 108. Shared-Service Investments

Example:

```text
Enterprise IAM platform
```

affects:

```text
multiple business units
```

The option should exist once.

Risk benefits can propagate through:

```text
dependency graph
```

Cost must remain one shared investment cost unless explicit allocation is required.

---

# 109. Anti-Double-Counting

Do not:

```text
count same investment cost multiple times
count same avoided EAL multiple times
count same shared service benefit once per dependent service
```

Portfolio-level metrics must be calculated from:

```text
combined scenario
```

rather than summing duplicated child values.

---

# 110. Optimization Coverage

An optimization result should show:

```text
risk-driver coverage
```

Example:

```text
Critical vulnerabilities:
8/10 addressed

Identity control gap:
addressed

Cloud hardening:
partial

Dependency concentration:
not addressed
```

This is a factual coverage view.

---

# 111. Coverage Model

For each driver:

```text
addressed
partially addressed
not addressed
```

The mapping should be based on explicit:

```text
option -> driver
```

relationships.

Do not infer coverage merely because:

```text
two options belong to the same category
```

---

# 112. Driver-to-Investment Mapping

Recommended entity:

```text
InvestmentOptionDriver
```

fields:

```text
investmentOptionId
riskDriverType
driverReference
coverageType
coverageRationale
```

This allows explainability.

---

# 113. Driver Coverage and Scenario Validation

An option claims to address a driver only when:

```text
P4 scenario changes the relevant state
```

and:

```text
P3 attribution confirms the relevant risk change
```

where applicable.

---

# 114. Residual Driver Analysis

After portfolio scenario:

```text
P3 driver attribution
```

should identify remaining drivers.

Example:

```text
Residual risk drivers:
service dependency
business impact concentration
internal vulnerability
control coverage gap
```

This supports the next investment cycle.

---

# 115. Iterative Risk Treatment Loop

The full platform loop becomes:

```text
Measure
  ->
Attribute
  ->
Treat
  ->
Simulate
  ->
Optimize
  ->
Decide
  ->
Implement
  ->
Re-measure
```

This creates the continuous operating model required by PS 26105.

---

# 116. Continuous Optimization Trigger

Optimization can be re-run when:

```text
material risk change
new critical vulnerability
new threat intelligence
control drift
budget update
new cost quote
risk appetite change
model version change
```

P5 should not automatically spend or deploy anything.

---

# 117. Optimization Freshness

Store:

```text
riskAssessmentId
riskRunId
dataAsOf
costAsOf
modelBundleId
parameterBundleId
```

A portfolio becomes stale when these materially change.

---

# 118. Cost Expiration

For cost estimates with:

```text
validTo
```

after expiration:

```text
mark cost stale
```

and require:

```text
cost refresh
```

before final decision handoff.

---

# 119. Currency

Default platform deployment may use:

```text
INR
```

for the Indian SIH use case.

Every financial result should eventually store:

```text
currency
```

explicitly.

Do not assume all future tenants use INR.

---

# 120. Currency Conversion

If multi-currency support is implemented:

```text
source currency
target currency
FX source
FX timestamp
FX rate
```

must be stored.

Avoid silently converting financial amounts.

---

# 121. Financial Precision

Database storage should use a fixed/high-precision numeric type appropriate for:

```text
financial values
```

rather than floating-point persistence where avoidable.

The application can use validated numeric types internally.

---

# 122. Optimization Numerical Safety

Check:

```text
cost >= 0
budget >= 0
benefit finite
ROSI finite
```

Reject:

```text
NaN
Infinity
negative cost without explicit credit semantics
```

---

# 123. Negative/Zero Benefit

If:

```text
AvoidedEAL <= 0
```

the option can still exist because:

```text
other objective
mandatory requirement
non-financial benefit
```

may justify evaluation.

However, P5 should not hide the zero/negative modeled risk benefit.

---

# 124. Mandatory Option with Negative Modeled Benefit

If a mandatory option has:

```text
negative or zero modeled EAL reduction
```

show:

```text
mandatory
+
modeled financial benefit
+
reason for mandatory classification
```

Do not manipulate the risk metric to force a positive benefit.

---

# 125. Cost-Free Option

If:

```text
Cost = 0
```

ROSI becomes undefined under:

```text
Benefit / Cost
```

The system should show:

```text
ROSI: N/A
```

rather than divide by zero.

---

# 126. Very Low Cost

For extremely low cost:

```text
ROSI
```

may become numerically very large.

Display with explicit formatting and retain the underlying precision.

---

# 127. Uncertainty in Benefits

Scenario-derived benefit should retain:

```text
confidence
distribution metadata
model version
evidence quality
```

The optimizer can optionally operate on:

```text
expected avoided EAL
conservative avoided EAL
```

but the objective convention must be explicit.

---

# 128. Conservative Optimization Mode

Possible future objective:

```text
maximize lower-confidence-bound risk reduction
```

For example:

```text
benefit_LCB
```

if the model produces an appropriate uncertainty interval.

This should not be simulated through arbitrary haircut percentages.

---

# 129. Robust Optimization

Future extension may support:

```text
uncertain cost
uncertain benefit
uncertain threat intensity
```

with robust constraints.

P5 v1 can preserve an extension point:

```text
optimizationRiskMode
```

without implementing arbitrary uncertainty penalties.

---

# 130. Monte Carlo Portfolio Benefit

Where portfolio scenario is run through P4:

```text
baseline loss samples
scenario loss samples
```

may be compared to estimate:

```text
distribution of avoided loss
```

This can support future:

```text
Expected Avoided Loss
VaR of Avoided Loss
confidence intervals
```

The primary P5 v1 benefit remains:

```text
avoided EAL
```

from authoritative scenario results.

---

# 131. Scenario Cost vs Risk Reduction

For each option:

```text
cost
risk reduction
```

and for each portfolio:

```text
aggregate cost
validated risk reduction
```

The frontend can visualize:

```text
scatter plot:
x = cost
y = avoided EAL
```

with explicit portfolio IDs.

---

# 132. Investment Analytics

Potential panels:

```text
Budget Utilization
Modeled Risk Reduction
Residual Risk
Marginal Benefit
ROSI
Cost Breakdown
Driver Coverage
Scenario Confidence
```

---

# 133. Budget Utilization

Show:

```text
Allocated
Unallocated
Utilization %
```

Example:

```text
Budget = ₹10M
Selected cost = ₹9.4M
Unallocated = ₹0.6M
Utilization = 94%
```

---

# 134. Constraint Slack

For every major constraint show:

```text
limit
used
slack
binding
```

Example:

```text
Budget:
₹10M limit
₹9.4M used
₹0.6M slack

Implementation:
180 days limit
174 used
6 days slack
```

This helps explain solver behavior.

---

# 135. Binding Constraint Explanation

A solution may be constrained by:

```text
budget
capacity
dependency
mandatory requirement
risk appetite
```

Expose the relevant binding constraint.

---

# 136. Solver Explainability

The backend should store enough model metadata to explain:

```text
why option selected
why option excluded
which constraints were active
whether optimum was certified
```

Do not ask the LLM to reverse-engineer the solver.

---

# 137. Optimization Reproducibility

Given:

```text
same investment options
same costs
same scenario outcomes
same constraints
same objective
same solver version
same solver configuration
```

the resulting optimization should be reproducible within the solver's documented behavior.

Store:

```text
modelHash
solver config
random seed if applicable
```

---

# 138. Optimization Model Hash

Canonical model includes:

```text
options
costs
benefits
dependencies
constraints
objective
budget
horizon
versions
```

Compute:

```text
SHA-256(canonicalOptimizationModel)
```

Store:

```text
modelHash
```

---

# 139. Portfolio Hash

Canonical portfolio result:

```text
optimizationRunId
selected option IDs
allocations
validated scenario ID
metrics
```

Store:

```text
portfolioHash
```

---

# 140. Blockchain Integrity Adapter

Optional ledger anchor:

```text
optimizationRunHash
portfolioHash
decisionPackageHash
```

Anchor only minimal metadata.

Never put:

```text
raw telemetry
PII
business financial details
```

on-chain.

The ledger proves:

```text
record integrity after anchoring
```

not:

```text
optimization correctness
```

---

# 141. Governance Report

The P5 report should include:

```text
Objective
Budget
Horizon
Constraints
Investment options considered
Selected portfolio(s)
Scenario linkage
Modeled risk reduction
Residual risk
Cost
ROSI
Solver status
Optimality gap
Assumptions
Evidence
Approvals
Hashes
```

---

# 142. Executive Language

Recommended wording:

```text
"Under the selected 12-month budget and model assumptions..."

"The portfolio has a modeled avoided EAL of..."

"The analysis uses..."

"The solver returned an optimal/feasible solution..."

"Residual modeled risk remains..."
```

Avoid:

```text
"This investment guarantees..."
"This spend will prevent..."
"This is objectively the best..."
```

The platform is decision support.

---

# 143. Technical Language

Technical report may include:

```text
asset coverage
control state
vulnerability state
scenario mutations
dependency impacts
model version
simulation parameters
solver constraints
```

---

# 144. Compliance Linkage

Investment options can be mapped to:

```text
ISO/IEC 27001
NIST CSF
CIS Controls
RBI Cyber Security Framework
SEBI Cybersecurity and Cyber Resilience Framework
```

The mapping should explain:

```text
what control the option supports
```

rather than claiming:

```text
investment selected = compliant
```

---

# 145. Audit Trail

Record:

```text
INVESTMENT_OPTION_CREATED
INVESTMENT_OPTION_UPDATED
COST_UPDATED
SCENARIO_LINKED
OPTION_EVALUATED
OPTIMIZATION_RUN_CREATED
OPTIMIZATION_COMPLETED
PORTFOLIO_CREATED
PORTFOLIO_VALIDATED
PORTFOLIO_EXPORTED
DECISION_CANDIDATE_CREATED
```

---

# 146. Human Override

A user may override:

```text
cost estimate
option eligibility
dependency metadata
mandatory status
```

but must provide:

```text
actor
timestamp
rationale
previous value
new value
```

The original model/evidence remains preserved.

---

# 147. Override Effect

After material override:

```text
optimization model hash changes
```

and previous optimization results are not silently reused.

---

# 148. Security

P5 endpoints inherit:

```text
Firebase auth
organization isolation
role/permission model
rate limiting
audit
input validation
```

High-cost optimization endpoints additionally require:

```text
job quota
concurrency limit
```

---

# 149. Tenant Isolation

Every query must enforce:

```text
organizationId
```

across:

```text
InvestmentOption
Scenario
ScenarioResult
OptimizationRun
Portfolio
CostEvidence
```

No cross-tenant scenario result may be used in optimization.

---

# 150. Injection Protection

Natural-language optimization input must be converted into a structured request.

Do not pass raw LLM-generated expressions into:

```text
SQL
solver
filesystem
shell
```

without validation.

---

# 151. Resource Limits

Optimization can become expensive.

Configuration:

```text
MAX_OPTIONS
MAX_CONSTRAINTS
MAX_SCENARIOS_PER_RUN
MAX_CURVE_POINTS
MAX_RUNTIME_SECONDS
MAX_CONCURRENT_JOBS
```

---

# 152. Asynchronous Jobs

Recommended job types:

```text
INVESTMENT_EVALUATION
OPTIMIZATION_RUN
PORTFOLIO_VALIDATION
BUDGET_CURVE
SENSITIVITY_ANALYSIS
```

Job status:

```text
QUEUED
RUNNING
COMPLETED
FAILED
CANCELLED
TIME_LIMIT
```

---

# 153. Cancellation

Users may cancel long-running analytical jobs.

Cancellation should:

```text
stop queued work
attempt safe solver cancellation
preserve partial metadata
```

A cancelled run must not be represented as an optimization result.

---

# 154. Partial Results

If a batch curve job completes some points:

```text
completed points
+
failed points
+
warnings
```

may be returned.

A curve should show which points are:

```text
validated
unvalidated
failed
```

---

# 155. Solver Time Limit

If:

```text
TIME_LIMIT
```

and the solver returns a feasible solution:

```text
status = FEASIBLE
```

Store:

```text
best known objective
optimality gap where available
```

Do not call it mathematically optimal.

---

# 156. Infeasible Optimization

Return:

```text
INFEASIBLE
```

with diagnostics.

Potential UI:

```text
No feasible portfolio under current constraints.

Binding issues:
Budget too low
+
mandatory controls
```

---

# 157. No-Option Case

If there are no eligible options:

```text
return valid empty optimization model
```

with:

```text
portfolio = empty
```

and clear explanation.

---

# 158. Option Eligibility

An investment option may be ineligible due to:

```text
scope
status
cost data missing
scenario unavailable
expired evidence
dependency unresolved
```

Eligibility should be explicit.

---

# 159. Candidate Filtering

Pre-filter options only on factual constraints:

```text
tenant
scope
availability
mandatory rules
invalid data
hard exclusions
```

Do not hide valid alternatives simply because they have a lower heuristic score.

---

# 160. Risk-Driver Coverage Filter

An optional user-controlled filter can focus on:

```text
specific driver
business unit
service
risk category
```

This changes the optimization search scope and must be visible.

---

# 161. Business Service Investment

Some options may protect:

```text
specific business service
```

rather than an entire organization.

Store:

```text
scopeType
scopeId
```

and derive impacted downstream services from the dependency graph.

---

# 162. Shared Control Investment

An option such as:

```text
Central IAM platform
```

may protect many assets.

Its P4 scenario should model:

```text
control state change
```

across the relevant asset/service population.

---

# 163. Investment Portfolio Scope

The optimizer may operate at:

```text
enterprise
business unit
service
asset group
```

The baseline risk assessment must use the same declared scope.

---

# 164. Cross-Scope Portfolio

A portfolio can contain enterprise-wide and local options.

Example:

```text
Enterprise MFA
+
Payment-service segmentation
+
Retail-cloud hardening
```

The combined P4 scenario must resolve all affected state.

---

# 165. Portfolio Dependency Graph

The optimization layer should maintain:

```text
option dependency graph
```

separate from:

```text
asset/service dependency graph
```

They interact, but they are different concepts.

---

# 166. Risk Graph vs Investment Graph

```text
Cyber Risk Graph
    asset -> service -> business dependency

Investment Graph
    option -> prerequisite -> conflict
```

The optimizer operates primarily on the investment graph, while P4 calculates cyber risk impact using the cyber-risk graph.

---

# 167. Cost-Benefit Attribution to Drivers

For each investment:

```text
which P3 drivers does it address?
```

and:

```text
how much modeled EAL reduction resulted?
```

This provides:

```text
investment -> risk driver -> scenario -> evidence
```

traceability.

---

# 168. Example Investment Card

```text
Investment:
Privileged MFA Expansion

Cost:
₹4.5M one-time
₹1.2M annual

Scenario:
MFA coverage 62% -> 95%

Baseline EAL:
₹12.4M

Scenario EAL:
₹9.6M

Avoided EAL:
₹2.8M

Residual EAL:
₹9.6M

ROSI:
versioned calculation

Primary Drivers Addressed:
Privileged identity weakness
External access exposure
```

Illustrative only.

---

# 169. Portfolio Example

```text
Budget:
₹10M

Selected:
MFA Expansion
Critical CVE Remediation
Network Segmentation

Total normalized cost:
₹9.6M

Validated portfolio EAL:
₹8.2M

Baseline EAL:
₹12.4M

Avoided EAL:
₹4.2M

Residual:
₹8.2M
```

The portfolio result comes from a combined P4 scenario, not a sum of isolated benefits.

---

# 170. Cost-Benefit Report

A report table may include:

| Option | Cost | Modeled Avoided EAL | Residual EAL | ROSI | Scenario | Status |
|---|---:|---:|---:|---:|---|---|
| MFA Expansion | ₹... | ₹... | ₹... | ... | SCN-... | Validated |
| EDR Expansion | ₹... | ₹... | ₹... | ... | SCN-... | Validated |
| Segmentation | ₹... | ₹... | ₹... | ... | SCN-... | Validated |

All values are scenario-derived and versioned.

---

# 171. P5 Frontend Data Flow

```text
useInvestmentOptions()
useOptimizationRuns()
useOptimizationPortfolio()
useInvestmentRiskCurve()
usePortfolioComparison()
```

Keep P2/P4 calculations backend-only.

---

# 172. React Hook Example Contract

```ts
type OptimizationPortfolio = {
  id: string;
  totalCost: number;
  avoidedEal: number;
  residualEal: number;
  residualRiskScore: number;
  rosi?: number;
  solverStatus: string;
  optimalityGap?: number;
  selectedOptions: InvestmentOption[];
};
```

---

# 173. Frontend Validation

Before running optimization:

```text
budget > 0
currency valid
horizon valid
baseline selected
options available
constraints valid
```

Backend repeats all validation.

---

# 174. Optimization Workspace States

```text
CONFIGURING
VALIDATING
RUNNING
COMPLETED
NO_FEASIBLE_SOLUTION
FAILED
STALE
```

---

# 175. Stale Optimization UX

Example:

```text
This portfolio was calculated against
the 25 Sep risk assessment.

A newer risk assessment exists.

Revalidation required before investment decision.
```

---

# 176. Globe + Investment View

Potential flow:

```text
Select portfolio
      |
      v
globe highlights affected scope
      |
      v
click location
      |
      v
assets/services affected
      |
      v
driver changes
      |
      v
financial risk delta
```

This makes the globe an analytical decision surface rather than decorative UI.

---

# 177. Executive Dashboard Integration

Recommended executive section:

```text
Cyber Risk Investment

Current EAL
Risk Appetite
Budget
Modeled Risk Reduction
Residual Risk

[Investment-vs-Risk-Reduction Curve]

[Portfolio Comparison]
```

---

# 178. Decision Narrative

The backend can provide structured facts:

```text
Budget:
₹10M

Objective:
maximize avoided EAL

Portfolio:
3 options

Cost:
₹9.6M

Validated avoided EAL:
₹4.2M

Residual EAL:
₹8.2M

Status:
OPTIMAL
```

The AI layer can then convert those facts into concise executive prose.

---

# 179. Business Translation Rules

Translate:

```text
CVEs
control coverage
attack surface
telemetry
```

into:

```text
modeled financial exposure
risk reduction
residual risk
investment requirement
```

without losing technical drill-down.

---

# 180. Scenario Evidence in Executive View

Each portfolio should allow:

```text
View assumptions
View drivers
View evidence
View calculation
```

This supports challenge during executive review.

---

# 181. Assumption Disclosure

Every portfolio should list:

```text
cost assumptions
scenario assumptions
risk model versions
data freshness
confidence/limitations
```

This is mandatory for no-false-precision behavior.

---

# 182. Portfolio Confidence

Suggested:

```text
HIGH
MEDIUM
LOW
INSUFFICIENT
```

derived from:

```text
scenario evidence
model confidence
cost evidence
input coverage
```

Confidence should never override solver status.

---

# 183. Solver Status vs Confidence

A portfolio may be:

```text
solver = OPTIMAL
confidence = LOW
```

This is valid because:

```text
optimality
```

means optimal under the modeled inputs/constraints, not certainty of the real-world outcome.

---

# 184. Real-World Outcome Limitation

P5 measures:

```text
modeled expected benefit
```

not:

```text
guaranteed future loss avoidance
```

Post-implementation telemetry and incident outcomes should eventually be used to evaluate realized effectiveness.

---

# 185. Closed-Loop Learning

After deployment:

```text
planned control state
        |
        v
actual control state
        |
        v
new telemetry
        |
        v
new risk assessment
        |
        v
compare planned vs realized
```

This provides the basis for future model calibration.

---

# 186. Implementation Feedback

P5 can later store:

```text
planned investment
actual cost
planned coverage
actual coverage
planned risk reduction
realized risk change
```

This is outside core P5 v1 but should be schema-compatible.

---

# 187. Model Monitoring

Optimization results should be linked to:

```text
model version
```

so later backtesting can compare:

```text
predicted benefit
vs
observed risk trajectory
```

---

# 188. Data Quality Warnings

Potential:

```text
missing cost source
stale scenario
low telemetry coverage
unresolved driver
cost estimate expired
model drift alert
```

Warnings should be visible in the portfolio result.

---

# 189. Portfolio Validation Pipeline

```text
Optimization output
    |
    v
Validate selected options
    |
    v
Create combined scenario
    |
    v
P4 scenario validation
    |
    v
P2 calculation
    |
    v
P3 attribution
    |
    v
Portfolio validation result
```

---

# 190. Portfolio Validation Status

```text
UNVALIDATED
VALIDATING
VALIDATED
VALIDATED_WITH_WARNINGS
INVALID
```

A portfolio can be solver-optimal but:

```text
INVALID
```

if the combined scenario cannot be resolved safely.

---

# 191. Portfolio Validation Failure

Example:

```text
Optimizer selected:
A + B + C

Combined scenario:
invalid because
A and C modify the same target incompatibly
```

Return:

```text
portfolio not validated
```

and re-run optimization with the invalid combination excluded or modeled correctly.

---

# 192. Optimization Loop With Validation

```text
1. Solve model
2. Generate candidate
3. Validate candidate with P4
4. If valid -> accept
5. If invalid -> add exclusion/constraint
6. Re-solve
7. Stop at configured iteration limit
```

This is a practical architecture for interaction-aware optimization.

---

# 193. Validation Cut Generation

When a portfolio is invalid due to a hard conflict:

```text
portfolio A+B+C invalid
```

the optimizer can add:

```text
x_A + x_B + x_C <= 2
```

if that exactly captures the discovered conflict.

The generated cut must be mathematically justified by the validator.

---

# 194. Interaction Discovery

When:

```text
combined scenario
```

has a materially different result than:

```text
sum of isolated benefits
```

store:

```text
interaction detected
```

Future runs can use the measured interaction.

---

# 195. Interaction Model Cache

Cache validated pair/group interactions where safe:

```text
option set hash
baseline run
model version
parameter version
scenario state
```

Then reuse the result only when all dependencies remain identical.

---

# 196. Option Versioning

Investment options change over time.

Store:

```text
optionVersion
```

when any material field changes:

```text
cost
scope
scenario definition
dependencies
benefit linkage
```

Old optimization runs continue to reference their option versions.

---

# 197. Cost Versioning

A cost change creates:

```text
new cost version
```

not a mutation of historical optimization inputs.

---

# 198. Optimization Input Bundle

Persist:

```text
baseline risk assessment
investment option versions
cost versions
scenario outcomes
constraints
objective
model versions
parameter versions
```

This forms the authoritative optimization input bundle.

---

# 199. Optimization Bundle Hash

Compute:

```text
SHA-256(
  canonical optimization input bundle
)
```

Store:

```text
optimizationInputHash
```

---

# 200. Decision Package

A final portfolio can package:

```text
optimization input hash
portfolio hash
scenario hash
calculation hash
evidence refs
cost refs
approval refs
```

This can feed the governance / ledger layer.

---

# 201. Regulatory / Audit Evidence

For an auditable decision, retain:

```text
risk assessment
drivers
scenario
investment option
cost basis
optimization objective
constraints
solver status
portfolio result
approvals
```

This demonstrates a documented risk-treatment decision process without claiming automatic regulatory compliance.

---

# 202. Database Design

Recommended target entities:

```text
InvestmentOption
InvestmentOptionVersion
InvestmentCost
InvestmentOptionDriver
InvestmentDependency
InvestmentConflict
OptimizationRun
OptimizationConstraint
OptimizationPortfolio
OptimizationPortfolioOption
PortfolioRiskValidation
RiskReductionCurve
RiskReductionCurvePoint
InvestmentDecisionCandidate
```

---

# 203. InvestmentOption

Fields:

```text
id
organizationId
name
description
category
status
source
createdBy
createdAt
updatedAt
```

---

# 204. InvestmentOptionVersion

Fields:

```text
id
investmentOptionId
version
scenarioTemplateId
scopeType
scopeId
createdAt
```

---

# 205. InvestmentCost

Fields:

```text
id
investmentOptionVersionId
currency
oneTime
annualRecurring
monthlyRecurring
implementation
licensing
personnel
consulting
migration
training
costBasis
sourceReference
validFrom
validTo
```

---

# 206. InvestmentDependency

Fields:

```text
id
investmentOptionVersionId
dependsOnOptionVersionId
dependencyType
rationale
```

---

# 207. InvestmentConflict

Fields:

```text
id
optionVersionA
optionVersionB
reason
severity
```

---

# 208. OptimizationRun

Fields:

```text
id
organizationId
baselineRiskAssessmentId
baselineRiskRunId
objectiveType
budget
currency
horizonMonths
status
solver
solverVersion
solverConfig
modelHash
inputHash
optimalityGap
startedAt
completedAt
createdBy
```

---

# 209. OptimizationConstraint

Fields:

```text
id
optimizationRunId
type
definition
value
unit
source
```

---

# 210. OptimizationPortfolio

Fields:

```text
id
optimizationRunId
name
status
solverStatus
totalCost
avoidedEal
residualEal
var95Reduction
residualVar95
riskScoreReduction
residualRiskScore
rosi
benefitCostRatio
confidence
portfolioHash
createdAt
```

---

# 211. Portfolio Risk Validation

Fields:

```text
id
portfolioId
scenarioId
scenarioRunId
status
validatedAt
baselineEal
scenarioEal
avoidedEal
validationHash
warnings
```

---

# 212. Risk Reduction Curve

Fields:

```text
id
organizationId
baselineRiskAssessmentId
objectiveType
currency
horizonMonths
status
modelHash
createdAt
```

---

# 213. Curve Point

Fields:

```text
id
curveId
budget
portfolioId
totalCost
avoidedEal
residualEal
riskScoreReduction
validated
optimalityGap
```

---

# 214. Investment Decision Candidate

Fields:

```text
id
organizationId
portfolioId
requestedBudget
status
createdBy
reviewerId
rationale
createdAt
updatedAt
```

---

# 215. Migration From Existing Optimizer

Current:

```text
recommendation
    ->
greedy optimize
```

Target:

```text
risk driver
    ->
recommendation
    ->
P4 scenario
    ->
InvestmentOption
    ->
P5 optimizer
    ->
P4 validation
```

---

# 216. Legacy Compatibility

Current endpoint:

```text
GET /api/cyber-risk/enterprise
```

may continue returning legacy recommendation/optimization fields during transition.

The new canonical APIs should expose:

```text
/api/v1/investment-options/*
/api/v1/optimization/*
```

The legacy response can gradually be backed by P5 results.

---

# 217. Migration Phases

## Phase A

Add database models.

## Phase B

Create option catalog and cost versions.

## Phase C

Connect options to P4 scenarios.

## Phase D

Implement solver adapter.

## Phase E

Implement optimization runs.

## Phase F

Implement combined portfolio validation.

## Phase G

Implement curve/sensitivity.

## Phase H

Migrate frontend.

## Phase I

Deprecate greedy prototype.

---

# 218. Feature Flags

Recommended:

```text
INVESTMENT_ENGINE_V2_ENABLED
OPTIMIZATION_EXACT_SOLVER_ENABLED
PORTFOLIO_VALIDATION_ENABLED
RISK_REDUCTION_CURVE_ENABLED
ROSI_V2_ENABLED
OPTIMIZATION_AI_ENABLED
OPTIMIZATION_GLOBE_ENABLED
OPTIMIZATION_BLOCKCHAIN_ANCHOR_ENABLED
```

---

# 219. Rollback

Disable:

```text
INVESTMENT_ENGINE_V2_ENABLED
```

without deleting:

```text
InvestmentOption
OptimizationRun
Portfolio
Scenario
```

Historical records remain intact.

---

# 220. Existing Recommendation Compatibility

Existing recommendations can be imported as:

```text
InvestmentOption.source = RECOMMENDATION
```

with:

```text
sourceRecommendationId
```

Their old hardcoded percentage benefit must not automatically become authoritative.

---

# 221. Recommendation Cost Migration

Current hardcoded costs may be migrated as:

```text
costBasis = MODEL_ASSUMPTION
```

until replaced by:

```text
USER_PROVIDED
INTERNAL_ESTIMATE
VENDOR_QUOTE
CATALOG
```

This preserves historical context.

---

# 222. Old Greedy Optimizer

The legacy greedy selector can be retained for:

```text
comparative testing
```

but should not be labelled:

```text
exact optimization
```

or:

```text
optimal
```

---

# 223. Optimization Regression Tests

For known small fixture:

```text
options A/B/C/D
budget
dependencies
conflicts
benefits
```

compare:

```text
solver result
```

against:

```text
brute-force enumeration
```

for correctness.

---

# 224. Solver Correctness Test

For small N:

```text
enumerate every feasible portfolio
```

and verify:

```text
solver objective >= all alternatives
```

when solver reports:

```text
OPTIMAL
```

This is an excellent validation mechanism for the implementation.

---

# 225. Budget Constraint Test

Assert:

```text
portfolio cost <= budget
```

for every feasible selected portfolio.

---

# 226. Dependency Constraint Test

If:

```text
B requires A
```

then:

```text
B selected -> A selected
```

must always hold.

---

# 227. Conflict Test

If:

```text
A conflicts B
```

then:

```text
A and B
```

must never both be selected.

---

# 228. Mandatory Test

Mandatory option:

```text
x_A = 1
```

must always be present unless the model is infeasible.

---

# 229. Appetite Test

For:

```text
MIN_COST_TO_APPETITE
```

the validated portfolio must satisfy:

```text
risk <= appetite
```

where feasible.

---

# 230. Infeasibility Test

Create a fixture where:

```text
required portfolio cost > budget
```

and assert:

```text
INFEASIBLE
```

with diagnostics.

---

# 231. Time-Limit Test

Configure a very small solver time limit.

Assert:

```text
status != OPTIMAL
```

unless certified.

---

# 232. Portfolio Validation Test

Create:

```text
A + B
```

that has incompatible scenario changes.

Optimizer may find it, but P4 validation must reject it.

The system should return:

```text
portfolio invalid
```

and preserve the reason.

---

# 233. Interaction Test

Verify:

```text
Benefit(A+B)
```

comes from combined scenario output.

Do not use:

```text
Benefit(A)+Benefit(B)
```

as the authoritative final value.

---

# 234. ROSI Test

Given:

```text
AvoidedEAL = 3M
Cost = 2M
```

expect:

```text
ROSI = 50%
```

under the documented v1 convention.

Also test:

```text
Cost = 0 -> N/A
```

---

# 235. Curve Test

For:

```text
budgets 2M,4M,6M
```

ensure:

```text
each point references a valid optimization run
```

and:

```text
same baseline/model/parameter bundle
```

unless explicitly configured otherwise.

---

# 236. Curve Monotonicity

Under an objective of:

```text
maximize EAL reduction
```

with a nested feasible-set budget and no contradictory external constraints, the optimal objective value should be non-decreasing as budget increases.

If numerical/solver behavior produces an apparent violation:

```text
validate
```

rather than silently smoothing the curve.

Do not manually force monotonicity by changing calculated results.

---

# 237. Data Freshness Test

When baseline risk changes:

```text
optimization status -> STALE
```

according to configured materiality rules.

---

# 238. Cost Expiration Test

When:

```text
cost.validTo < now
```

the option should be:

```text
warning or ineligible
```

according to policy.

---

# 239. Tenant Security Test

Organization A:

```text
investment option A
portfolio A
```

Organization B must not retrieve them.

Test:

```text
option
optimization run
portfolio
curve
decision candidate
```

independently.

---

# 240. Audit Test

Every material change must create an audit event:

```text
cost update
option dependency change
optimizer run
portfolio validation
decision candidate
```

---

# 241. Performance Targets

P5 should support:

```text
small optimization:
interactive where feasible

large optimization:
async

curve:
async

sensitivity:
async
```

Exact SLOs should be established after profiling the production deployment.

---

# 242. Solver Resource Controls

Per organization:

```text
max optimization jobs
max options per run
max solver time
max curve points
max concurrent scenario validations
```

---

# 243. Logging

Include:

```text
organizationId
optimizationRunId
portfolioId
solver
solverStatus
modelHash
```

Do not log:

```text
raw financial contracts
PII
sensitive telemetry payloads
```

by default.

---

# 244. Metrics

Recommended:

```text
optimization_run_total
optimization_run_duration
optimization_infeasible_total
optimization_timeout_total
portfolio_validation_total
portfolio_validation_failure_total
investment_option_count
curve_generation_duration
rosi_calculation_total
```

---

# 245. Alerts

Potential operational alerts:

```text
high optimization failure rate
solver timeout spike
portfolio validation failure spike
stale cost coverage spike
missing scenario linkage
```

---

# 246. API Error Codes

Recommended:

```text
OPT-001 INVALID_BUDGET
OPT-002 INVALID_HORIZON
OPT-003 NO_ELIGIBLE_OPTIONS
OPT-004 INFEASIBLE_MODEL
OPT-005 SOLVER_ERROR
OPT-006 TIME_LIMIT
OPT-007 STALE_BASELINE
OPT-008 STALE_COST
OPT-009 PORTFOLIO_VALIDATION_FAILED
OPT-010 CROSS_TENANT_RESOURCE
OPT-011 INVALID_CONSTRAINT
OPT-012 INVALID_OBJECTIVE
```

---

# 247. Open-Source / Free-First Strategy

For the SIH implementation, the recommended baseline remains:

```text
PostgreSQL
Node/TypeScript
existing Express
existing Prisma
OR-Tools / HiGHS or equivalent open-source solver
existing Docker
```

Avoid mandatory paid enterprise optimization infrastructure.

Paid services may later be supported as optional connectors.

---

# 248. Deployment

The optimizer can run:

```text
same backend process
```

for small jobs.

For larger jobs:

```text
queue worker
```

should run:

```text
optimization job
+
P4 validation
```

without blocking API requests.

---

# 249. Containerization

The existing Docker deployment should remain compatible.

If the selected solver adds native libraries:

```text
document image dependency
```

and test:

```text
local
CI
Render/deployment environment
```

before enabling the solver by default.

---

# 250. CI/CD

Pipeline should run:

```text
TypeScript build
Prisma validation
unit tests
optimization fixture tests
integration tests
contract tests
security tests
```

Large Monte Carlo / optimization benchmarks can run separately if needed.

---

# 251. Golden Optimization Fixtures

Minimum fixtures:

```text
Fixture A:
4 options, simple knapsack

Fixture B:
dependencies

Fixture C:
mutual exclusion

Fixture D:
mandatory + optional

Fixture E:
risk appetite

Fixture F:
multi-budget

Fixture G:
combined scenario interaction

Fixture H:
stale cost

Fixture I:
infeasible portfolio

Fixture J:
curve generation
```

---

# 252. Reference Mathematical Model

Simple binary formulation:

```text
maximize Σ b_i x_i

subject to:

Σ c_i x_i <= B

x_i ∈ {0,1}
```

where:

```text
b_i = modeled benefit from P4
c_i = normalized cost
B   = budget
```

For interaction-aware portfolios:

```text
B(P)
```

must be validated from a combined P4 scenario rather than assuming:

```text
B(P) = Σ b_i
```

---

# 253. Appetite Formulation

```text
minimize Σ c_i x_i

subject to:

Risk(P) <= Appetite
```

where:

```text
Risk(P)
```

comes from validated portfolio scenario recalculation.

---

# 254. Multi-Objective Formulation

Possible weighted objective:

```text
maximize:
w1 * normalized_EAL_reduction
+
w2 * normalized_VaR_reduction
-
w3 * normalized_cost
```

Weights must be explicit and user/organization configurable.

The default implementation should avoid arbitrary weights unless the user has selected them.

---

# 255. Objective Normalization

If combining different metrics:

```text
normalize each metric
```

using documented bounds/scales.

Do not combine:

```text
₹
0-100 score
days
```

without normalization.

---

# 256. Constraint Priority

A clear hierarchy may be:

```text
Hard constraints
    |
    v
Feasibility
    |
    v
Objective
    |
    v
Presentation / tie-breaker
```

Tie-breakers must not violate hard constraints.

---

# 257. Tie-Breaking

If multiple portfolios have the same objective value within tolerance:

```text
present alternatives
```

or apply an explicitly configured tie-breaker such as:

```text
lower cost
```

The tie-breaker should be visible in the optimization metadata.

---

# 258. No Universal “Best”

The system must allow:

```text
different objectives
different budgets
different risk appetites
different capacities
```

to produce different valid portfolios.

The product should explain these trade-offs rather than treat one solution as universally optimal for every organization.

---

# 259. Portfolio Alternatives

For a budget:

```text
₹10M
```

return:

```text
Primary objective solution
+
near-equivalent alternatives
```

when available.

Example:

```text
Portfolio A:
₹9.8M, avoided EAL ₹4.2M

Portfolio B:
₹9.1M, avoided EAL ₹4.0M

Portfolio C:
₹8.4M, avoided EAL ₹3.9M
```

All values illustrative.

---

# 260. Alternative Selection Interface

Allow users to change:

```text
objective
budget
horizon
risk appetite
capacity
mandatory options
```

and recalculate.

---

# 261. Decision Support, Not Decision Replacement

P5 provides:

```text
quantified alternatives
constraints
trade-offs
```

The organization retains authority over:

```text
risk acceptance
budget allocation
implementation timing
investment approval
```

---

# 262. P5 Acceptance Matrix

| Area | Acceptance |
|---|---|
| Investment option | Versioned and scoped |
| Cost | Explicit basis, currency, horizon |
| Benefit | Scenario-derived |
| Optimization | Declared mathematical objective |
| Budget | Hard constraint enforced |
| Dependencies | Explicit constraints |
| Conflicts | Explicit constraints |
| Mandatory | Supported |
| Appetite | Supported |
| Solver | Exact/declared status |
| Optimality | Gap/status visible |
| Portfolio validation | P4 combined scenario |
| Interactions | Not blindly additive |
| ROSI | Versioned formula |
| Curve | Same baseline/version context |
| Alternatives | Comparable outputs |
| Governance | Human approval separate |
| Evidence | Risk/Scenario/Cost traceability |
| Security | Tenant isolation |
| Audit | Material events logged |

---

# 263. P5 Definition of Done

P5 is accepted only when:

```text
1. Investment options are first-class versioned entities.
2. Costs have explicit financial semantics and validity.
3. Benefits originate from P4 scenario outcomes.
4. The optimizer supports explicit objectives and constraints.
5. Exact/declared solver status is stored.
6. Budget-constrained selection works.
7. Dependencies and conflicts work.
8. Risk-appetite-constrained optimization works.
9. Portfolio results are validated through combined P4 scenarios.
10. Interactions are not incorrectly treated as additive.
11. ROSI and cost-benefit metrics are versioned and transparent.
12. Investment-vs-risk-reduction curves can be generated.
13. Portfolio alternatives can be compared.
14. Staleness is detected.
15. Human approvals are separate from optimizer output.
16. Evidence and risk-driver lineage remain available.
17. Historical optimization inputs are reproducible.
18. Tenant, audit and resource controls pass.
19. Legacy greedy optimization is no longer authoritative.
20. The output is ready to feed executive, AI and governance layers.
```

---

# Appendix A — End-to-End PS 26105 Investment Flow

```text
Security telemetry
       |
       v
Digital Twin
       |
       v
P2 Risk Engine
       |
       v
EAL / VaR / Risk Score
       |
       v
P3 Risk Drivers
       |
       v
Treatment options
       |
       v
P4 Scenario Engine
       |
       v
Quantified scenario outcome
       |
       v
P5 Investment Option
       |
       v
Optimization
       |
       v
Portfolio
       |
       v
Combined P4 Validation
       |
       v
Validated risk reduction
       |
       v
Executive decision
       |
       v
Investment decision record
```

---

# Appendix B — Example Budget Analysis

```text
Budget: ₹5M
Objective: maximize EAL reduction

Selected:
MFA

Cost:
₹4.5M

Validated avoided EAL:
₹2.7M

Residual EAL:
₹9.7M
```

```text
Budget: ₹10M

Selected:
MFA
EDR

Combined scenario validated.

Cost:
₹9.6M

Validated avoided EAL:
₹4.0M

Residual EAL:
₹8.4M
```

```text
Budget: ₹15M

Selected:
MFA
EDR
Segmentation

Combined scenario validated.

Cost:
₹14.2M

Validated avoided EAL:
₹4.8M

Residual EAL:
₹7.6M
```

All values are illustrative.

---

# Appendix C — Example ROSI

```text
Avoided EAL = ₹4M
Normalized cost = ₹2.5M

Net modeled benefit = ₹1.5M

ROSI =
((₹4M - ₹2.5M) / ₹2.5M) * 100
= 60%
```

The result is a modeled decision metric under the declared assumptions and ROSI convention.

---

# Appendix D — Example Appetite Optimization

```text
Current EAL:
₹12M

Risk appetite:
₹8M

Required reduction:
₹4M
```

Optimizer:

```text
Objective:
minimize cost

Constraint:
portfolio EAL <= ₹8M
```

Candidate:

```text
MFA + segmentation
```

P4 combined scenario:

```text
Scenario EAL:
₹7.8M
```

Therefore:

```text
portfolio satisfies the modeled appetite threshold
```

The organization still decides whether to approve the investment.

---

# Appendix E — Example Constraint Explanation

```text
Budget:
₹10M

Mandatory:
MFA = ₹4.5M

Dependency:
EDR requires endpoint inventory = ₹1.5M

Conflict:
Vendor A and Vendor B cannot both be selected

Remaining budget:
₹4M

Optimizer result:
MFA + endpoint inventory + EDR

Excluded:
Vendor B

Reason:
mutual exclusion with selected Vendor A
```

Illustrative only.

---

# Appendix F — Example Risk-Reduction Curve

```text
Investment
Cost        Avoided EAL

₹2M         ₹1.1M
₹4M         ₹2.2M
₹6M         ₹3.0M
₹8M         ₹3.6M
₹10M        ₹4.1M
₹12M        ₹4.4M
```

The curve is generated from evaluated portfolios/scenarios.

It should not be manually smoothed or fabricated.

---

# Appendix G — Example Executive Narrative Input

Structured result:

```json
{
  "objective": "MAX_EAL_REDUCTION",
  "budget": 10000000,
  "currency": "INR",
  "horizonMonths": 12,
  "solverStatus": "OPTIMAL",
  "portfolioCost": 9600000,
  "baselineEal": 12400000,
  "residualEal": 8200000,
  "avoidedEal": 4200000,
  "optimalityGap": 0,
  "warnings": [
    "One cost estimate expires in 30 days"
  ]
}
```

The LLM may explain this in executive language, but these values remain backend-authoritative.

---

# Appendix H — Recommended Implementation Sequence

```text
P2 Risk Engine
      |
      v
P3 Drivers
      |
      v
P4 Scenario Engine
      |
      v
P5.1 Investment Data Model
      |
      v
P5.2 Cost Normalization
      |
      v
P5.3 Investment Option Service
      |
      v
P5.4 Benefit / ROSI
      |
      v
P5.5 Optimization Model
      |
      v
P5.6 Solver Adapter
      |
      v
P5.7 Portfolio Persistence
      |
      v
P5.8 P4 Portfolio Validation
      |
      v
P5.9 Curves / Sensitivity
      |
      v
P5.10 API
      |
      v
P5.11 Frontend
      |
      v
P5.12 AI Explanation
      |
      v
P5.13 Governance / Decision Handoff
```

---

# Appendix I — Engineering Guardrails

```text
DO:
- use P4 scenario outputs for quantified benefit
- normalize costs explicitly
- expose budget/objective/constraints
- use a declared solver
- persist solver status and optimality gap
- validate final portfolios through P4
- preserve interactions
- keep ROSI transparent
- expose alternatives
- preserve evidence and assumptions
- detect stale analysis
- keep human approval separate

DO NOT:
- use hardcoded percentage risk reduction as authoritative
- sum isolated benefits for an interacting portfolio
- call a time-limited feasible solution "optimal"
- hide constraints
- treat ROSI as guaranteed return
- claim scenario assumptions are deployed controls
- let the LLM choose authoritative financial numbers
- overwrite historical cost/model inputs
- store sensitive enterprise financial/telemetry data on blockchain
```

---

# Status

**P5 Investment Optimization, Cost-Benefit, ROSI & Investment-vs-Risk-Reduction Implementation Specification:** READY

P5 completes the core quantitative decision chain:

```text
Risk
  ->
Driver
  ->
Scenario
  ->
Investment
  ->
Optimization
  ->
Validated Portfolio
  ->
Decision Support
```

The next dependent implementation phase is:

```text
P6 — Predictive ML Pipeline, Calibration, Drift, Model Registry & Continuous Risk Forecasting
```

P6 will provide production-grade probabilistic inputs to P2, especially exploitation likelihood / threat-driven predictive signals, while preserving the deterministic financial-risk authority boundary.
