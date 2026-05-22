import type { APIRoute } from 'astro';
import { platforms } from '~/data/platforms';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() || 'https://inboxfornow.com/').replace(/\/+$/, '/');

  const urls: { loc: string; priority: number; changefreq: string }[] = [
    { loc: base,                         priority: 1.0, changefreq: 'weekly' },
    { loc: `${base}use-case/`,           priority: 0.9, changefreq: 'weekly' },
    ...platforms.map((p) => ({
      loc: `${base}use-case/${p.slug}/`,
      priority: 0.7,
      changefreq: 'weekly',
    })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${u.loc}</loc>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority.toFixed(1)}</priority>\n` +
          `  </url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
