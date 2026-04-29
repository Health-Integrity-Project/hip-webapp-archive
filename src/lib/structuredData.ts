import type { Claim } from './types';

const SITE_URL = 'https://archive.healthintegrityproject.org';

export function serializeJsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema).replace(/<\//g, '<\\/');
}

export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Health Integrity Project',
    url: SITE_URL,
    sameAs: [
      'https://www.linkedin.com/company/health-integrity-project',
      'https://www.instagram.com/health.integrity.project',
    ],
    description: 'Expert-reviewed evidence for health claims.',
  };
}

export function buildWebSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: SITE_URL,
    name: 'The Health Integrity Project',
  };
}

const RATING_MAP: Record<string, { ratingValue: number; alternateName: string }> = {
  'Evidence Supports':  { ratingValue: 5, alternateName: 'True' },
  'Evidence Disproves': { ratingValue: 1, alternateName: 'False' },
  'Inconclusive':       { ratingValue: 3, alternateName: 'Inconclusive' },
};

export function buildClaimReviewSchema(claim: Claim, canonicalUrl: string): Record<string, unknown> {
  const rating = RATING_MAP[claim.evidence_status ?? ''] ?? { ratingValue: 3, alternateName: 'Unverified' };
  return {
    '@context': 'https://schema.org',
    '@type': 'ClaimReview',
    claimReviewed: claim.title,
    url: canonicalUrl,
    datePublished: claim.created_at.slice(0, 10),
    author: { '@type': 'Organization', name: 'Health Integrity Project', url: SITE_URL },
    ...(claim.description ? { reviewBody: claim.description } : {}),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: rating.ratingValue,
      bestRating: 5,
      worstRating: 1,
      alternateName: rating.alternateName,
    },
    itemReviewed: { '@type': 'Claim', name: claim.title },
  };
}

export function buildBreadcrumbSchema(claimTitle: string, claimUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: claimTitle, item: claimUrl },
    ],
  };
}
