/** Installs repo hooks from .githooks/ into .git/hooks/ (no git config changes). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, '.githooks');
const destDir = path.join(root, '.git', 'hooks');

if (!fs.existsSync(path.join(root, '.git'))) {
  console.error('Not a git repository.');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
for (const name of fs.readdirSync(srcDir)) {
  const src = path.join(srcDir, name);
  const dest = path.join(destDir, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, dest);
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    // Windows may ignore chmod; Git Bash still runs the hook.
  }
  console.log(`Installed hook: ${name}`);
}
