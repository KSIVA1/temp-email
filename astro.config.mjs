import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://inboxfornow.com',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
