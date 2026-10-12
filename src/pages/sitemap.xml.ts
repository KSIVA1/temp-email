import type { APIRoute } from 'astro';
import { editorialDates } from '~/data/editorial-dates';
import { canonicalUrl } from '~/lib/seo';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const paths = Object.entries(editorialDates);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths.map(([path, date]) => `  <url><loc>${canonicalUrl(path, site)}</loc><lastmod>${date}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
