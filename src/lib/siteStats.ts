import { supabase } from './supabase';
import { readAllCached } from './claimsCache';
import type { ClaimEvidenceData } from './types';

export interface SiteStats {
  claims: number;
  studies: number;
  experts: number;
}

let cached: Promise<SiteStats> | null = null;

/**
 * Site-wide "reviewed only" headline counts, computed once per build.
 *  - claims:  claims with an evidence_status AND >=1 reviewed publication
 *  - studies: distinct publications that have >=1 expert review
 *  - experts: distinct experts across all reviews
 *
 * Reads the per-claim cache (the same data the pages ship). Falls back to the
 * DB when the cache is empty/disabled (CLAIMS_CACHE=off).
 */
export function getSiteStats(): Promise<SiteStats> {
  if (!cached) cached = computeSiteStats();
  return cached;
}

async function computeSiteStats(): Promise<SiteStats> {
  const all = await readAllCached<ClaimEvidenceData>();
  if (all.length > 0) return statsFromCache(all);
  return statsFromDb();
}

function statsFromCache(all: ClaimEvidenceData[]): SiteStats {
  let claims = 0;
  let studies = 0;
  const experts = new Set<string>();

  for (const claim of all) {
    const reviewedPubIds = new Set<string>();
    for (const score of claim.scores ?? []) {
      reviewedPubIds.add(score.publication_id);
      experts.add(score.expert_user_id);
    }
    studies += reviewedPubIds.size;
    if (claim.evidence_status && reviewedPubIds.size > 0) claims += 1;
  }

  return { claims, studies, experts: experts.size };
}

async function statsFromDb(): Promise<SiteStats> {
  const { data: scoreRows } = await supabase
    .from('publication_scores')
    .select('publication_id, expert_user_id');

  const rows = scoreRows ?? [];
  const reviewedPubIds = new Set<string>();
  const experts = new Set<string>();
  for (const r of rows) {
    if (r.publication_id) reviewedPubIds.add(r.publication_id);
    if (r.expert_user_id) experts.add(r.expert_user_id);
  }

  // claims with a status and at least one reviewed publication
  let claims = 0;
  if (reviewedPubIds.size > 0) {
    const { data: pubRows } = await supabase
      .from('publications')
      .select('claim_id, id')
      .in('id', [...reviewedPubIds]);
    const reviewedClaimIds = new Set(
      (pubRows ?? []).map((p) => p.claim_id).filter(Boolean)
    );
    if (reviewedClaimIds.size > 0) {
      const { data: claimRows } = await supabase
        .from('claims')
        .select('id, evidence_status')
        .in('id', [...reviewedClaimIds]);
      claims = (claimRows ?? []).filter((c) => c.evidence_status).length;
    }
  }

  return { claims, studies: reviewedPubIds.size, experts: experts.size };
}
