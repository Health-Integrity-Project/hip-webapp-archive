/**
 * Weekly Instagram post proposer.
 *
 * Picks the next decided claim, drafts a caption (Anthropic), renders an
 * on-brand image (SVG -> PNG), writes it + metadata into public/posts/, records
 * the proposal in Supabase, and posts it to Slack for human review.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, SLACK_WEBHOOK_URL.
 * Run: npx tsx scripts/propose-weekly-post.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { pickClaim, fetchClaimEvidence, statusBadge } from './lib/pickClaim';
import { draftCaption } from './lib/caption';
import { renderPostImage } from './lib/renderImage';
import { postProposal, postInfo } from './lib/slack';

const SITE_BASE = 'https://open.healthintegrityproject.org';
const POSTS_DIR = fileURLToPath(new URL('../public/posts', import.meta.url));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_KEY');
  requireEnv('ANTHROPIC_API_KEY');
  requireEnv('SLACK_BOT_TOKEN');
  requireEnv('SLACK_CHANNEL_ID');

  const sb = createClient(supabaseUrl, supabaseKey);

  // 1. Pick a candidate claim.
  const claim = await pickClaim(sb);
  if (!claim) {
    console.log('No eligible claims this week.');
    await postInfo('No candidate claims for an Instagram post this week.');
    return;
  }
  console.log(`Picked claim: ${claim.title} (${claim.evidence_status})`);

  const badge = statusBadge(claim.evidence_status);
  const claimUrl = `${SITE_BASE}/claims/${claim.slug}/evidence`;

  // 2. Gather the evidence the caption draws on: count, stance tally, comments.
  const evidence = await fetchClaimEvidence(sb, claim.id);
  console.log(
    `Evidence: ${evidence.count} studies (${evidence.supporting} supporting, ${evidence.contradicting} contradicting), ${evidence.comments.length} comments`,
  );

  // 3. Draft caption (Anthropic). Failure here aborts before any commit/DB write.
  const { caption, subtitle } = await draftCaption(claim.title, badge, evidence);
  console.log(`Caption: ${caption}`);
  console.log(`Subtitle: ${subtitle}`);

  // 4. Render image.
  const png = renderPostImage({ title: claim.title, statusBadge: badge, subtitle });

  // 5. Write image + metadata into the repo.
  const dateStr = yyyymmdd(new Date());
  const slug = `${dateStr}-${claim.slug}`;
  const dir = join(POSTS_DIR, slug);
  mkdirSync(dir, { recursive: true });

  const imagePath = `/posts/${slug}/image.png`;
  writeFileSync(join(dir, 'image.png'), png);

  const proposedAt = new Date().toISOString();
  const metadata = {
    slug,
    claim_id: claim.id,
    claim_title: claim.title,
    caption,
    subtitle,
    status_badge: badge,
    evidence_status: claim.evidence_status,
    claim_url: claimUrl,
    image_path: imagePath,
    proposed_at: proposedAt,
  };
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log(`Wrote ${imagePath}`);

  // 6. Record in Supabase (after the artifact exists). Unique claim_id guards
  // against duplicates if the run is retried.
  const { error: insertErr } = await sb.from('instagram_posts').insert({
    claim_id: claim.id,
    proposed_at: proposedAt,
    status: 'proposed',
    caption,
    image_path: imagePath,
  });
  if (insertErr) throw new Error(`Failed to insert instagram_posts row: ${insertErr.message}`);

  // 7. Slack: upload the rendered PNG with the proposal text as the message
  // body. The image is visible immediately — no dependency on the deploy.
  await postProposal({
    claimTitle: claim.title,
    statusBadge: badge,
    caption,
    subtitle,
    claimUrl,
    image: png,
  });
  console.log('Posted proposal to Slack.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
