import { supabase } from './supabase';
import { readCache, writeCache, readCacheIndex } from './claimsCache';
import type { ClaimEvidenceData, Publication, PublicationScore, ExpertProfile } from './types';

export async function getAllClaims(): Promise<import('./types').Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('id, slug, title, description, broad_category, evidence_status, updated_at, labels, created_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch claims: ${error.message}`);
  const claims = data ?? [];

  const ids = claims.map((c) => c.id);
  let pubCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: pubs } = await supabase
      .from('publications')
      .select('claim_id')
      .in('claim_id', ids);
    for (const p of pubs ?? []) {
      pubCounts[p.claim_id] = (pubCounts[p.claim_id] ?? 0) + 1;
    }
  }

  return claims.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description ?? null,
    broad_category: c.broad_category ?? null,
    evidence_status: c.evidence_status ?? null,
    updated_at: c.updated_at,
    labels: c.labels ?? null,
    created_at: c.created_at,
    publication_count: pubCounts[c.id] ?? 0,
  }));
}

/** Lightweight freshness probe: one query, slug + updated_at for every claim. */
export async function getAllClaimRefs(): Promise<{ slug: string; updated_at: string }[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('slug, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch claim refs: ${error.message}`);
  return (data ?? []).filter((c) => c.slug);
}

export async function getAllClaimSlugs(): Promise<string[]> {
  return (await getAllClaimRefs()).map((c) => c.slug);
}

/**
 * Cache-aware evidence fetch. Pass the DB updated_at (from getAllClaimRefs) to
 * skip the DB entirely when the on-disk cache is current. Omit it to always
 * fetch fresh (and refresh the cache).
 */
export async function getClaimEvidence(
  slug: string,
  dbUpdatedAt?: string
): Promise<ClaimEvidenceData | null> {
  if (dbUpdatedAt) {
    const cached = await readCache<ClaimEvidenceData>(slug);
    if (cached && cached.updated_at === dbUpdatedAt) return cached;
  }

  const fresh = await fetchClaimEvidenceFromDb(slug);
  if (fresh) await writeCache(slug, fresh);
  return fresh;
}

async function fetchClaimEvidenceFromDb(slug: string): Promise<ClaimEvidenceData | null> {
  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .select('id, slug, title, description, broad_category, evidence_status, updated_at, labels, created_at')
    .eq('slug', slug)
    .single();

  if (claimError || !claim) return null;

  const [pubResult] = await Promise.all([
    supabase.from('publications').select('*').eq('claim_id', claim.id),
    supabase.from('claim_links').select('id, url, title, description').eq('claim_id', claim.id),
  ]);

  const publications: Publication[] = (pubResult.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    journal: p.journal ?? null,
    publication_year: p.publication_year ?? null,
    url: p.url ?? null,
    doi: p.doi ?? null,
    stance: p.stance as Publication['stance'],
  }));

  const pubIds = publications.map((p) => p.id);
  let scores: PublicationScore[] = [];
  let experts: ExpertProfile[] = [];

  if (pubIds.length > 0) {
    const { data: scoreRows } = await supabase
      .from('publication_scores')
      .select('id, publication_id, expert_user_id, comments, review_data, updated_at, created_at')
      .in('publication_id', pubIds);

    scores = (scoreRows ?? []) as PublicationScore[];

    const expertIds = [...new Set(scores.map((s) => s.expert_user_id))];
    if (expertIds.length > 0) {
      const { data: expertRows } = await supabase
        .from('expert_stats')
        .select('user_id, display_name, avatar_url')
        .in('user_id', expertIds);

      experts = (expertRows ?? []) as ExpertProfile[];
    }
  }

  return {
    ...claim,
    publication_count: publications.length,
    publications,
    scores,
    experts,
  };
}
