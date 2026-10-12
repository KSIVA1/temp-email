# Verified address QR codes — October 11, 2026

The prior goal turn made concrete progress by publishing inbox reload retention, honest loading states and stale-response isolation. This continuation addresses the next source-confirmed product defect from the worklog. A functional tool supports the site's usefulness; this is not proof of a ranking effect.

## Evidence and change

The existing QR renderer generated a pseudorandom SVG with finder-like corners. It did not encode the selected address. The production SVG saved as `.seo-cache/research/2026-10-11/qr-before.svg` returned no decoded value in the independent decoder.

Replaced it with local QR encoding using [qrcode-generator](https://www.npmjs.com/package/qrcode-generator?activeTab=code), following the package's maintained API documentation. The generator is loaded on demand when the QR control is opened. The code contains the plain email address only: no mailbox identifier, access URL or message content. Its caption makes that distinction clear. It follows address changes and closes when the inbox expires.

The SVG retains a white quiet zone and black modules in both themes, at a 160px displayed size. The surrounding panel and caption remain readable at a measured 390px viewport without horizontal page overflow. This does not promise compatibility with every camera or scanning application.

## Independent verification

[jsQR](https://github.com/cozmo/jsQR/blob/master/README.md) is a separate decoder used only in tests; it is not imported into the product. Tests rasterize the generated SVG with Sharp, then decode the pixels and compare the exact address. The six QR cases cover normal addresses, a plus tag, short addresses, changed addresses, and rejection of URLs, inbox identifiers, markup and loading text. All 19 inbox/QR tests passed, as did the static build, SEO checks and strict TypeScript checks.

Browser evidence also verifies actual rendered output, not only the encoder function. The replacement's SVG and screenshot regions in dark desktop, light desktop and light phone views decoded to `rook39250@veqla.com`. Changing the inbox with the QR panel open updated its accessible label and SVG; the new code decoded to `cobra13046@veqla.com`. The browser reported no console errors or warnings.

Original full screenshots, SVGs and decoder results are in `.seo-cache/research/2026-10-11/qr-*`. The initial screenshot filenames `qr-preview-light.png` and `qr-preview-dark.png` were reversed because the previous local theme persisted; `qr-preview-metadata.json` records their actual themes. The first browser screenshot clip targeted the wrong page region; corrected pixel regions were extracted from the saved full viewport screenshots using the recorded DOM coordinates. The originals are retained. Final verified regions are named `qr-decoded-dark-desktop.png`, `qr-decoded-light-desktop.png` and `qr-decoded-light-mobile.png`. `qr-decode.json` contains the decoder outputs.

## Publication and follow-up

Published to Cloudflare Pages as **b3c6a70a.inboxfornow.pages.dev**, serving inboxfornow.com. The first QR deployment was `cf8e5555`; the final deployment adds bundled third-party notices without changing the verified application assets. The notices are available on production with HTTP 200. The live browser opened the QR feature without console warnings or errors, and an independently decoded region of the actual production screenshot returned the selected address `eagle20117@veqla.com`. Original screenshot, DOM, SVG and decoder evidence are saved as `.seo-cache/research/2026-10-11/qr-live*` and `qr-decode.json`.

The post-QR snapshot `snapshot-111202.json` passed 31 sitemap pages, robots access, 10 declared assets and both service probes. GSC's existing RefreshError is unchanged. No ranking observations were replaced or invented. Today's preserved primary-query evidence remains first-page absence; the first-page goal and daily automation remain active. The next SEO priority is a focused review of an existing platform guide using current primary sources, followed by the planned discovery review after a crawl interval.
