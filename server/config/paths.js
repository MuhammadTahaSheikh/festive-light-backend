import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(__dirname, '..', '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const RENDERS_DIR = path.join(PUBLIC_DIR, 'renders');
export const DATA_DIR = path.join(ROOT, 'data');
export const CLIENT_DIST = path.join(ROOT, 'client', 'dist');

for (const dir of [RENDERS_DIR, DATA_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
