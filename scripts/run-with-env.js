/*
  Run a command with env vars loaded from a specific .env file.

  Usage:
    node scripts/run-with-env.js --env .env.host -- npx prisma migrate dev

  Notes:
  - Keeps existing process.env values unless the env file defines them.
  - No secrets are printed.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

function parseArgs(argv) {
  const args = argv.slice(2);
  const idx = args.indexOf('--');
  const before = idx >= 0 ? args.slice(0, idx) : args;
  const cmd = idx >= 0 ? args.slice(idx + 1) : [];

  let envPath = null;
  for (let i = 0; i < before.length; i++) {
    if (before[i] === '--env') {
      envPath = before[i + 1] || null;
      i++;
    }
  }

  return { envPath, cmd };
}

const { envPath, cmd } = parseArgs(process.argv);

if (!envPath) {
  console.error('Missing --env <path>');
  process.exit(2);
}
if (cmd.length === 0) {
  console.error('Missing command after --');
  process.exit(2);
}

const absoluteEnvPath = path.resolve(process.cwd(), envPath);
if (!fs.existsSync(absoluteEnvPath)) {
  console.error(`Env file not found: ${absoluteEnvPath}`);
  process.exit(2);
}

const parsed = dotenv.parse(fs.readFileSync(absoluteEnvPath));
const env = { ...process.env, ...parsed };

const result = spawnSync(cmd[0], cmd.slice(1), {
  stdio: 'inherit',
  shell: true,
  env,
});

process.exit(result.status ?? 1);
