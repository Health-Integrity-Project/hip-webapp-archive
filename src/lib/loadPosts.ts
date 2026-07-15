import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstagramPost } from './types';

// public/posts lives at repo root, two levels up from src/lib.
const POSTS_DIR = fileURLToPath(new URL('../../public/posts', import.meta.url));

/**
 * Read every public/posts/<slug>/metadata.json at build time, newest first.
 * Returns [] when the directory is absent (e.g. before the first proposal).
 */
export function getAllPosts(): InstagramPost[] {
  if (!existsSync(POSTS_DIR)) return [];

  const posts: InstagramPost[] = [];
  for (const entry of readdirSync(POSTS_DIR)) {
    const dir = join(POSTS_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;

    const metaPath = join(dir, 'metadata.json');
    if (!existsSync(metaPath)) continue;

    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as InstagramPost;
      // Manual posts keep their caption in a sibling file (e.g. caption.txt).
      if (!meta.caption && meta.caption_file) {
        const captionPath = join(dir, meta.caption_file);
        if (existsSync(captionPath)) meta.caption = readFileSync(captionPath, 'utf8').trim();
      }
      // Fall back to the directory name if slug is missing.
      posts.push({ ...meta, slug: meta.slug ?? entry });
    } catch (err) {
      console.warn(`Skipping malformed post metadata at ${metaPath}: ${(err as Error).message}`);
    }
  }

  return posts.sort(
    (a, b) => new Date(b.proposed_at).getTime() - new Date(a.proposed_at).getTime(),
  );
}

export function getPost(slug: string): InstagramPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}
