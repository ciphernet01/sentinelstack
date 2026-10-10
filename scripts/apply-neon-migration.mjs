/**
 * apply-neon-migration.mjs
 * 
 * Connects directly to the Neon production database and applies the
 * PS 26105 P1 migration SQL file.
 *
 * Usage:
 *   node scripts/apply-neon-migration.mjs
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
// Load Neon connection details from .env.host
// ------------------------------------------------------------------
const envHostPath = join(__dirname, '..', '.env.host');
const envHostContent = readFileSync(envHostPath, 'utf8');

const envVars = {};
for (const line of envHostContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  if (key) envVars[key.trim()] = rest.join('=').trim();
}

// Use DIRECT_URL (non-pooled) for migrations
let directUrl = envVars['DIRECT_URL'] || '';
// Strip channel_binding if present (not supported by pg driver)
directUrl = directUrl.replace(/&?channel_binding=require/g, '');

if (!directUrl) {
  console.error('❌  DIRECT_URL not found in .env.host');
  process.exit(1);
}

console.log(`\n🔌  Connecting to: ${directUrl.replace(/:[^:@]+@/, ':****@')}\n`);

// ------------------------------------------------------------------
// Connect using the pg package (already in node_modules)
// ------------------------------------------------------------------
const require = createRequire(import.meta.url);
const { Client } = require('pg');

const migrationSqlPath = join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260930000001_ps26105_risk_lineage_foundation',
  'migration.sql'
);

const migrationSql = readFileSync(migrationSqlPath, 'utf8');

const client = new Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    await client.connect();
    console.log('✅  Connected to Neon DB\n');

    // Check if migration is already applied
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'RiskRun'
      LIMIT 1;
    `);

    if (tableCheck.rows.length > 0) {
      console.log('ℹ️   Table "RiskRun" already exists — migration may already be applied.');
      console.log('     Checking for "RiskAssessment" and "RiskAuditEvent" as well...');
      
      const assessmentCheck = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('RiskAssessment', 'RiskAuditEvent');
      `);
      console.log('     Existing tables found:', assessmentCheck.rows.map(r => r.table_name));
      console.log('\n✅  Migration already applied. Nothing to do.');
      await client.end();
      return;
    }

    // Apply migration
    console.log('📦  Applying migration: 20260930000001_ps26105_risk_lineage_foundation\n');
    await client.query('BEGIN');
    await client.query(migrationSql);
    
    // Record migration in _prisma_migrations table so prisma migrate status is consistent
    await client.query(`
      INSERT INTO "_prisma_migrations" (
        "id", "checksum", "finished_at", "migration_name",
        "logs", "rolled_back_at", "started_at", "applied_steps_count"
      ) VALUES (
        gen_random_uuid(),
        '0000000000000000000000000000000000000000000000000000000000000000',
        NOW(),
        '20260930000001_ps26105_risk_lineage_foundation',
        NULL, NULL, NOW(), 1
      )
      ON CONFLICT ("migration_name") DO NOTHING;
    `);

    await client.query('COMMIT');

    console.log('✅  Migration applied successfully!\n');
    console.log('Tables created:');
    console.log('  • RiskRun');
    console.log('  • RiskAssessment');
    console.log('  • RiskAuditEvent');
    console.log('  • enum RiskRunStatus\n');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌  Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
