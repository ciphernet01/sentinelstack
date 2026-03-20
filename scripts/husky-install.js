/*
  Installs Husky hooks if this folder is a git repository.

  Why:
  - `npm install` should not fail on fresh ZIP downloads (no .git).
  - When you later `git init` (or clone), hooks become active automatically.
*/

const fs = require('fs');
const { spawnSync } = require('child_process');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

if (!fs.existsSync('.git')) {
  console.log('[husky] .git not found; skipping hook install');
  process.exit(0);
}

// Install (creates .husky/_ and wires git hooks)
const status = run('npx', ['husky', 'install']);
process.exit(status);
