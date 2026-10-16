/**
 * Runs automatically before `npm start`, `npm run dev` and `npm run build`.
 *
 *  1. Checks the Node.js version (Vite 5 needs Node 18+).
 *  2. Installs dependencies if they are missing or out of date, so a fresh
 *     checkout works with just `npm start`.
 *  3. Checks the loader's image assets are present.
 *
 * Any problem is reported with a clear message and a non-zero exit code
 * instead of a stack trace.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_NODE_MAJOR = 18;

function fail(message) {
  console.error(`\n[swish] ${message}\n`);
  process.exit(1);
}

function info(message) {
  console.log(`[swish] ${message}`);
}

// 1. Node version ------------------------------------------------------------
const major = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
  fail(
    `Node.js ${MIN_NODE_MAJOR} or newer is required (you have ${process.versions.node}).\n` +
      '        Install the LTS version from https://nodejs.org and run "npm start" again.'
  );
}

// 2. Dependencies --------------------------------------------------------------
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function missingDependencies() {
  const pkg = readJson(join(root, 'package.json'));
  if (!pkg) fail('package.json is missing or is not valid JSON.');
  const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  return names.filter((name) => !existsSync(join(root, 'node_modules', name, 'package.json')));
}

function lockfileNewerThanInstall() {
  const lock = join(root, 'package-lock.json');
  const marker = join(root, 'node_modules', '.package-lock.json');
  if (!existsSync(lock) || !existsSync(marker)) return false;
  try {
    return statSync(lock).mtimeMs > statSync(marker).mtimeMs + 1000;
  } catch {
    return false;
  }
}

function runNpmInstall() {
  // Use the npm that launched this script when available (works on Windows, macOS, Linux).
  const npmCli = process.env.npm_execpath;
  const useCli = npmCli && npmCli.endsWith('.js') && existsSync(npmCli);
  const command = useCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = useCli ? [npmCli, 'install', '--no-audit', '--no-fund'] : ['install', '--no-audit', '--no-fund'];
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: !useCli && process.platform === 'win32',
  });
  if (result.error) fail(`Could not run "npm install": ${result.error.message}`);
  if (result.status !== 0) {
    fail(
      '"npm install" failed (see the messages above).\n' +
        '        Check your internet connection or proxy settings, then run "npm install" and "npm start".'
    );
  }
}

const missing = missingDependencies();
if (missing.length > 0 || lockfileNewerThanInstall()) {
  info(
    missing.length > 0
      ? `Installing dependencies (missing: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ', …' : ''})…`
      : 'package-lock.json changed — updating dependencies…'
  );
  runNpmInstall();
  const stillMissing = missingDependencies();
  if (stillMissing.length > 0) fail(`These packages are still missing after install: ${stillMissing.join(', ')}`);
}

// 3. Loader assets -------------------------------------------------------------
const assetDir = join(root, 'src', 'components', 'SwishLoader', 'assets');
for (const file of ['bag-frames-0.webp', 'bag-frames-1.webp', 'ground-frames.webp', 'seal-frames.webp']) {
  if (!existsSync(join(assetDir, file))) {
    fail(`Missing asset src/components/SwishLoader/assets/${file}. Restore it from the project files.`);
  }
}

info('Ready.');
