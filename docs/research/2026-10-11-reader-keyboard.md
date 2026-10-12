# Message-reader keyboard review — October 11, 2026

## Finding and basis

The preceding readability pass corrected the dialog element and accessible name but did not test keyboard operation. Using synthetic local mail, Enter on a message opened the panel while focus fell to the document body. The next Tab focused a message button behind the modal. This reproduced a specific interaction defect. It is not evidence of a ranking cause or a complete accessibility audit.

The [WAI modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) calls for focus within an opened dialog, contained Tab navigation, Escape dismissal, and return to the invoking control or a suitable fallback. Applied these behaviors to the existing reader without changing its visual layout, titles or editorial dates.

## Implementation

- Keep the closed reader inert, focus its Close message button when opened, and make surrounding page regions inert while open. Restore their previous inert states and the prior body overflow on close.
- Cycle Tab and Shift+Tab across currently visible, enabled reader controls and message links. Resolve controls dynamically so hidden OTP areas and changing body content are handled.
- Restore focus to the current message button after Escape or Back. The mail renderer replaces DOM nodes, so a saved button reference is insufficient. After deletion, return focus to the Inbox heading; render the changed list before closing.
- Extend only the local synthetic fixture to support message deletion and a verification link. It binds to loopback and sends no email.

## Browser verification

At desktop width, Enter focused Close message. Forward traversal reached Show images, Delete, Copy code and the synthetic body link, then wrapped to Close message. Shift+Tab from Close message wrapped to the link. Escape restored the current message button. Deleting the synthetic message left zero message rows and focused the Inbox heading.

At 390×844, focus entry and reverse wrapping passed, with document width and scroll width both 390px. Expiring the synthetic inbox while the reader was open closed and inerted the reader, released background inertness, and focused the expiry action. Original screenshots, DOM and observations are under `.seo-cache/research/2026-10-11/reader-keyboard-*`. These checks establish the tested keyboard paths, not comprehensive assistive-technology compatibility or SMTP delivery.

All 19 existing inbox/QR tests, strict TypeScript, production build, SEO checks and diff checks passed. The production build was rebuilt without the fixture API override; no fixture host or synthetic message was present in dist.

## Publication and follow-up

Published **08bc36e2.inboxfornow.pages.dev** to inboxfornow.com. Production browser confirmed inert closed-reader markup, focusable fallback heading, a working generated inbox and no console warnings/errors. No production messages were opened or deleted. Proof: `reader-live-check.json`, `reader-live.md`, `reader-live.png`.

Post-deployment `snapshot-115424.json` passed 31 sitemap pages, robots access, 11 declared assets, API probes and receiving MX checks. The monitor's nonzero exit remains the known GSC RefreshError. The ranking validator at 16:54 UTC retained today's original observations and reported `goalVerified: false`; no same-day SERP rerun was used to seek a better position. The daily automation remains active. Next use primary sources to assess one remaining existing platform guide for concrete usefulness, preserving October 18 and November 8 content-assessment dates.
