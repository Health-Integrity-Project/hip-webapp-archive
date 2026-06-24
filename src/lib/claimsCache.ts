import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../../.cache/claims');

/** Disable cache entirely (force fresh DB fetch + rewrite) with CLAIMS_CACHE=off. */
const CACHE_ENABLED = (import.meta.env.CLAIMS_CACHE ?? process.env.CLAIMS_CACHE) !== 'off';

function cachePath(slug: string): string {
  return join(CACHE_DIR, `${slug}.json`);
}

export async function readCache<T>(slug: string): Promise<T | null> {
  if (!CACHE_ENABLED) return null;
  try {
    const raw = await readFile(cachePath(slug), 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(slug: string, data: T): Promise<void> {
  if (!CACHE_ENABLED) return;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath(slug), JSON.stringify(data), 'utf-8');
}

/** Parse and return every cached claim object, in one disk pass. */
export async function readAllCached<T>(): Promise<T[]> {
  if (!CACHE_ENABLED) return [];
  let files: string[];
  try {
    files = await readdir(CACHE_DIR);
  } catch {
    return [];
  }
  const parsed = await Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map(async (f) => {
        try {
          const raw = await readFile(join(CACHE_DIR, f), 'utf-8');
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      })
  );
  return parsed.filter((p): p is T => p !== null);
}

/** slug -> updated_at for every cached claim, in one disk pass. */
export async function readCacheIndex(): Promise<Record<string, string>> {
  if (!CACHE_ENABLED) return {};
  const index: Record<string, string> = {};
  let files: string[];
  try {
    files = await readdir(CACHE_DIR);
  } catch {
    return {};
  }
  await Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map(async (f) => {
        try {
          const raw = await readFile(join(CACHE_DIR, f), 'utf-8');
          const parsed = JSON.parse(raw) as { slug?: string; updated_at?: string };
          if (parsed.slug && parsed.updated_at) index[parsed.slug] = parsed.updated_at;
        } catch {
          /* skip corrupt entry */
        }
      })
  );
  return index;
}
