# Evidence Decoded Archive

Static snapshot site for all health claim evidence pages from [Evidence Decoded](https://healthintegrityproject.org). Rebuilt nightly from Supabase. Deployed to Netlify.

## Stack

- [Astro 5](https://astro.build) — static site generator
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com) — data source (read-only at build time)
- [Netlify](https://netlify.com) — hosting

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

Create `.env` at repo root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

Get these from Supabase → Project Settings → API.
Use the **service_role** key (not anon) — build fetches all claims server-side.

> **Warning:** Never commit `.env`. It is gitignored by default.

### 3. Run dev server

```bash
npm run dev
```

Starts at `http://localhost:4321`. Fetches live data from Supabase on each page load.

### 4. Build and preview static output

```bash
npm run build    # outputs to dist/
npm run preview  # serves dist/ locally
```

`preview` matches what Netlify deploys — use it to verify static output before pushing.

## Deployment

### Netlify setup (one-time)

1. Connect repo to Netlify via the dashboard or `netlify link`
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variables in Netlify → Site Settings → Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

### GitHub secrets (for nightly CI)

Add these in GitHub → repo → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role |
| `NETLIFY_AUTH_TOKEN` | Netlify → User Settings → Personal access tokens |
| `NETLIFY_SITE_ID` | Netlify → Site Settings → General → Site ID |

### Nightly rebuild

`.github/workflows/nightly-build.yml` runs at **03:00 UTC daily**. It:

1. Fetches all claims from Supabase
2. Builds static HTML
3. Deploys to Netlify production

Trigger manually via GitHub → Actions → Nightly Build and Deploy → Run workflow.

## Project structure

```
src/
  components/
    PublicationList.astro   # reusable publication card list
  layouts/
    Base.astro              # shared HTML shell, header, footer
  lib/
    fetchClaimEvidence.ts   # Supabase query functions
    supabase.ts             # Supabase client
    types.ts                # shared TypeScript types
  pages/
    index.astro             # claim index
    claims/[slug]/
      evidence.astro        # per-claim evidence page
  styles/
    global.css
netlify.toml                # Netlify build + redirect + security headers
.github/workflows/
  nightly-build.yml         # scheduled rebuild + deploy
```
