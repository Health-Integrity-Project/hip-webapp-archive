# SEO Plan — Remaining Phases (4–6)

Status as of 2026-06-15. Phases 1–3 done (see git history). This doc tracks
remaining work for later assessment.

Canonical domain: `https://open.healthintegrityproject.org`
Build: GitHub Actions (`.github/workflows/nightly-build.yml`, cron `0 3 * * *`)
→ `netlify-cli deploy --dir=dist`. Env (SUPABASE_URL, SUPABASE_SERVICE_KEY,
NETLIFY_*) from GH Actions secrets.

Data source: Supabase. Key tables: `claims`, `publications`,
`publication_scores`, `expert_stats`, `claim_links`.

## Done (1–3) — reference
- Phase 1: `public/_redirects` archive.*→open.* 301. Canonical/og/JSON-LD/robots
  all open.*.
- Phase 2: sitemap lastmod key trailing-slash fix; changefreq/priority
  (home daily/1.0, claims weekly/0.8) in `astro.config.mjs` serialize.
- Phase 3: ratings map Inconclusive→Unproven; ClaimReview itemReviewed.appearance;
  MedicalScholarlyArticle per publication; Person per reviewer. Builders in
  `src/lib/structuredData.ts`, wired in `src/pages/claims/[slug]/evidence.astro`.
- Status distribution: 24 True / 34 False / 46 Unproven / 119 Awaiting Evidence
  (Awaiting Evidence → Unverified, correctly excluded from rich results).

---

## Phase 4 — Content / structural fixes

### 4a. Truncated slugs — BLOCKED, needs decision
- Slugs truncated ~95 chars in Supabase source (e.g. `...risks-of-dea/`,
  `...alzhe/`). Look low-quality, may dedupe poorly.
- CONFLICT: out-of-scope says "do not change Supabase data layer." Fixing slugs
  at source violates that.
- Options to decide:
  1. Leave slugs as-is (accept truncation). Lowest effort, ignores task.
  2. Add a build-time slug-remap layer in Astro (clean slug derived from title,
     ≤60–80 chars at word boundary) + `_redirects` 301 from old truncated slug
     to new. Keeps Supabase untouched. RECOMMENDED if slugs must change.
  3. Change Supabase slug column (out of scope unless user lifts constraint).
- If option 2: getStaticPaths emits clean slug; need old→new map for redirects;
  ClaimReview url / canonical / sitemap all use new slug.

### 4b. Per-claim page content (in scope — structural)
File: `src/pages/claims/[slug]/evidence.astro`
- [x] One unique <h1> = claim title (already present).
- [ ] Plain-language 40–60 word summary near top (featured-snippet bait).
      Source: `claim.description` exists but may be long/missing. Decide:
      truncate description vs require a dedicated summary field.
- [ ] "What the evidence shows" body section (synthesize from pub stances?
      data has supporting/contradicting/neutral split already).
- [ ] Internal links to ≥3 related claims. Relatedness source:
      `broad_category` and/or `labels` (both on Claim type). Build "Related
      claims" block querying same category.
- [ ] Visible "Last updated" date (have `updated_at`; currently only build date
      shown). Render claim.updated_at.

### 4c. Topic hub pages (in scope — structural)
- New route `src/pages/topics/[topic].astro` from `broad_category` (and/or
  `labels`). Aggregate claims in category + intro text.
- Hub URL pattern: `/topics/<slug>/`. Add to sitemap serialize branch
  (monthly/0.6 per CLAUDE.md).
- Intro text per topic: generic template or hand-written? Decide. No new claim
  content allowed, but topic intro = navigational copy, likely OK.
- Link hubs from home; link claims → their hub. Achieves ≤3-click reachability.

### 4d. Crawl depth
- Ensure every claim reachable from home in ≤3 clicks (home → topic hub →
  claim, or home → claim list → claim). Verify after hubs built.

---

## Phase 5 — Performance + crawlability

- [ ] Lighthouse on representative claim page. Targets LCP <2.5s, CLS <0.1.
- [ ] Images: width/height attrs, lazy loading, descriptive alt. Audit
      PublicationList + any avatars.
- [ ] Hero image per claim ≥1200px for Google Discover. SOURCE UNKNOWN — claims
      have no hero image field. Decide: generate (OG-style) vs skip. Likely
      folds into dynamic OG image below.
- [ ] Verify HTTP 200 (not soft-404) for canonical URLs. Note: page does
      `Astro.redirect('/')` when claim missing — fine for static (those paths
      not generated). Confirm no 200-soft-404.
- [ ] Dynamic OG image per claim. Astro: `astro-og-canvas` or satori-based.
      Adds og:image to Base.astro (currently NO og:image at all — gap).
      Base.astro also missing twitter:card tags.

### Known Base.astro gaps (carry into Phase 5)
- No `og:image` / `twitter:card` / `twitter:title` etc.
- og:type default 'article' fine for claims; home should be 'website'.

---

## Phase 6 — Search Console prep

- [ ] Add `<meta name="google-site-verification" content="...">` placeholder in
      `src/layouts/Base.astro` <head>, value from env var so user drops token
      without code change. e.g. `import.meta.env.PUBLIC_GSC_TOKEN`.
- [ ] README: document GSC verification + sitemap submission steps
      (submit `https://open.healthintegrityproject.org/sitemap-index.xml`).

---

## Cross-cutting open decisions (collect answers before resuming)
1. Slugs: option 1/2/3 above? (Supabase constraint vs SEO need.)
2. Summary source: truncate `claim.description` vs dedicated field?
3. Topic intro copy: template vs hand-written (and is it "new content"?)?
4. Hero/OG images: generate dynamic OG per claim (covers both Discover + social)?
5. Person `sameAs` (ORCID/PubMed/LinkedIn) — when links available, add to
   `buildPersonSchema` in structuredData.ts.

## Verify commands
    curl -sL -A "Mozilla/5.0" https://open.healthintegrityproject.org/claims/<slug>/evidence/ \
      | grep -iE "<title|canonical|og:|ClaimReview|reviewRating|Person|ScholarlyArticle"
    curl -s https://open.healthintegrityproject.org/sitemap-0.xml | head -40
    https://search.google.com/test/rich-results?url=<page-url>
    https://validator.schema.org/
