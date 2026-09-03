/*
  Seed a realistic enterprise digital twin for SentinelStack 26105.

  Usage:
    node scripts/seed-cyber-risk-digital-twin.js --org-name "ACME Bank"

  Optional:
    --org-id <existing organization id>
    --reset-risk-data
*/

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { orgName: 'ACME Bank', orgId: null, reset: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--org-name') out.orgName = args[++i] || out.orgName;
    else if (arg === '--org-id') out.orgId = args[++i] || null;
    else if (arg === '--reset-risk-data') out.reset = true;
  }

  return out;
}

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const crore = (n) => BigInt(Math.round(n * 10_000_000));
const lakh = (n) => BigInt(Math.round(n * 100_000));

async function getOrganization({ orgId, orgName }) {
  if (orgId) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new Error(`Organization not found: ${orgId}`);
    return org;
  }

  const existing = await prisma.organization.findFirst({
    where: { name: orgName },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) return existing;

  return prisma.organization.create({
    data: { name: orgName },
  });
}

async function resetRiskData(organizationId) {
  await prisma.riskScenario.deleteMany({ where: { organizationId } });
  await prisma.riskSnapshot.deleteMany({ where: { organizationId } });
  await prisma.threatIntelIndicator.deleteMany({ where: { organizationId } });
  await prisma.securityTelemetry.deleteMany({ where: { organizationId } });
  await prisma.cyberVulnerability.deleteMany({ where: { organizationId } });
  await prisma.assetControl.deleteMany({ where: { organizationId } });
  await prisma.assetDependency.deleteMany({ where: { organizationId } });
  await prisma.securityControl.deleteMany({ where: { organizationId } });
  await prisma.cyberAsset.deleteMany({ where: { organizationId } });
  await prisma.businessUnit.deleteMany({ where: { organizationId } });
}

async function seedBusinessUnits(organizationId) {
  const units = [
    ['Digital Banking', 'Ananya Rao', 620, 'CRITICAL'],
    ['Payments', 'Kabir Mehta', 410, 'CRITICAL'],
    ['Treasury', 'Meera Iyer', 240, 'HIGH'],
    ['Corporate IT', 'Dev Malhotra', 90, 'HIGH'],
    ['Cloud Platform', 'Sara Thomas', 180, 'HIGH'],
  ];

  const out = {};
  for (const [name, owner, revenueCr, criticality] of units) {
    out[name] = await prisma.businessUnit.upsert({
      where: { organizationId_name: { organizationId, name } },
      update: { owner, annualRevenueInr: crore(revenueCr), criticality },
      create: { organizationId, name, owner, annualRevenueInr: crore(revenueCr), criticality },
    });
  }
  return out;
}

async function seedControls(organizationId) {
  const controls = [
    {
      controlId: 'CTRL-IAM-MFA',
      name: 'Privileged Access MFA',
      category: 'IAM',
      baseCostInr: lakh(42),
      iso27001: ['A.5.16', 'A.8.5'],
      nistCsf: ['PR.AA-03', 'PR.AA-05'],
      cisControls: ['CIS 6.3', 'CIS 6.4'],
      rbiFramework: ['Identity and Access Management'],
      sebiFramework: ['Access Control and Authentication'],
    },
    {
      controlId: 'CTRL-ENDPOINT-EDR',
      name: 'Endpoint Detection and Response',
      category: 'ENDPOINT',
      baseCostInr: lakh(68),
      iso27001: ['A.8.7', 'A.8.16'],
      nistCsf: ['DE.CM-01', 'DE.CM-09'],
      cisControls: ['CIS 10.1'],
      rbiFramework: ['Cyber Security Operations Centre'],
      sebiFramework: ['Endpoint Security Monitoring'],
    },
    {
      controlId: 'CTRL-NET-SEG',
      name: 'Network Segmentation',
      category: 'NETWORK',
      baseCostInr: crore(1.2),
      iso27001: ['A.8.20', 'A.8.22'],
      nistCsf: ['PR.IR-01', 'PR.PS-01'],
      cisControls: ['CIS 12.2'],
      rbiFramework: ['Network Security and Segmentation'],
      sebiFramework: ['Secure Network Architecture'],
    },
    {
      controlId: 'CTRL-CLOUD-CSPM',
      name: 'Cloud Misconfiguration Management',
      category: 'CLOUD',
      baseCostInr: lakh(55),
      iso27001: ['A.8.9', 'A.8.15'],
      nistCsf: ['PR.PS-06', 'DE.CM-09'],
      cisControls: ['CIS 4.1'],
      rbiFramework: ['Cloud Security Governance'],
      sebiFramework: ['Cloud and Outsourcing Resilience'],
    },
    {
      controlId: 'CTRL-REC-BACKUP',
      name: 'Immutable Backup and Recovery',
      category: 'RECOVERY',
      baseCostInr: lakh(80),
      iso27001: ['A.5.30', 'A.8.13'],
      nistCsf: ['RC.RP-01', 'RC.CO-03'],
      cisControls: ['CIS 11.4'],
      rbiFramework: ['Cyber Resilience and Recovery'],
      sebiFramework: ['Business Continuity and Disaster Recovery'],
    },
  ];

  const out = {};
  for (const control of controls) {
    out[control.controlId] = await prisma.securityControl.upsert({
      where: { organizationId_controlId: { organizationId, controlId: control.controlId } },
      update: control,
      create: { organizationId, ...control },
    });
  }
  return out;
}

async function seedAssets(organizationId, businessUnits) {
  const assets = [
    ['ACME-INET-001', 'pay-api-01.acmebank.internal', '10.20.1.12', 'Payment API', 'Payments', 'INTERNET', 'CRITICAL', true, 25, 12, 150, 50, 30, 70],
    ['ACME-INET-002', 'ibanking-web-01.acmebank.internal', '10.20.1.18', 'Internet Banking Web', 'Digital Banking', 'INTERNET', 'CRITICAL', true, 18, 8, 120, 45, 40, 80],
    ['ACME-CLOUD-001', 'cust-data-lake-prod', '10.40.5.8', 'Customer Data Lake', 'Cloud Platform', 'CLOUD', 'CRITICAL', false, 8, 24, 220, 60, 80, 90],
    ['ACME-IAM-001', 'privileged-idp-01', '10.10.2.5', 'Privileged IAM', 'Corporate IT', 'CORPORATE', 'CRITICAL', false, 5, 8, 90, 35, 40, 55],
    ['ACME-TREAS-001', 'treasury-settlement-01', '10.30.7.9', 'Treasury Settlement', 'Treasury', 'CORPORATE', 'HIGH', false, 14, 10, 110, 45, 25, 45],
    ['ACME-CLOUD-002', 'card-token-vault', '10.40.9.14', 'Card Token Vault', 'Payments', 'CLOUD', 'CRITICAL', false, 20, 12, 240, 65, 90, 95],
    ['ACME-CORP-001', 'employee-vpn-gw-01', '10.15.2.20', 'Employee VPN', 'Corporate IT', 'INTERNET', 'HIGH', true, 4, 8, 55, 25, 15, 30],
    ['ACME-CLOUD-003', 'mobile-api-gateway', '10.40.2.44', 'Mobile API Gateway', 'Digital Banking', 'INTERNET', 'CRITICAL', true, 16, 8, 130, 35, 35, 70],
  ];

  const out = {};
  for (const [
    assetId,
    hostname,
    ipAddress,
    serviceName,
    unitName,
    environment,
    criticality,
    internetExposed,
    downtimeLakhPerHour,
    maxTolerableDowntimeHours,
    breachLakh,
    recoveryLakh,
    regulatoryLakh,
    reputationLakh,
  ] of assets) {
    out[assetId] = await prisma.cyberAsset.upsert({
      where: { organizationId_assetId: { organizationId, assetId } },
      update: {
        hostname,
        ipAddress,
        serviceName,
        environment,
        criticality,
        internetExposed,
        businessUnitId: businessUnits[unitName].id,
        downtimeCostPerHourInr: lakh(downtimeLakhPerHour),
        maxTolerableDowntimeHours,
        breachCostInr: lakh(breachLakh),
        recoveryCostInr: lakh(recoveryLakh),
        regulatoryExposureInr: lakh(regulatoryLakh),
        reputationCostInr: lakh(reputationLakh),
      },
      create: {
        organizationId,
        assetId,
        hostname,
        ipAddress,
        serviceName,
        environment,
        criticality,
        internetExposed,
        businessUnitId: businessUnits[unitName].id,
        owner: businessUnits[unitName].owner,
        revenueDependencyInr: businessUnits[unitName].annualRevenueInr,
        downtimeCostPerHourInr: lakh(downtimeLakhPerHour),
        maxTolerableDowntimeHours,
        dataSensitivity: criticality === 'CRITICAL' ? 5 : 4,
        breachCostInr: lakh(breachLakh),
        recoveryCostInr: lakh(recoveryLakh),
        regulatoryExposureInr: lakh(regulatoryLakh),
        reputationCostInr: lakh(reputationLakh),
      },
    });
  }
  return out;
}

async function seedAssetControls(organizationId, assets, controls) {
  const coverage = {
    'ACME-INET-001': [62, 91, 54, 80, 72],
    'ACME-INET-002': [68, 86, 58, 76, 70],
    'ACME-CLOUD-001': [76, 82, 70, 61, 88],
    'ACME-IAM-001': [41, 74, 64, 66, 78],
    'ACME-TREAS-001': [83, 88, 78, 70, 84],
    'ACME-CLOUD-002': [71, 93, 72, 69, 91],
    'ACME-CORP-001': [59, 80, 50, 64, 76],
    'ACME-CLOUD-003': [66, 88, 57, 73, 74],
  };

  const controlIds = ['CTRL-IAM-MFA', 'CTRL-ENDPOINT-EDR', 'CTRL-NET-SEG', 'CTRL-CLOUD-CSPM', 'CTRL-REC-BACKUP'];
  for (const [assetId, scores] of Object.entries(coverage)) {
    for (let i = 0; i < controlIds.length; i++) {
      const controlId = controlIds[i];
      await prisma.assetControl.upsert({
        where: { assetId_controlId: { assetId: assets[assetId].id, controlId: controls[controlId].id } },
        update: {
          coveragePercent: scores[i],
          effectivenessPercent: Math.max(35, scores[i] - 7),
          status: scores[i] >= 85 ? 'EFFECTIVE' : scores[i] >= 65 ? 'PARTIAL' : 'WEAK',
          lastObservedAt: daysAgo(1 + i),
        },
        create: {
          organizationId,
          assetId: assets[assetId].id,
          controlId: controls[controlId].id,
          coveragePercent: scores[i],
          effectivenessPercent: Math.max(35, scores[i] - 7),
          status: scores[i] >= 85 ? 'EFFECTIVE' : scores[i] >= 65 ? 'PARTIAL' : 'WEAK',
          lastObservedAt: daysAgo(1 + i),
        },
      });
    }
  }
}

async function seedVulnerabilities(organizationId, assets) {
  const vulns = [
    ['ACME-INET-001', 'CVE-2025-24813', 'Deserialization flaw in payment API gateway', 9.8, 0.83, true, true, 42, ['CTRL-NET-SEG', 'CTRL-ENDPOINT-EDR']],
    ['ACME-INET-001', 'CVE-2024-6387', 'Remote code execution exposure on edge service', 8.1, 0.64, true, true, 21, ['CTRL-ENDPOINT-EDR']],
    ['ACME-INET-002', 'CVE-2025-29927', 'Auth bypass path handling weakness', 9.1, 0.71, true, true, 18, ['CTRL-IAM-MFA', 'CTRL-NET-SEG']],
    ['ACME-CLOUD-001', null, 'Public read path on analytics object store', 7.5, 0.24, false, false, 63, ['CTRL-CLOUD-CSPM']],
    ['ACME-IAM-001', null, 'Privileged accounts without phishing-resistant MFA', 8.8, 0.55, true, false, 88, ['CTRL-IAM-MFA']],
    ['ACME-TREAS-001', 'CVE-2024-3094', 'Compromised dependency exposure in settlement host', 8.6, 0.33, true, true, 31, ['CTRL-ENDPOINT-EDR']],
    ['ACME-CLOUD-002', null, 'Token vault excessive service account permissions', 8.4, 0.48, true, false, 27, ['CTRL-CLOUD-CSPM', 'CTRL-IAM-MFA']],
    ['ACME-CORP-001', 'CVE-2023-46805', 'VPN appliance command injection exposure', 9.8, 0.91, true, true, 55, ['CTRL-NET-SEG']],
    ['ACME-CLOUD-003', 'CVE-2025-1974', 'Ingress controller validation bypass', 9.8, 0.76, true, true, 14, ['CTRL-CLOUD-CSPM', 'CTRL-NET-SEG']],
  ];

  for (const [assetKey, cve, title, cvss, epss, exploitAvailable, patchAvailable, ageDays, mappedControls] of vulns) {
    await prisma.cyberVulnerability.create({
      data: {
        organizationId,
        assetId: assets[assetKey].id,
        cve,
        title,
        cvss,
        epss,
        exploitAvailable,
        patchAvailable,
        firstSeenAt: daysAgo(ageDays),
        lastSeenAt: daysAgo(1),
        mappedControls,
      },
    });
  }
}

async function seedTelemetryAndThreatIntel(organizationId, assets) {
  const telemetry = [
    ['ACME-IAM-001', 'IAM', 'abnormal_privileged_login_location', 'HIGH', 1.6],
    ['ACME-CORP-001', 'SIEM', 'vpn_password_spray', 'HIGH', 1.4],
    ['ACME-INET-001', 'EDR', 'suspicious_child_process', 'MEDIUM', 1.2],
    ['ACME-CLOUD-001', 'CSPM', 'object_store_public_acl', 'HIGH', 1.5],
    ['ACME-CLOUD-003', 'CSPM', 'internet_exposed_admin_endpoint', 'CRITICAL', 1.7],
    ['ACME-CLOUD-002', 'IAM', 'service_account_excessive_privilege', 'HIGH', 1.3],
  ];

  for (const [assetKey, source, eventType, severity, signalScore] of telemetry) {
    await prisma.securityTelemetry.create({
      data: {
        organizationId,
        assetId: assets[assetKey].id,
        source,
        eventType,
        severity,
        signalScore,
        observedAt: daysAgo(Math.floor(Math.random() * 7)),
        metadata: {
          generatedBy: 'sentinelstack-digital-twin',
          modelUse: 'likelihood-adjustment',
        },
      },
    });
  }

  const intel = [
    ['CVE', 'CVE-2023-46805', 'CVE-2023-46805', 'Volt Typhoon', 'VPN appliance exploitation', 'Financial Services', 'T1190', 82],
    ['CVE', 'CVE-2025-24813', 'CVE-2025-24813', 'FIN7', 'Payment API targeting', 'Banking', 'T1190', 76],
    ['CVE', 'CVE-2025-1974', 'CVE-2025-1974', 'Cloud Atlas', 'Ingress controller exploitation', 'Financial Services', 'T1611', 71],
  ];

  for (const [indicatorType, indicatorValue, cve, threatActor, campaign, sector, ttp, confidence] of intel) {
    await prisma.threatIntelIndicator.create({
      data: {
        organizationId,
        indicatorType,
        indicatorValue,
        cve,
        threatActor,
        campaign,
        sector,
        ttp,
        confidence,
        observedAt: daysAgo(2),
      },
    });
  }
}

async function seedDependencies(organizationId, assets) {
  const deps = [
    ['ACME-INET-001', 'ACME-CLOUD-002', 'tokenization', 'CRITICAL'],
    ['ACME-INET-002', 'ACME-IAM-001', 'authentication', 'CRITICAL'],
    ['ACME-CLOUD-003', 'ACME-IAM-001', 'authentication', 'HIGH'],
    ['ACME-TREAS-001', 'ACME-CLOUD-001', 'reporting-data', 'HIGH'],
    ['ACME-INET-001', 'ACME-CLOUD-001', 'fraud-analytics', 'HIGH'],
  ];

  for (const [source, target, dependencyType, criticality] of deps) {
    await prisma.assetDependency.upsert({
      where: {
        sourceAssetId_targetAssetId_dependencyType: {
          sourceAssetId: assets[source].id,
          targetAssetId: assets[target].id,
          dependencyType,
        },
      },
      update: { criticality },
      create: {
        organizationId,
        sourceAssetId: assets[source].id,
        targetAssetId: assets[target].id,
        dependencyType,
        criticality,
      },
    });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const organization = await getOrganization(args);
  if (args.reset) {
    await resetRiskData(organization.id);
  }

  const businessUnits = await seedBusinessUnits(organization.id);
  const controls = await seedControls(organization.id);
  const assets = await seedAssets(organization.id, businessUnits);
  await seedAssetControls(organization.id, assets, controls);
  await seedVulnerabilities(organization.id, assets);
  await seedTelemetryAndThreatIntel(organization.id, assets);
  await seedDependencies(organization.id, assets);

  console.log('\nSeeded SentinelStack 26105 digital twin');
  console.log(`- Organization: ${organization.name} (${organization.id})`);
  console.log(`- Business units: ${Object.keys(businessUnits).length}`);
  console.log(`- Assets: ${Object.keys(assets).length}`);
  console.log(`- Controls: ${Object.keys(controls).length}`);
  console.log('\nRun the API and call GET /api/cyber-risk/enterprise?budgetInr=10000000');
}

main()
  .catch((error) => {
    console.error('\nFatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
