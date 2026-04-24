export interface Claim {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  broad_category: string | null;
  evidence_status: string | null;
  updated_at: string;
  labels: string[] | null;
  created_at: string;
  publication_count: number;
}

export interface Publication {
  id: string;
  title: string;
  journal: string | null;
  publication_year: number | null;
  url: string | null;
  doi: string | null;
  stance: 'supporting' | 'contradicting' | 'neutral' | 'mixed' | null;
}

export interface PublicationScore {
  id: string;
  publication_id: string;
  expert_user_id: string;
  comments: string | null;
  review_data: Record<string, unknown> | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface ExpertProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ClaimEvidenceData extends Claim {
  publications: Publication[];
  scores: PublicationScore[];
  experts: ExpertProfile[];
}
