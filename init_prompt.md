You are working in /Users/lpantano/Code/Apps/hip-webapp-archive.                                                                          
                                                                                                                                            
  ## Starting state                                                                                                                         
  Static Astro site with its own layout and styles. A reference app lives at ../hip-webapp.                                                 
                                                                                                                                            
  ## Task                                                                                                                                   
  1. Read 
  2. the layout, color tokens, and typography from ../hip-webapp. Focus on:                                                            
     - Global CSS / Tailwind config (colors, fonts, spacing scale)                                                                          
     - Root layout component(s) — header, footer, nav, page wrapper
     - Any design tokens or CSS variables defined                                                                                           
                                                                                                                                            
  3. Identify every layout component and style in hip-webapp-archive that diverges from what you found.                                     
                                                                                                                                            
  4. Apply the matching layout structure, color palette, and typography to hip-webapp-archive. Change only:                                 
     - src/layouts/                                                                                                                       
     - src/styles/                                                                                                                          
     - astro.config.mjs (if Tailwind theme config needs updating)                                                                         
     - Tailwind class names inside existing components                                                                                      
                                                                                                                                            
  ## Constraints                                                                                                                            
  - MUST NOT add new pages, routes, or features                                                                                             
  - MUST NOT install new dependencies unless a package present in ../hip-webapp is missing here                                             
  - MUST NOT change component logic, data fetching, or props                                                                                
  - MUST NOT touch src/lib/, src/pages/ content, or any TypeScript types                                                                    
  - Preserve all existing Astro component structure — only change visual classes and layout wrappers                                        
                                                                                                                                            
  ## Stop conditions                                                                                                                        
  - Stop and ask before deleting any file                                                                                                   
  - Stop and ask before modifying astro.config.mjs in a way that changes build output format                                              
  - Stop and ask if ../hip-webapp uses a design system or component library not present here                                                
                                                                                                                                            
  ## Done when                                                                                                                              
  `npm run build` passes and the archive site visually matches the hip-webapp color palette, header/footer structure, and typography. No new
   TypeScript errors introduced.                                                                                                            
                                                                                                                                          
  🎯 Target: Claude Code · 💡 Scoped to layout/style files only with explicit do-not-touch list and stop gates to prevent logic or route    
  changes.         



You are a senior full-stack engineer. Complete the deployment setup for this Astro static site that archives health claim evidence pages from a Supabase   
  database. The site already builds correctly — you are adding Netlify config and a GitHub Actions nightly rebuild workflow only.                            
   
  ## Project state                                                                                                                                           
                  
  - Stack: Astro 5.7 (output: static), Tailwind CSS 4, @supabase/supabase-js 2.55                                                                            
  - Site URL: https://archive.healthintegrityproject.org
  - Build command: `npm run build` → outputs to `dist/`                                                                                                      
  - Env vars required at build time: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`                                                                                  
  - Repo is on GitHub. Netlify deployment is the target host.                                                                                                
                                                                                                                                                             
  ## Tasks — complete ALL of these, in order                                                                                                                 
                                                                                                                                                             
  ### 1. Create `netlify.toml` at repo root                                                                                                                  
                  
  Requirements:                                                                                                                                              
  - Build command: `npm run build`
  - Publish directory: `dist`                                                                                                                                
  - Node version: 20
  - Set `[build.environment]` with `NODE_VERSION = "20"` — do NOT hardcode secret values
  - Add a `[[redirects]]` rule: any path not matched → `/index.html`, status 200 (SPA-style fallback for static Astro)                                       
  - Add security headers via `[[headers]]` for `/*`:                                                                                                         
    - `X-Frame-Options: DENY`                                                                                                                                
    - `X-Content-Type-Options: nosniff`                                                                                                                      
    - `Referrer-Policy: strict-origin-when-cross-origin`                                                                                                     
                  
  ### 2. Create `.github/workflows/nightly-build.yml`                                                                                                        
                  
  Requirements:
  - Trigger: `schedule` cron `0 3 * * *` (03:00 UTC daily) AND `workflow_dispatch` (manual trigger)
  - Runner: `ubuntu-latest`                                                                                                                                  
  - Steps in order:
    1. Checkout repo (`actions/checkout@v4`)                                                                                                                 
    2. Setup Node 20 (`actions/setup-node@v4` with `cache: 'npm'`)                                                                                           
    3. Install deps: `npm ci`                                                                                                                                
    4. Build: `npm run build`                                                                                                                                
       - Env: `SUPABASE_URL: ${{ secrets.SUPABASE_URL }}` and `SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}`                                    
    5. Deploy to Netlify using `netlify/actions/cli@master`:                                                                                                 
       - Run: `npx netlify-cli deploy --prod --dir=dist`                                                                                                     
       - Env: `NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}` and `NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}`                                  
  - Job name: `build-and-deploy`                                                                                                                             
  - Concurrency group: `deploy-${{ github.ref }}` with `cancel-in-progress: true`                                                                            
                                                                                                                                                             
  ### 3. Refactor `src/pages/claims/[slug]/evidence.astro` — eliminate duplication                                                                           
                                                                                                                                                             
  The supporting, contradicting, and neutral publication list sections are copy-pasted three times with only color differences. Extract a reusable `.astro`  
  component at `src/components/PublicationList.astro` that accepts:
  - `publications: Publication[]`                                                                                                                            
  - `scores: PublicationScore[]`
  - `experts: ExpertProfile[]`                                                                                                                               
  - `stanceColor: 'teal' | 'orange' | 'gray'`
  - `label: string`                                                                                                                                          
                  
  The component renders the section heading (with colored accent bar + badge) and the list of publication cards with expert review blocks. Replace all three 
  sections in `evidence.astro` with `<PublicationList />` calls.
                                                                                                                                                             
  Color mapping for `stanceColor`:
  - `teal` → accent bar `bg-teal-500`, badge `bg-teal-700 text-teal-100`, hover `hover:text-teal-400`
  - `orange` → accent bar `bg-orange-500`, badge `bg-orange-700 text-orange-100`, hover `hover:text-orange-400`                                              
  - `gray` → accent bar `bg-gray-500`, badge `bg-gray-700 text-gray-200`, hover `hover:text-gray-300`
                                                                                                                                                             
  Preserve ALL existing Tailwind classes, color palette, and dark-theme styling exactly — do not change any visual output.                                   
                                                                                                                                                             
  ## Constraints                                                                                                                                             
                  
  - NEVER hardcode `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NETLIFY_AUTH_TOKEN`, or `NETLIFY_SITE_ID` — always read from GitHub secrets                      
  - Do NOT modify `astro.config.mjs`, `src/lib/`, `src/layouts/`, `src/styles/`, or `package.json`
  - Do NOT add authentication, analytics, or any feature not listed above                                                                                    
  - After each file is written, output: ✅ [filename] done                                                                                                   
                                                                                                                                                             
  ## Stop and ask before                                                                                                                                     
                                                                                                                                                             
  - Deleting any existing file                                                                                                                               
  - Modifying any file not listed in the tasks above                                                                                                         
  - Adding any dependency to `package.json`         
                                                                                                                                                             
  ## Done when    
                                                                                                                                                             
  1. `netlify.toml` exists at repo root with correct build config, redirect, and security headers
  2. `.github/workflows/nightly-build.yml` exists with schedule, manual trigger, build, and Netlify deploy steps                                             
  3. `src/components/PublicationList.astro` exists and all three stance sections in `evidence.astro` use it     
  4. Zero visual difference to the rendered pages                                                                                                            
                                                                                                                                                             
  ---                                                                                                                                                        
  🎯 Target: Claude Code — claude CLI or Claude Code IDE extension                                                                                           
  💡 Scoped to three concrete deliverables (Netlify config, GH Actions, component refactor) with explicit stop conditions and secret-safety guards to prevent
   credential leaks or unintended file edits.                                                                                                                
                                                                                                                                                             
  Setup note: Before running, add four GitHub repo secrets: SUPABASE_URL, SUPABASE_SERVICE_KEY, NETLIFY_AUTH_TOKEN, and NETLIFY_SITE_ID. Get NETLIFY_SITE_ID
  from Netlify → Site Settings → General → Site ID. Get NETLIFY_AUTH_TOKEN from Netlify → User Settings → Personal access tokens.                            
                  