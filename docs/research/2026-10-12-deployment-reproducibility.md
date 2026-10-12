# Preserve the published SEO source — October 12, 2026

## Evidence and decision

The production site contained the October 9 and October 11 improvements, but the remote main branch at `90d57db` contained only the README correction. The README referenced SEO commands absent from that branch. The frontend workflow deploys main when application paths change, so a future checkout-based deployment could lose the current content, canonical controls and product fixes.

Reviewed the tracked diffs and explicitly selected the related new source, tests, monitoring configuration and research reports. Excluded ignored credentials, browser/ranking caches, generated output, dependencies and Python bytecode. Added a Python-bytecode ignore rule. No Worker implementation, infrastructure settings or unrelated scripts were changed.

## Fresh-checkout verification

Exported the committed baseline into a new local directory and overlaid only the reviewed source scope. No `.env`, cached build or existing node_modules was copied. `npm ci --no-audit --no-fund` installed the lockfile dependencies successfully. A production build generated 33 HTML files. All 69 output files matched the previously deployed build byte-for-byte by SHA-256, including identical relative paths.

`npm run check:seo` passed for 31 sitemap URLs and 517 internal links, including Worker indexing/redirect assertions and the two-day completion test. All 19 inbox/QR checks and eight offline DNS-monitor tests passed in the clean source directory. Existing credential literals were absent from the reviewed files. These checks support rebuild reproducibility; they do not establish Google rankings or full accessibility.

The existing repository deployment has the two required Cloudflare secret names configured. Its frontend workflow now includes build, SEO and inbox/QR gates. Publishing the reviewed source will trigger that workflow; record its actual result and deployment after completion rather than treating a Git push as deployment proof.

## Daily observations

October 12 snapshot `snapshot-090436.json` passed all 31 pages, robots, 10 declared assets, both API probes and receiving-domain DNS. Compared with the final October 11 snapshot, crawl and service status remain healthy and the known GSC RefreshError is unchanged.

Signed-out Google searches at desktop width used `gl=us`, `hl=en`, and `pws=0`. All three primary queries were absent from the first page; their exact ranks remain null. Each original DOM and screenshot is preserved under `.seo-cache/daily/2026-10-12/`. The visible locality was Phillips Creek Ranch, Frisco, TX, from the IP address. AI panels, secondary sitelinks and other modules were excluded. The ranking validator reports `goalVerified: false`.

No title, visible content, modification date, target keyword or completion definition was changed during this operational pass. Keep the existing daily automation active and assess the October 11 changes on October 18 and November 8.
