/**
 * apply-neon-migration.cjs
 *
 * Uses the Prisma client (already installed) to apply the P1 migration SQL
 * directly to the Neon production database.
 *
 * Run with:
 *   $env:DIRECT_URL="<neon-direct-url>"; $env:DATABASE_URL="<neon-pooler-url>"; node scripts/apply-neon-migration.cjs
 *
 * Or simply run: node scripts/apply-neon-migration.cjs
 * (will auto-load from .env.host)
 */

const fs = require('fs');
const path = require('path');

// ── Load .env.host manually ─────────────────────────────────────────────────
const envHostPath = path.join(__dirname, '..', '.env.host');
const envHostContent = fs.readFileSync(envHostPath, 'utf8');
for (const line of envHostContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  // Strip channel_binding — not supported by Prisma's underlying driver
  val = val.replace(/[?&]channel_binding=require/g, '');
  if (!process.env[key]) process.env[key] = val; // don't override if already set
}

const { PrismaClient } = require('@prisma/client');

const MIGRATION_NAME = '20260930000001_ps26105_risk_lineage_foundation';
const migrationSqlPath = path.join(
  __dirname, '..', 'prisma', 'migrations', MIGRATION_NAME, 'migration.sql'
);

const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

// Prisma needs DIRECT_URL for migrations (non-pooled)
// It reads from process.env automatically
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL },
  },
  log: ['error'],
});

async function run() {
  console.log(`\n🔌  Connecting: ${(process.env.DIRECT_URL || '').replace(/:[^:@]+@/, ':****@')}\n`);

  try {
    await prisma.$connect();
    console.log('✅  Connected to Neon database\n');

    // Check if already applied
    const existing = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'RiskRun'
      LIMIT 1;
    `);

    if (existing.length > 0) {
      console.log('ℹ️   "RiskRun" table already exists.');

      const otherTables = await prisma.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('RiskAssessment', 'RiskAuditEvent');
      `);
      console.log('     All PS 26105 P1 tables present:', ['RiskRun', ...otherTables.map(r => r.table_name)].join(', '));
      console.log('\n✅  Migration already applied — Neon DB is up to date.\n');
      return;
    }

    // Apply each statement individually (Prisma $executeRawUnsafe doesn't support multi-statement)
    console.log(`📦  Applying migration: ${MIGRATION_NAME}\n`);

    // Split on semicolons that end a statement, preserving content
    const statements = migrationSql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      console.log(`   ▸ ${stmt.slice(0, 80).replace(/\n/g, ' ')}...`);
      await prisma.$executeRawUnsafe(stmt + ';');
    }

    // Record in _prisma_migrations so `prisma migrate status` stays consistent
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (
        "id", "checksum", "finished_at", "migration_name",
        "logs", "rolled_back_at", "started_at", "applied_steps_count"
      ) VALUES (
        gen_random_uuid(),
        '0000000000000000000000000000000000000000000000000000000000000000',
        NOW(),
        '${MIGRATION_NAME}',
        NULL, NULL, NOW(), 1
      )
      ON CONFLICT ("migration_name") DO NOTHING;
    `);

    console.log('\n✅  Migration applied successfully!\n');
    console.log('  Tables created:');
    console.log('    • enum  RiskRunStatus');
    console.log('    • table RiskRun');
    console.log('    • table RiskAssessment');
    console.log('    • table RiskAuditEvent\n');

  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    if (err.meta) console.error('   Meta:', err.meta);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
