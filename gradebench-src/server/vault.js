import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, '..', 'data', 'vault.json');

/* On disk rather than in a 5MB localStorage key, so 200 entries with real
   thumbnails is comfortable. */
export const MAX_ENTRIES = 200;

export async function readVault() {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    // A corrupt file shouldn't take the app down — start empty and say so.
    throw new Error(`Could not read the vault file (${e.message}).`);
  }
}

export async function writeVault(entries) {
  if (!Array.isArray(entries)) throw new Error('Vault payload must be an array of entries.');
  const capped = entries.slice(0, MAX_ENTRIES);
  await mkdir(dirname(FILE), { recursive: true });
  // Write-then-rename so an interrupted save can't leave a half-written vault.
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ entries: capped }, null, 2), 'utf8');
  await rename(tmp, FILE);
  return capped;
}
