# SentinelStack 26105 Foundation

This slice starts the pivot from scanner-centric SaaS to **Continuous Cyber Risk Intelligence & Security Investment Optimization**.

## What Changed

- Added enterprise digital-twin data models:
  - business units
  - cyber assets
  - asset dependencies
  - security controls
  - asset-control effectiveness
  - vulnerabilities
  - SIEM/IAM/EDR/CSPM-style telemetry
  - threat-intelligence indicators
  - risk snapshots
  - modeled risk scenarios
- Added a deterministic financial cyber risk service:
  - financial exposure
  - annual incident likelihood
  - Expected Annual Loss
  - Value at Risk estimate
  - top financial risk drivers
  - scenario outcomes
  - budget-constrained recommendation selection
- Added API routes under `/api/cyber-risk`.
- Added a repeatable ACME Bank digital twin seed script.

## Design Principle

The LLM should not invent the cyber-risk number.

The deterministic/statistical layer calculates:

- likelihood
- business impact
- control effectiveness
- EAL
- VaR
- scenario outcomes
- budget allocation

The LLM layer can later explain, summarize, and answer natural-language questions over these outputs.

## Seed Demo Data

```bash
npm run prisma:deploy:host
npm run seed:cyber-risk
```

The seed creates a realistic ACME Bank digital twin with banking business units, internet-facing services, IAM/EDR/CSPM signals, exploitable CVEs, mapped controls, and threat intelligence.

## API

```http
GET /api/cyber-risk/enterprise?budgetInr=10000000
Authorization: Bearer <firebase token>
```

Returns:

- enterprise totals
- top risk drivers
- remediation recommendations
- optimized allocation for the supplied budget
- modeled scenarios
- assumptions/provenance

```http
POST /api/cyber-risk/snapshots
Authorization: Bearer <firebase token>
Content-Type: application/json

{ "budgetInr": 10000000 }
```

Persists the current calculation for trend/reporting use.

## Next Slice

Build the first executive risk dashboard from this API:

- Financial Cyber Exposure
- Expected Annual Loss
- Value at Risk
- Top Risk Drivers
- Budget Allocation
- Scenario Simulator
