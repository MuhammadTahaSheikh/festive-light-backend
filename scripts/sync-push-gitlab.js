/**
 * Sync monorepo splits to GitLab:
 *   client/  → flp-lighting-frontend
 *   server(+root packaging) → flp-lighting-backend
 *
 * Usage: node scripts/sync-push-gitlab.js
 * Also run automatically from the pre-push git hook when pushing origin.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIRRORS = path.join(ROOT, '.gitlab-mirrors');

const FRONTEND_URL =
  'https://gitlab.com/flpadmin-group/website-projects/flp-lighting-frontend.git';
const BACKEND_URL =
  'https://gitlab.com/flpadmin-group/website-projects/flp-lighting-backend.git';

const FRONTEND_IGNORE = `node_modules/
dist/
vercel-out/
.vite-app-staging/
.env
*.log
.DS_Store
`;

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim();
    throw new Error(`${cmd} ${args.join(' ')} failed (${res.status}): ${err}`);
  }
  return (res.stdout || '').trim();
}

function runGit(cwd, args) {
  return run('git', args, { cwd });
}

function ensureMirror(name, url) {
  const dir = path.join(MIRRORS, name);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(MIRRORS, { recursive: true });
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Cloning ${name}…`);
    run('git', ['clone', url, dir], { cwd: ROOT });
  } else {
    runGit(dir, ['remote', 'set-url', 'origin', url]);
    runGit(dir, ['fetch', 'origin']);
    // Prefer main; fall back to current branch
    const branches = runGit(dir, ['branch', '-r']);
    if (branches.includes('origin/main')) {
      runGit(dir, ['checkout', '-B', 'main', 'origin/main']);
    }
  }
  return dir;
}

function clearTrackedTree(dir, keep = new Set(['.git'])) {
  for (const entry of fs.readdirSync(dir)) {
    if (keep.has(entry)) continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function copyDir(src, dest, { excludeDirs = [] } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludeDirs.includes(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to, { excludeDirs });
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function monorepoMessage() {
  try {
    return runGit(ROOT, ['log', '-1', '--pretty=%s']);
  } catch {
    return 'Sync from festive-light-launch monorepo';
  }
}

function commitAndPush(dir, label) {
  runGit(dir, ['add', '-A']);
  const status = runGit(dir, ['status', '--porcelain']);
  if (!status) {
    console.log(`${label}: no changes to push`);
    return;
  }
  const msg = `${monorepoMessage()} (sync from monorepo)`;
  runGit(dir, ['commit', '-m', msg]);
  runGit(dir, ['push', 'origin', 'HEAD']);
  console.log(`${label}: pushed`);
}

function refreshClientMarketing() {
  const marketingDir = path.join(ROOT, 'client', 'marketing');
  fs.mkdirSync(marketingDir, { recursive: true });
  copyFileIfExists(
    path.join(ROOT, 'public', 'index.html'),
    path.join(marketingDir, 'index.html')
  );
  copyFileIfExists(
    path.join(ROOT, 'public', 'demo-widget.js'),
    path.join(marketingDir, 'demo-widget.js')
  );
}

function syncFrontend() {
  // Keep Vercel marketing home in sync with Express public/ landing page.
  refreshClientMarketing();

  const dir = ensureMirror('frontend', FRONTEND_URL);
  clearTrackedTree(dir);
  copyDir(path.join(ROOT, 'client'), dir, {
    excludeDirs: ['node_modules', 'dist', 'vercel-out'],
  });
  fs.writeFileSync(path.join(dir, '.gitignore'), FRONTEND_IGNORE);
  commitAndPush(dir, 'frontend');
}

function syncBackend() {
  const dir = ensureMirror('backend', BACKEND_URL);
  clearTrackedTree(dir);

  copyDir(path.join(ROOT, 'server'), path.join(dir, 'server'), {
    excludeDirs: ['node_modules'],
  });
  copyDir(path.join(ROOT, 'scripts'), path.join(dir, 'scripts'), {
    excludeDirs: ['node_modules'],
  });
  // Avoid re-copying this sync helper's sibling scripts is fine; all scripts go.
  if (fs.existsSync(path.join(ROOT, 'supabase'))) {
    copyDir(path.join(ROOT, 'supabase'), path.join(dir, 'supabase'));
  }
  if (fs.existsSync(path.join(ROOT, 'public'))) {
    copyDir(path.join(ROOT, 'public'), path.join(dir, 'public'), {
      excludeDirs: [],
    });
    // Drop generated renders except keep
    const renders = path.join(dir, 'public', 'renders');
    if (fs.existsSync(renders)) {
      for (const f of fs.readdirSync(renders)) {
        if (f === '.gitkeep') continue;
        fs.rmSync(path.join(renders, f), { recursive: true, force: true });
      }
    }
  }

  for (const file of [
    'package.json',
    'package-lock.json',
    '.env.example',
    '.gitignore',
    'README.md',
    '.gitlab-ci.yml',
  ]) {
    copyFileIfExists(path.join(ROOT, file), path.join(dir, file));
  }

  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'README.md'),
    '# Local data (gitignored JSON lives here)\n'
  );

  // Do not ship the sync script into backend as "source of truth" for deploy —
  // scripts/ is already copied; that is intentional (setup scripts live there).

  commitAndPush(dir, 'backend');
}

function main() {
  console.log('Syncing client/ → frontend, server/ → backend…');
  syncFrontend();
  syncBackend();
  console.log('Done.');
}

main();
