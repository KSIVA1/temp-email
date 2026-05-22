import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://inboxfornow.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
