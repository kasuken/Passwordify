// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build
export default defineConfig({
  site: 'https://passwordify.xyz',
  // Astro's HTML compressor strips whitespace-only text nodes between prose and
  // inline elements, which drops legitimate spaces before/after inline <span>s.
  compressHTML: false,
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Inline small stylesheets for fewer requests; keep the site fast & static.
    inlineStylesheets: 'auto',
  },
});
