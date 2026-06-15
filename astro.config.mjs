import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const lastmodMap = {};
if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase.from('claims').select('slug, updated_at');
  if (data) {
    for (const claim of data) {
      // Sitemap <loc> emits trailing slash; key must match exactly.
      const url = `https://open.healthintegrityproject.org/claims/${claim.slug}/evidence/`;
      lastmodMap[url] = new Date(claim.updated_at);
    }
  }
}

export default defineConfig({
  output: 'static',
  integrations: [
    sitemap({
      serialize(item) {
        const isClaim = item.url.includes('/claims/');
        // Home: daily/1.0. Claim pages: weekly/0.8.
        item.changefreq = isClaim ? 'weekly' : 'daily';
        item.priority = isClaim ? 0.8 : 1.0;
        if (lastmodMap[item.url]) {
          item.lastmod = lastmodMap[item.url];
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
  site: 'https://open.healthintegrityproject.org',
});
