/**
 * Local dry run for the weekly experts digest. Picks the same way the real job
 * does, but prints the Slack message to stdout instead of posting it. No Slack
 * call, no writes.
 *
 * Run: npx tsx scripts/propose-expert-work.dryrun.ts
 * Needs SUPABASE_URL + SUPABASE_SERVICE_KEY (loaded from .env.local).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { pickClaimsNeedingPapers, pickPapersNeedingReview } from './lib/pickExpertWork';
import { buildDigest, ALL_CLEAR, CLAIMS_TO_PICK, PAPERS_TO_PICK } from './propose-expert-work';

// Minimal .env.local loader (no dotenv dependency).
function loadEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync('.env.local', 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY (set in .env.local).');
    process.exit(1);
  }

  const sb = createClient(url, key);
  const [claims, papers] = await Promise.all([
    pickClaimsNeedingPapers(sb, CLAIMS_TO_PICK),
    pickPapersNeedingReview(sb, PAPERS_TO_PICK),
  ]);

  console.error(
    `[dry run] picked ${claims.length} claims needing papers, ${papers.length} papers needing review\n`,
  );
  console.error('────────── Slack message preview ──────────');
  const digest = buildDigest(claims, papers);
  console.log(digest ?? ALL_CLEAR);
  console.error('───────────────────────────────────────────');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
