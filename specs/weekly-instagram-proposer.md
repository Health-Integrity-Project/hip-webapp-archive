# Weekly Instagram Post Proposer

## Context

Communications team currently produces one Instagram post per week manually: pick a decided claim, render a Canva template (title + status badge + short caption), download image, copy caption, post. Manual cadence is slipping.

Goal: automate the *proposal* step. A weekly GitHub Action picks a candidate claim, renders an on-brand image **in code** (SVG → PNG, no external design service), drafts a caption via Claude API, commits the image into this archive repo (so it can also render in a `/posts/` page), and drops the proposal in Slack for human approval. Human still publishes to Instagram manually (MVP — no Meta Graph API).

> **Image rendering decision (resolved):** Canva Connect Autofill API requires a Canva **Enterprise** tier we don't have, and the Claude↔Canva MCP integration can't run inside a headless GitHub cron (MCP needs an interactive Claude session). So the image is rendered **in code** from an SVG template (`@resvg/resvg-js`) using brand assets already in this repo. Fully headless, free, no Canva dependency.

Two outcomes per run:
1. Slack message with image preview + caption + claim link for human review.
2. Committed asset under `public/posts/<date>/` + metadata JSON, so the archive site renders an Instagram-style timeline page from this repo's content.

This lives in `hip-webapp-archive` (not `hip-webapp`) because: the repo already does scheduled Supabase→Netlify builds; images-as-content fits its static-site model; keeps social-media automation out of the production app.

## Architecture

```
GitHub Action (weekly cron)
        ↓
scripts/propose-weekly-post.ts (Node)
        ↓
  ├─ Supabase query → pick claim
  ├─ Anthropic API  → caption draft
  ├─ SVG → PNG      → render on-brand image in code (@resvg/resvg-js)
  ├─ git commit     → save image + metadata to repo
  └─ Slack webhook  → post proposal
        ↓
  Next nightly-build picks up new asset → Netlify deploy → /posts page updated
```

## Files

### New
- `.github/workflows/weekly-instagram-proposal.yml` — cron Mon 09:00 UTC, runs script, commits results, pushes
- `scripts/propose-weekly-post.ts` — orchestrator
- `scripts/lib/pickClaim.ts` — Supabase query for next candidate
- `scripts/lib/renderImage.ts` — build SVG post template + rasterize to PNG (@resvg/resvg-js)
- `scripts/lib/caption.ts` — Anthropic call with few-shot examples
- `scripts/lib/caption-examples.json` — seed few-shot captions (generic on-brand, refine later)
- `scripts/lib/slack.ts` — webhook POST with image preview block
- `src/pages/posts/index.astro` — list page rendering all proposals
- `src/pages/posts/[slug].astro` — single post detail
- `src/lib/loadPosts.ts` — read `public/posts/*/metadata.json` at build time
- `public/posts/.gitkeep`

### Reuse
- `src/lib/supabase.ts` — existing client (service-role build-time pattern)
- `src/lib/types.ts` — extend with `InstagramPost` type
- `.github/workflows/nightly-build.yml` — existing pattern for SUPABASE_* secrets and Node 20 setup

### Tracking state
- New table `instagram_posts` in main Supabase DB (migration belongs in `hip-webapp` repo, not here): `id`, `claim_id` (unique FK), `proposed_at`, `posted_at` nullable, `status` enum (proposed/approved/posted/skipped), `caption`, `image_path` (path in archive repo), `slack_message_ts`.
- Why Supabase table not repo-local JSON: claim selection query needs `NOT IN (already proposed)` joined against claims table — keeping state in Postgres avoids a second source of truth.

## Workflow detail

### `scripts/propose-weekly-post.ts`

```
1. Connect Supabase with service role.
2. Pick claim:
   SELECT * FROM claims c
   WHERE c.evidence_status IN ('Evidence Supports','Evidence Disproves','Inconclusive')
     AND NOT EXISTS (SELECT 1 FROM instagram_posts ip WHERE ip.claim_id = c.id)
   ORDER BY c.created_at DESC
   LIMIT 1;
3. Fetch top 3 publications for context (publications + publication_scores).
4. Call Anthropic claude-sonnet-4-6 with system prompt + few-shot examples of past captions
   → output: { caption: string (≤180 chars), subtitle: string (≤80 chars) }
5. Map evidence_status → status badge label:
     Evidence Supports → "Proved"
     Evidence Disproves → "Disproved"
     Inconclusive → "Inconclusive"
6. Render image in code (scripts/lib/renderImage.ts):
   Build a 1080×1350 (IG 4:5 portrait) SVG: HIP logo + claim title + status badge
   (color per evidence_status: green/red/amber) + subtitle. Rasterize with @resvg/resvg-js.
   Bundles a font file (Inter / DejaVu) so text renders in CI with no system fonts.
7. Save to repo:
     public/posts/<YYYYMMDD>-<claim-slug>/image.png
     public/posts/<YYYYMMDD>-<claim-slug>/metadata.json
       { claim_id, claim_title, caption, subtitle, status_badge, claim_url, proposed_at }
8. Insert into instagram_posts (status='proposed', image_path).
9. Slack webhook POST: block kit with image, caption, claim link.
10. git add/commit/push (workflow handles via stefanzweifel/git-auto-commit-action).
```

### `.github/workflows/weekly-instagram-proposal.yml`

```yaml
on:
  schedule:
    - cron: '0 9 * * 1'   # Monday 09:00 UTC
  workflow_dispatch:

permissions:
  contents: write   # to commit images

jobs:
  propose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm install
      - run: npx tsx scripts/propose-weekly-post.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore(posts): add weekly Instagram proposal"
          file_pattern: "public/posts/**"
```

## Secrets needed (GH repo settings)

- `SUPABASE_URL` (exists)
- `SUPABASE_SERVICE_KEY` (exists)
- `ANTHROPIC_API_KEY` (new) — create at console.anthropic.com (needs billing)
- `SLACK_WEBHOOK_URL` (new in this repo; same value as hip-webapp, stored in its Supabase Edge Function secrets)

No Canva secrets — image is rendered in code.

## Brand assets (already in repo, no setup needed)

- Logo: `public/logo-sm-sq.png` (640×640 square, good for IG).
- Colors: primary `hsl(215 95% 58%)`, accent `hsl(24 95% 53%)` (from `src/styles/global.css` `@theme`).
- Status badge colors mirror existing site convention (`src/pages/claims.astro`):
  Evidence Supports → green, Evidence Disproves → red, Inconclusive → amber.

## Caption prompt design

Anthropic call uses few-shot prompt from `scripts/lib/caption-examples.json`. Seeded with generic on-brand examples derived from the brand voice; replace later with real past captions from `My Drive/Wow-Health/Communications/Material/*`. System prompt enforces:
- ≤180 chars
- Plain, neutral tone
- Mirror brand voice ("Studies reviewed are not focused on tissue healing and the effect is weak")
- No emojis, no hashtags
- Bold key phrase identifier (return as markdown, render in archive page only)

## Archive page rendering

`/posts` lists all proposals chronologically with thumbnail grid (Instagram-style). `/posts/<slug>` shows full-size image + caption + link back to claim evidence page. Data source: scan `public/posts/*/metadata.json` at build time in `src/lib/loadPosts.ts`. Re-uses existing nightly Astro build — no new build pipeline.

## Verification

1. **Dry run locally:**
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... \
   SLACK_WEBHOOK_URL=... npx tsx scripts/propose-weekly-post.ts
   ```
   Confirm: file written to `public/posts/`, Slack message posted, DB row inserted.

2. **Workflow dispatch:** trigger `workflow_dispatch` manually before enabling cron. Verify commit lands on default branch.

3. **Archive render:** `npm run dev` → visit `/posts` → see new card. Visit detail page → image + caption render.

4. **Idempotency:** run script twice in a row. Second run should pick a different claim or exit cleanly (no duplicate row, no Slack spam).

5. **Failure modes to test:**
   - Anthropic API error → script exits non-zero, Slack not posted, no DB row, no commit.
   - No eligible claims → script exits 0 with Slack info message "no candidates this week".

## Open items before implementation

- [x] Canva tier — N/A, image rendered in code (no Enterprise).
- [x] Few-shot captions — seeded generic; refine later with real ones.
- [x] Push target — `main` on `Health-Integrity-Project/hip-webapp-archive` is **not** branch-protected; direct push via git-auto-commit-action works.
- [ ] Apply `instagram_posts` migration to Supabase (SQL provided in `scripts/migrations/`). Can also land as a PR in `hip-webapp`.
- [ ] Add `ANTHROPIC_API_KEY` + `SLACK_WEBHOOK_URL` to `.env.local` and GH repo secrets.

## Out of scope (MVP)

- Auto-posting to Instagram (needs Meta Graph API + Business account verification).
- Slack interactive buttons (approve/skip). Human reviews + posts manually.
- Multi-image carousels (latest posts are single-image per user direction).
- A/B caption variants.
