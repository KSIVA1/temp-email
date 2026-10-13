import { readdir, readFile, access } from 'node:fs/promises';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';
import { canonicalUrl } from '../src/lib/seo.ts';

const site = new URL('https://inboxfornow.com/');
assert.equal(canonicalUrl('/privacy', site), 'https://inboxfornow.com/privacy/');
assert.equal(canonicalUrl('/use-case/github/', site), 'https://inboxfornow.com/use-case/github/');
assert.equal(canonicalUrl('/', site), site.href);

const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith('.html')) files.push(file);
  }
}
await walk('dist');
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const listed = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
assert.equal(new Set(listed).size, listed.length, 'Duplicate sitemap URLs');
const indexable = [];
const titles = new Set();
let checkedLinks = 0;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const path = relative('dist', file).replace(/index\.html$/, '');
  const expected = new URL(path, site).href;
  const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)];
  assert.equal(canonical.length, 1, `${file}: must have one canonical`);
  const noindex = /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html);
  if (!noindex) {
    assert.equal(canonical[0][1], expected, `${file}: canonical must match deployed route`);
    indexable.push(expected);
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    assert.ok(title && !titles.has(title), `${file}: missing or duplicate title`);
    titles.add(title);
    assert.ok(/<meta\b[^>]*name="description"[^>]*content="[^"]+"/.test(html), `${file}: missing description`);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${file}: must have one H1`);
    assert.ok(html.includes('property="og:url" content="' + expected + '"'), `${file}: inconsistent OG URL`);
  }
  for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
    const data = JSON.parse(match[1]);
    assert.equal(data['@context'], 'https://schema.org', `${file}: invalid schema context`);
  }
  for (const match of html.matchAll(/<a\b[^>]*href="(\/[^"?#]*)/g)) {
    const target = match[1];
    if (target.startsWith('//')) continue;
    const local = join('dist', target.slice(1), target.endsWith('/') ? 'index.html' : '');
    await access(local).catch(() => assert.fail(`${file}: broken internal link ${target}`));
    checkedLinks++;
  }
}
assert.deepEqual([...listed].sort(), indexable.sort(), 'Sitemap must match indexable built pages');
for (const entry of sitemap.matchAll(/<url><loc>(.*?)<\/loc><lastmod>(.*?)<\/lastmod><\/url>/g)) {
  assert.match(entry[2], /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entry[2] <= new Date().toISOString().slice(0, 10), 'Modification dates cannot be in the future');
}
const home = await readFile('dist/index.html', 'utf8');
assert.ok(!home.includes('fonts.googleapis.com'), 'Fonts must not depend on an external stylesheet');
const fonts = [...home.matchAll(/href="([^"]+\.woff2)"/g)];
assert.ok(fonts.length > 0, 'Preload the local text font');
for (const [, font] of fonts) await access(join('dist', font));
for (const [url, status, tag] of [
  ['https://inboxfornow.com/', 200, null],
  ['https://inboxfornow.pages.dev/', 200, 'noindex, follow'],
  ['https://preview.inboxfornow.pages.dev/use-case/github/', 200, 'noindex, follow'],
  ['https://inboxfornow.com/r/?u=https://example.com/', 200, 'noindex, follow'],
  ['https://inboxfornow.com/404.html', 200, 'noindex, follow'],
  ['https://inboxfornow.com/missing/', 404, 'noindex, follow'],
  ['https://inboxfornow.com/fixtures/email-qa/signup-plain.eml', 200, 'noindex, follow'],
]) {
  const response = await worker.fetch(new Request(url), { ASSETS: { fetch: async () => new Response('page', { status }) } });
  assert.equal(response.status, status);
  assert.equal(response.headers.get('X-Robots-Tag'), tag, url);
}
for (const file of ['signup-plain.eml', 'signup-alternative.eml', 'signup-rendering-limits.eml']) {
  const raw = await readFile(join('dist/fixtures/email-qa', file));
  assert.deepEqual(raw, await readFile(join('public/fixtures/email-qa', file)), 'Publish the exact tested fixture');
  const response = await worker.fetch(new Request(`https://inboxfornow.com/fixtures/email-qa/${file}`), { ASSETS: { fetch: async () => new Response(raw) } });
  assert.equal(response.headers.get('Content-Type'), 'message/rfc822');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment');
}
const redirect = await worker.fetch(new Request('https://www.inboxfornow.com/privacy/?utm_source=audit'), {});
assert.equal(redirect.status, 301);
assert.equal(redirect.headers.get('Location'), 'https://inboxfornow.com/privacy/?utm_source=audit');
console.log(`SEO checks passed: ${files.length} HTML files, ${listed.length} sitemap URLs, ${checkedLinks} internal links; preview, utility and 404 indexing headers verified.`);
