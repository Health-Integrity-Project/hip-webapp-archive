import type { Claim, Publication, ExpertProfile } from './types';

const SITE_URL = 'https://open.healthintegrityproject.org';

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

// alternateName values must be Google fact-check accepted terms, else
// page is ineligible for fact-check rich results.
// https://developers.google.com/search/docs/appearance/structured-data/factcheck
const RATING_MAP: Record<string, { ratingValue: number; alternateName: string }> = {
  'Evidence Supports':  { ratingValue: 5, alternateName: 'True' },
  'Evidence Disproves': { ratingValue: 1, alternateName: 'False' },
  'Inconclusive':       { ratingValue: 3, alternateName: 'Unproven' },
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
    itemReviewed: {
      '@type': 'Claim',
      name: claim.title,
      appearance: { '@type': 'CreativeWork', url: canonicalUrl },
    },
  };
}

// MedicalScholarlyArticle JSON-LD per cited publication. E-E-A-T signal for YMYL.
// Only emits fields present in source — no fabricated authors/dates.
export function buildPublicationSchema(pub: Publication): Record<string, unknown> | null {
  if (!pub.title) return null;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalScholarlyArticle',
    headline: pub.title,
    name: pub.title,
  };
  if (pub.journal) {
    schema.isPartOf = { '@type': 'Periodical', name: pub.journal };
  }
  if (pub.publication_year) schema.datePublished = String(pub.publication_year);
  if (pub.doi) {
    schema.sameAs = `https://doi.org/${pub.doi}`;
    schema.identifier = { '@type': 'PropertyValue', propertyID: 'DOI', value: pub.doi };
  }
  if (pub.url) schema.url = pub.url;
  return schema;
}

// Person JSON-LD per expert reviewer. E-E-A-T signal for YMYL.
// sameAs (ORCID/PubMed/LinkedIn) to be added when those links exist in source.
export function buildPersonSchema(expert: ExpertProfile): Record<string, unknown> | null {
  if (!expert.display_name) return null;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: expert.display_name,
    affiliation: { '@type': 'Organization', name: 'Health Integrity Project', url: SITE_URL },
  };
  if (expert.avatar_url) schema.image = expert.avatar_url;
  return schema;
}

export function buildBreadcrumbSchema(claimTitle: string, claimUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Health Claims', item: `${SITE_URL}/claims` },
      { '@type': 'ListItem', position: 3, name: claimTitle, item: claimUrl },
    ],
  };
}
