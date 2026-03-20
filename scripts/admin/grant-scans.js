/*
  Admin utility: grant additional scan capacity to a specific user (by email)
  by adjusting the organization scan usage counter.

  Why this works:
  - Scan allowance is enforced via Organization.scansUsedThisMonth vs tier limit.
  - Decreasing scansUsedThisMonth gives the org more remaining scans this month.

  Usage:
    node scripts/admin/grant-scans.js --email user@example.com --count 10

  Optional:
    --set-tier PRO|ENTERPRISE|FREE
    --set-status ACTIVE|TRIALING|PAST_DUE|CANCELED|FREE
    --dry-run

  Notes:
  - Requires DATABASE_URL to be set (Prisma).
  - By default, this will NOT make scansUsedThisMonth negative (clamped at 0).
*/

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { email: null, count: null, setTier: null, setStatus: null, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--email') out.email = args[++i] || null;
    else if (a === '--count') out.count = args[++i] || null;
    else if (a === '--set-tier') out.setTier = args[++i] || null;
    else if (a === '--set-status') out.setStatus = args[++i] || null;
    else if (a === '--dry-run') out.dryRun = true;
  }

  return out;
}

function fail(msg) {
  console.error(`\nError: ${msg}\n`);
  process.exit(2);
}

async function main() {
  const { email, count, setTier, setStatus, dryRun } = parseArgs(process.argv);

  if (!email) fail('Missing --email');
  if (count == null) fail('Missing --count');

  const normalizedEmail = String(email).trim().toLowerCase();
  const grantCount = Number.parseInt(String(count), 10);
  if (!Number.isFinite(grantCount) || grantCount < 0) {
    fail('--count must be a non-negative integer');
  }

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set (required to connect to Postgres)');
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        activeOrganizationId: true,
        memberships: {
          select: { organizationId: true, role: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      fail(`User not found for email: ${normalizedEmail}`);
    }

    // Prefer active org context; otherwise prefer OWNER membership; else first membership.
    let organizationId = user.activeOrganizationId;
    if (!organizationId && user.memberships?.length) {
      const owner = user.memberships.find((m) => m.role === 'OWNER');
      organizationId = (owner || user.memberships[0]).organizationId;
    }

    if (!organizationId) {
      fail(`No organization found for user: ${normalizedEmail}`);
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        scansUsedThisMonth: true,
        scansResetAt: true,
      },
    });

    if (!org) {
      fail(`Organization not found: ${organizationId}`);
    }

    const nextUsed = Math.max(0, org.scansUsedThisMonth - grantCount);

    const data = {
      scansUsedThisMonth: nextUsed,
      ...(setTier ? { subscriptionTier: setTier } : null),
      ...(setStatus ? { subscriptionStatus: setStatus } : null),
    };

    console.log('\nGrant scans preview:');
    console.log(`- User: ${user.email} (${user.id})`);
    console.log(`- Org:  ${org.name} (${org.id})`);
    console.log(`- Tier/Status: ${org.subscriptionTier}/${org.subscriptionStatus}`);
    console.log(`- Used this month: ${org.scansUsedThisMonth} -> ${nextUsed} (grant=${grantCount})`);
    if (setTier) console.log(`- Set tier: ${setTier}`);
    if (setStatus) console.log(`- Set status: ${setStatus}`);
    console.log(`- Dry run: ${dryRun ? 'yes' : 'no'}`);

    if (dryRun) {
      console.log('\nNo changes applied (dry-run).\n');
      return;
    }

    await prisma.organization.update({
      where: { id: org.id },
      data,
    });

    console.log('\n✅ Scan capacity updated successfully.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nFatal:', err);
  process.exit(1);
});
