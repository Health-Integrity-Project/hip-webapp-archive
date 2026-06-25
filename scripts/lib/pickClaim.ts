import type { SupabaseClient } from '@supabase/supabase-js';

export interface CandidateClaim {
  id: string;
  slug: string;
  title: string;
  evidence_status: string;
  created_at: string;
}

const ELIGIBLE_STATUSES = ['Evidence Supports', 'Evidence Disproves', 'Inconclusive'];

/**
 * Pick the next claim to propose: a decided claim (Supports/Disproves/Inconclusive)
 * that has not already been turned into an Instagram post. Newest first.
 * Returns null when there are no eligible candidates.
 */
export async function pickClaim(sb: SupabaseClient): Promise<CandidateClaim | null> {
  // Already-proposed claim_ids — excluded from the candidate set.
  const { data: posted, error: postedErr } = await sb
    .from('instagram_posts')
    .select('claim_id');
  if (postedErr) throw new Error(`Failed to read instagram_posts: ${postedErr.message}`);
  const postedIds = new Set((posted ?? []).map((r) => r.claim_id));

  const { data, error } = await sb
    .from('claims')
    .select('id, slug, title, evidence_status, created_at')
    .in('evidence_status', ELIGIBLE_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to query claims: ${error.message}`);

  for (const c of data ?? []) {
    if (!postedIds.has(c.id) && c.slug) {
      return c as CandidateClaim;
    }
  }
  return null;
}

export interface ClaimEvidence {
  /** Total reviewed publications for the claim. */
  count: number;
  /** Publications with stance === 'supporting'. */
  supporting: number;
  /** Publications with stance === 'contradicting'. */
  contradicting: number;
  /** Publication titles (for context). */
  titles: string[];
  /** Expert reviewer comments — the rich free-text source for the "why". */
  comments: string[];
}

/**
 * Gather the evidence a caption draws on: publication count, stance tally, and
 * the expert reviewer comments for one claim.
 */
export async function fetchClaimEvidence(
  sb: SupabaseClient,
  claimId: string,
): Promise<ClaimEvidence> {
  const { data: pubs, error: pubErr } = await sb
    .from('publications')
    .select('id, title, stance')
    .eq('claim_id', claimId);
  if (pubErr) throw new Error(`Failed to fetch publications: ${pubErr.message}`);

  const publications = pubs ?? [];
  const supporting = publications.filter((p) => p.stance === 'supporting').length;
  const contradicting = publications.filter((p) => p.stance === 'contradicting').length;
  const titles = publications.map((p) => p.title).filter(Boolean);

  let comments: string[] = [];
  const pubIds = publications.map((p) => p.id);
  if (pubIds.length > 0) {
    const { data: scores, error: scoreErr } = await sb
      .from('publication_scores')
      .select('comments')
      .in('publication_id', pubIds);
    if (scoreErr) throw new Error(`Failed to fetch publication_scores: ${scoreErr.message}`);
    comments = (scores ?? [])
      .map((s) => (s.comments ?? '').trim())
      .filter((c) => c.length > 0);
  }

  return { count: publications.length, supporting, contradicting, titles, comments };
}

/**
 * Map a claim's evidence_status to the short Instagram badge label.
 * Categories mirror the site (src/pages/claims.astro); only the wording is
 * shortened for the badge. There is no "Proved" category.
 */
export function statusBadge(evidenceStatus: string): string {
  switch (evidenceStatus) {
    case 'Evidence Supports':
      return 'Supported';
    case 'Evidence Disproves':
      return 'Disproved';
    case 'Inconclusive':
      return 'Inconclusive';
    default:
      return evidenceStatus;
  }
}
