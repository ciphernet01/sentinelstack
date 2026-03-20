/* eslint-disable no-console */

// Blocks accidentally committing local env files.
// Runs in git hooks, so it checks the staged file list.

const { spawnSync } = require('child_process');

const FORBIDDEN = new Set([
  '.env',
  '.env.local',
  '.env.host',
  '.env.backend',
]);

function runGit(args) {
  return spawnSync('git', args, { encoding: 'utf8', shell: true });
}

// If we're not in a git repo, do nothing (e.g. ZIP download).
const inside = runGit(['rev-parse', '--is-inside-work-tree']);
if (inside.status !== 0) process.exit(0);

const list = runGit(['diff', '--cached', '--name-only']);
if (list.status !== 0) {
  console.warn('[security] Could not read staged files; skipping env-file guard');
  process.exit(0);
}

const staged = list.stdout
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const blocked = staged.filter((p) => {
  const normalized = p.replace(/\\/g, '/');
  const base = normalized.split('/').pop();
  return base && FORBIDDEN.has(base);
});

if (blocked.length) {
  console.error('Blocked commit: local env files are staged:');
  for (const f of blocked) console.error(`- ${f}`);
  console.error('\nFix: unstage them (git restore --staged <file>) and keep env files local only.');
  process.exit(1);
}

process.exit(0);
