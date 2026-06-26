/**
 * Weekly experts digest.
 *
 * Picks 2 random claims that have no papers yet (need papers gathered) and 2
 * random papers that have no expert review yet, and posts them to the experts
 * Slack channel as a call to action. Read-only: no DB writes, no commit, no
 * deploy. Pure random each run — may repeat across weeks.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, SLACK_BOT_TOKEN, SLACK_EXPERTS_CHANNEL_ID.
 * Run: npx tsx scripts/propose-expert-work.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  pickClaimsNeedingPapers,
  pickPapersNeedingReview,
  type ClaimNeedingPapers,
  type PaperNeedingReview,
} from './lib/pickExpertWork';
import { postMessage } from './lib/slack';

export const SITE_BASE = 'https://open.healthintegrityproject.org';
export const CLAIMS_TO_PICK = 2;
export const PAPERS_TO_PICK = 2;

/**
 * Build the Slack mrkdwn digest text. Returns null when there is nothing to
 * propose (caller posts an all-clear message instead).
 */
export function buildDigest(
  claims: ClaimNeedingPapers[],
  papers: PaperNeedingReview[],
): string | null {
  if (claims.length === 0 && papers.length === 0) return null;

  const lines: string[] = ['🧑‍🔬 *Weekly experts digest — where we need a hand this week*', ''];

  if (claims.length > 0) {
    lines.push('*📄 Claims that need papers* — find and add studies for these:');
    for (const c of claims) {
      const url = `${SITE_BASE}/claims/${c.slug}/evidence`;
      const cat = c.broad_category ? ` _(${c.broad_category})_` : '';
      lines.push(`• <${url}|${c.title}>${cat}`);
    }
    lines.push('');
  }

  if (papers.length > 0) {
    lines.push('*🔬 Papers that need a review* — score the evidence on these:');
    for (const p of papers) {
      const link = p.claim_slug
        ? `${SITE_BASE}/claims/${p.claim_slug}/evidence`
        : p.url ?? p.doi ?? '';
      const meta = [p.journal, p.publication_year].filter(Boolean).join(', ');
      const metaStr = meta ? ` _(${meta})_` : '';
      const titleCell = link ? `<${link}|${p.title}>` : p.title;
      const under = p.claim_title ? ` — claim: ${p.claim_title}` : '';
      lines.push(`• ${titleCell}${metaStr}${under}`);
    }
    lines.push('');
  }

  lines.push('Pick one up and dive in 🙌');
  return lines.join('\n');
}

export const ALL_CLEAR =
  '🧑‍🔬 *Weekly experts digest* — no claims need papers and no papers need review right now. Nice work! 🎉';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_KEY');
  requireEnv('SLACK_BOT_TOKEN');
  const channel = requireEnv('SLACK_EXPERTS_CHANNEL_ID');

  const sb = createClient(supabaseUrl, supabaseKey);

  const [claims, papers] = await Promise.all([
    pickClaimsNeedingPapers(sb, CLAIMS_TO_PICK),
    pickPapersNeedingReview(sb, PAPERS_TO_PICK),
  ]);

  console.log(`Picked ${claims.length} claims needing papers, ${papers.length} papers needing review.`);

  const digest = buildDigest(claims, papers);
  if (digest === null) {
    await postMessage(channel, ALL_CLEAR);
    console.log('Nothing to propose; posted all-clear message.');
    return;
  }

  await postMessage(channel, digest);
  console.log('Posted experts digest to Slack.');
}

// Only run when invoked directly, not when imported (e.g. by the dry-run script).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
