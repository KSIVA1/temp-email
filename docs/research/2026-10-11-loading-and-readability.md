# Loading and readability review — October 11, 2026

The previous goal turn published the Discord guide. This continuation measured the primary inbox page before selecting a change. It does not treat page-speed scores as rankings.

## Current lab evidence

The unauthenticated PageSpeed API request returned HTTP 429 (quota), preserved as `.seo-cache/research/2026-10-11/pagespeed-mobile-1129.json`. Google's public web interface successfully ran a new analysis at 11:29 AM CDT. [Original report](https://pagespeed.web.dev/analysis/https-inboxfornow-com/oh32kol62t?form_factor=mobile).

| Metric | Mobile | Desktop |
|---|---|---|
| Performance | 96 | 100 |
| Accessibility | 96 | 96 |
| Best practices | 100 | 100 |
| SEO checks | 100 | 100 |
| First contentful paint | 1.6 seconds | 0.3 seconds |
| Largest contentful paint | 2.3 seconds | 0.4 seconds |
| Total blocking time | 0 ms | 0 ms |
| Cumulative layout shift | 0 | 0.001 |

These are individual Lighthouse 13.5.0 lab observations, with slow-4G Moto G Power emulation on mobile and custom throttling on desktop. The report showed **No Data** for field experience. Lab measurements do not prove a field Core Web Vitals pass, production INP or a ranking effect. Google notes that the [lab and field sources differ](https://developers.google.com/speed/docs/insights/v5/about).

The report estimated 80 ms of mobile savings from render-blocking CSS and 0 ms on desktop. Its 10.5 KiB legacy-JavaScript estimate belongs to Cloudflare's externally supplied `beacon.min.js`, not the application bundle. These observations do not justify a broad loading rewrite or removal of existing measurement. Static build-size measurements are retained separately in `homepage-resource-sizes.json`; their gzip/Brotli sizes are estimates, not actual network transfers or load timings.

## Finding and fix

The report identified insufficient contrast on uppercase labels, the address label, expiry timer, platform suitability labels and footer text. These elements communicate actual operating limits. Darkened the shared muted-text color and timer foreground in the light theme, and brightened muted text in the dark theme. This preserves the existing visual design while improving readability.

It also flagged a dialog role assigned to an `article` element. Changed that panel to a `div` and attached its accessible name to the visible message subject. This is a markup correction; it does not constitute a complete keyboard or assistive-technology audit. [WAI-ARIA dialog naming guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Validation

Build, SEO and diff checks passed: 33 HTML files, 31 sitemap URLs, 490 internal links. The fix adds no scripts or dependencies. Browser measurements sampled 17 relevant text elements in each theme using rendered foreground/background colors. The lowest ratio was 5.30:1 in light and 5.90:1 in dark, above the [4.5:1 criterion for ordinary text](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). The saved samples establish these particular combinations, not a blanket accessibility claim. Phone layout remained 390px wide at a 390px viewport. Dialog markup uses a compatible element with the message subject as its label.

Original lab DOM and screenshots, expanded audit findings, computed colors and contrast calculations are under `.seo-cache/research/2026-10-11/pagespeed-*` and `contrast-*`. Local preview displayed the honest API-unavailable state; production validation follows publication. Editorial modification dates remain unchanged because this pass alters shared styling/semantics rather than article content.

## Publication and next action

Published Cloudflare Pages deployment **bc973cd6.inboxfornow.pages.dev** to inboxfornow.com. A new [post-deployment PageSpeed report](https://pagespeed.web.dev/analysis/https-inboxfornow-com/l0fyeafo72?form_factor=mobile) at 11:33 AM CDT reports **100 accessibility on both mobile and desktop**, resolving the reported contrast and role findings. Performance is 97 mobile and 100 desktop; best-practices and SEO checks are 100 for both. Mobile lab FCP is 1.5 seconds, LCP 2.3 seconds, total blocking time 0 ms and layout shift 0. Field data is still unavailable. Performance differences between these single runs should not be attributed to the color/markup change.

Production browser verification confirmed the corrected text/timer colors, dialog element and label, and a real generated inbox without console warnings/errors. Original production proof: `contrast-live.md` and `contrast-live.png`. The post-deployment snapshot `snapshot-113318.json` passed 31 sitemap pages, robots access, 10 declared assets and both read-only service probes. The monitor exits nonzero for the same known GSC RefreshError, not a crawl failure.

The known GSC authorization gap and today's original ranking evidence remain unchanged. Keep the first-page goal active, assess the substantive content changes after their crawl interval, and investigate relevant independent discovery opportunities next. A full manual dialog-keyboard review remains separate from these specific automated findings.
