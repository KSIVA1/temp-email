// A domain is not a page identity. Ambiguous breadcrumbs need an explicit,
// evidence-backed result binding; never apply homepage notes to a deep result.
export const normalizeText = s => String(s ?? '').replace(/''/g, "'").replace(/\s+/g, ' ').trim();
export function displayedDestination(dom, title) {
  const lines = dom.split('\n');
  const at = lines.findIndex(l => l.includes('heading ') && normalizeText(l).includes(normalizeText(title)));
  return at < 0 ? null : lines.slice(at + 1, at + 6).find(l => /generic: https:\/\//.test(l))?.trim().replace(/^-\s*generic:\s*/, '') ?? null;
}
export function comparisonLabel(result, previous, researchOnly = false) {
  if (researchOnly) return 'Prior-date research only';
  if (!result.displayedDestination) return 'Destination unresolved';
  if (!previous) return 'No prior comparison';
  return previous.some(r => normalizeText(r.title) === normalizeText(result.title) &&
    normalizeText(r.displayedDestination) === normalizeText(result.displayedDestination))
    ? 'Same displayed result' : 'New or changed display';
}
export function exactUrl(value) {
  if (!/^https:\/\/\S+$/.test(value ?? '') || /[…]|\.\.\.|›/.test(value)) return null;
  try { const u = new URL(value); return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search; } catch { return null; }
}
export function findReview(notes, query, result) {
  return notes.filter(n => n.query === query && ['reviewed','unavailable'].includes(n.status)).find(n => {
    const exact = exactUrl(result.displayedDestination);
    if (exact && exact === exactUrl(n.url)) return true;
    return result.displayedDestination && n.resultBinding?.displayedDestination &&
      n.resultBinding?.resolvedUrl === n.url && n.resultBinding?.evidence &&
      normalizeText(n.resultBinding.title) === normalizeText(result.title) &&
      normalizeText(n.resultBinding.displayedDestination) === normalizeText(result.displayedDestination);
  }) ?? null;
}
export function selectResearchPage(records, query) {
  for (const r of records) {
    if (r.errors.length) continue;
    const page = r.source?.observations?.find(o => o.query === query)?.pages?.find(p => p.page === 1);
    if (page?.organicWebResultsVerified && page.results?.length) return { ...r, page };
  }
  return null;
}
