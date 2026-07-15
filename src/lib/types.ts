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

/**
 * A social post persisted as public/posts/<slug>/metadata.json.
 *
 * Two shapes share this type:
 * - Weekly claim posts (the pipeline): single image + claim fields
 *   (claim_id, claim_title, status_badge, claim_url, image_path).
 * - Manual posts: `title`, and either a single image or a carousel
 *   (`slides`), optionally with a rendered `video` (reel). Their caption may
 *   live in a separate file referenced by `caption_file`.
 */
export interface InstagramPost {
  /** Directory name under public/posts, e.g. "20260624-astaxanthin-heals-throat-tissue". */
  slug: string;
  /** "single" (default; weekly claim post) or "carousel". */
  type?: 'single' | 'carousel';
  /** Post title for manual posts; weekly posts use claim_title. */
  title?: string;
  claim_id?: string;
  claim_title?: string;
  /** Caption body (markdown; may contain **bold**). */
  caption?: string;
  /** File name inside the post directory holding the caption (e.g. "caption.txt"). */
  caption_file?: string;
  subtitle?: string;
  tags?: string[];
  /** Mapped badge label: "Supported" | "Disproved" | "Inconclusive". */
  status_badge?: string;
  /** Underlying evidence_status from the claim. */
  evidence_status?: string;
  /** Absolute URL to the claim's evidence page. */
  claim_url?: string;
  /** Public path to the rendered image, e.g. "/posts/<slug>/image.png". */
  image_path?: string;
  /** Carousel slide public paths, in display order. */
  slides?: string[];
  /** Public path to a rendered video/reel, e.g. "/posts/<slug>/reel.mp4". */
  video?: string;
  /** ISO timestamp the proposal was generated. */
  proposed_at: string;
}
