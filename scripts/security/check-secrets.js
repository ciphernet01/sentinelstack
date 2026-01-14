/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.next',
  'dist',
  '.git',
  '.docker',
  'reports',
  'AI 30 Days',
  'public',
  'public-google-integration-starter',
  'prisma',
]);

const SKIP_FILES = new Set([
  '.env',
  '.env.local',
  '.env.host',
  '.env.backend',
  'next-build.log',
]);

const ALLOW_EXAMPLES = new Set([
  '.env.example',
  '.env.local.example',
  '.env.host.example',
  '.env.backend.example',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.md',
  '.txt',
  '.prisma',
]);

const PATTERNS = [
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: 'Google API key (AIza*)', re: /AIza[0-9A-Za-z\-_]{30,}/g },
  { name: 'Firebase service account email', re: /firebase-adminsdk-[\w-]+@/g },
  { name: 'SendGrid API key', re: /SG\.[0-9A-Za-z\-_]{10,}\.[0-9A-Za-z\-_]{10,}/g },
  { name: 'Generic bearer token', re: /\bBearer\s+[A-Za-z0-9\-_.=]{20,}/g },
];

function shouldSkipDir(relPath) {
  const parts = relPath.split(path.sep);
  return parts.some((p) => SKIP_DIR_NAMES.has(p));
}

function walk(dir, relBase = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.join(relBase, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDir(rel)) continue;
      files.push(...walk(abs, rel));
      continue;
    }

    files.push({ abs, rel });
  }

  return files;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function main() {
  const all = walk(ROOT);

  const findings = [];

  for (const { abs, rel } of all) {
    const base = path.basename(rel);

    if (SKIP_FILES.has(base)) continue;
    if (ALLOW_EXAMPLES.has(base)) {
      // examples are allowed but should not contain real secrets
      // (we still scan them)
    }

    if (!isTextFile(abs)) continue;

    let content;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    for (const p of PATTERNS) {
      if (p.re.test(content)) {
        if (
          p.name === 'Google API key (AIza*)' &&
          rel === path.join('src', 'firebase', 'config.ts')
        ) {
          p.re.lastIndex = 0;
          continue;
        }
        findings.push({ rel, pattern: p.name });
        // reset regex state for global regex
        p.re.lastIndex = 0;
      }
    }
  }

  if (findings.length) {
    console.error('Potential secrets detected:');
    for (const f of findings) {
      console.error(`- ${f.rel} (${f.pattern})`);
    }
    console.error('\nAction: remove secrets from source-controlled files and use local env / secret manager.');
    process.exit(1);
  }

  console.log('No obvious secrets found in scanned files.');
}

main();
