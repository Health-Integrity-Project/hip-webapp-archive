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
  stance: 'supporting' | 'contradicting' | null;
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

/** A weekly Instagram post proposal, persisted as public/posts/<slug>/metadata.json. */
export interface InstagramPost {
  /** Directory name under public/posts, e.g. "20260624-astaxanthin-heals-throat-tissue". */
  slug: string;
  claim_id: string;
  claim_title: string;
  /** Caption body (markdown; may contain **bold**). */
  caption: string;
  subtitle: string;
  /** Mapped badge label: "Supported" | "Disproved" | "Inconclusive". */
  status_badge: string;
  /** Underlying evidence_status from the claim. */
  evidence_status: string;
  /** Absolute URL to the claim's evidence page. */
  claim_url: string;
  /** Public path to the rendered image, e.g. "/posts/<slug>/image.png". */
  image_path: string;
  /** ISO timestamp the proposal was generated. */
  proposed_at: string;
}
