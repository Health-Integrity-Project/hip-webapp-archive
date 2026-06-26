import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClaimNeedingPapers {
  id: string;
  slug: string;
  title: string;
  broad_category: string | null;
}

export interface PaperNeedingReview {
  id: string;
  title: string;
  journal: string | null;
  publication_year: number | null;
  url: string | null;
  doi: string | null;
  claim_id: string;
  claim_slug: string | null;
  claim_title: string | null;
}

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick up to `n` random claims that have no linked publications — i.e. claims
 * that still need papers gathered. Pure random; no dedup across runs.
 */
export async function pickClaimsNeedingPapers(
  sb: SupabaseClient,
  n: number,
): Promise<ClaimNeedingPapers[]> {
  // Claim ids that already have at least one publication.
  const { data: pubs, error: pubErr } = await sb
    .from('publications')
    .select('claim_id');
  if (pubErr) throw new Error(`Failed to read publications: ${pubErr.message}`);
  const claimsWithPapers = new Set(
    (pubs ?? []).map((p) => p.claim_id).filter(Boolean),
  );

  const { data: claims, error: claimErr } = await sb
    .from('claims')
    .select('id, slug, title, broad_category');
  if (claimErr) throw new Error(`Failed to read claims: ${claimErr.message}`);

  const eligible = (claims ?? []).filter(
    (c) => c.slug && !claimsWithPapers.has(c.id),
  ) as ClaimNeedingPapers[];

  return shuffle(eligible).slice(0, n);
}

/**
 * Pick up to `n` random publications that have no expert review (no row in
 * publication_scores). Each is returned with its parent claim for context.
 * Pure random; no dedup across runs.
 */
export async function pickPapersNeedingReview(
  sb: SupabaseClient,
  n: number,
): Promise<PaperNeedingReview[]> {
  // Publication ids that already have at least one review.
  const { data: scores, error: scoreErr } = await sb
    .from('publication_scores')
    .select('publication_id');
  if (scoreErr) throw new Error(`Failed to read publication_scores: ${scoreErr.message}`);
  const reviewedPubIds = new Set(
    (scores ?? []).map((s) => s.publication_id).filter(Boolean),
  );

  const { data: pubs, error: pubErr } = await sb
    .from('publications')
    .select('id, title, journal, publication_year, url, doi, claim_id');
  if (pubErr) throw new Error(`Failed to read publications: ${pubErr.message}`);

  const unreviewed = (pubs ?? []).filter((p) => !reviewedPubIds.has(p.id));
  const picked = shuffle(unreviewed).slice(0, n);
  if (picked.length === 0) return [];

  // Attach parent claim slug/title for linkable context.
  const claimIds = [...new Set(picked.map((p) => p.claim_id).filter(Boolean))];
  const { data: claims, error: claimErr } = await sb
    .from('claims')
    .select('id, slug, title')
    .in('id', claimIds);
  if (claimErr) throw new Error(`Failed to read claims: ${claimErr.message}`);
  const claimById = new Map((claims ?? []).map((c) => [c.id, c]));

  return picked.map((p) => {
    const claim = p.claim_id ? claimById.get(p.claim_id) : undefined;
    return {
      id: p.id,
      title: p.title,
      journal: p.journal,
      publication_year: p.publication_year,
      url: p.url,
      doi: p.doi,
      claim_id: p.claim_id,
      claim_slug: claim?.slug ?? null,
      claim_title: claim?.title ?? null,
    };
  });
}
