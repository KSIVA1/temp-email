import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import assert from 'node:assert/strict';
import { evaluateGoal } from './lib/seo-goal.mjs';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(resolve(root, 'docs/seo-targets.json'), 'utf8'));
const daily = resolve(root, '.seo-cache/daily');
const format = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year:'numeric', month:'2-digit', day:'2-digit' });
const today = format.format(new Date());
const summaries = [];
for (const day of (await readdir(daily)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()) {
  let data;
  try { data = JSON.parse(await readFile(resolve(daily, day, 'rankings.json'), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') continue; throw e; }
  assert.equal(data.date, day, `${day}: date mismatch`);
  assert.equal(data.country, config.country);
  assert.equal(data.language, config.language);
  assert.equal(data.device, config.device);
  assert.equal(data.source, 'Google browser');
  assert.deepEqual(data.results.map(x=>x.query).sort(), [...config.primaryQueries].sort(), `${day}: include every primary query once`);
  for (const result of data.results) {
    const date = new Date(result.observedAt);
    assert.ok(!Number.isNaN(+date) && format.format(date) === day && date <= new Date(), `${day}: invalid observation time`);
    const search = new URL(result.searchUrl);
    assert.equal(search.hostname, 'www.google.com');
    assert.equal(search.pathname, '/search');
    assert.equal(search.searchParams.get('q'), result.query);
    assert.equal(search.searchParams.get('gl'), 'us');
    assert.equal(search.searchParams.get('hl'), 'en');
    assert.equal(search.searchParams.get('pws'), '0');
    const evidencePath = resolve(daily, day, result.evidence);
    const local = relative(resolve(daily,day), evidencePath);
    assert.ok(local && local !== '..' && !local.startsWith('..' + sep) && !local.startsWith(sep), 'Evidence must be saved inside its dated folder');
    const evidence = await readFile(evidencePath, 'utf8');
    assert.ok(evidence.includes(result.query), 'Source must contain the exact query');
    assert.ok(result.locationEvidence && evidence.includes(result.locationEvidence), 'Preserve the visible US IP-derived location from the search footer');
    assert.ok(/, (?:[A-Z]{2}|United States)(?:\s*-|\s*$)/.test(result.locationEvidence), 'A US location must be verifiable');
    assert.ok(['observed','not_found_on_first_page','unavailable'].includes(result.status));
    if (result.status !== 'observed') assert.equal(result.rank, null, 'Absence/unknown has no exact rank');
    else {
      assert.ok(Number.isInteger(result.rank) && result.rank > 0);
      // Exact organic order and result-page number are distinct measurements.
      assert.equal(result.resultPage, 1, 'First-page achievement requires explicit resultPage: 1');
      assert.ok(!search.searchParams.has('start') || search.searchParams.get('start') === '0', 'Source must be the first result page');
      assert.equal(new URL(result.resultUrl).hostname, config.domain);
      assert.ok(evidence.includes(config.domain), 'Positive result must be present in preserved source');
      assert.ok(result.organicEvidence, 'Explain the counted organic results; exclude ads, AI and carousels');
    }
  }
  summaries.push({date:day,
    allPrimaryQueriesOnFirstPage:data.results.every(r=>r.status === 'observed' && r.resultPage === 1),
    allPrimaryQueriesRankOne:data.results.every(r=>r.status === 'observed' && r.rank === 1)});
}
const last = summaries.at(-1);
const verified = evaluateGoal(summaries, today);
const result = {evaluatedAt:new Date().toISOString(), target:config.goal, lastObservation:last || null, goalVerified:verified};
await writeFile(resolve(daily,'ranking-status.json'), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
