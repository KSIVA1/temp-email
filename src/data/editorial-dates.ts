import { platforms } from './platforms';

// Dates of substantive published content changes, never the time of a rebuild.
// Update only the affected routes when their visible content changes.
export const editorialDates: Record<string, string> = {
  '/': '2026-10-14',
  '/use-case/': '2026-10-13',
  // Inbox pages gained manual receiving checks and successful-check feedback.
  ...Object.fromEntries(platforms.map(p => [`/use-case/${p.slug}/`, '2026-10-14'])),
  '/use-case/notion/': '2026-10-17',
  '/use-case/spotify/': '2026-10-15',
  '/use-case/steam/': '2026-10-14',
  '/use-case/venmo/': '2026-10-13',
  '/privacy/': '2026-10-11',
  '/terms/': '2026-10-09',
  '/guides/': '2026-10-11',
  '/guides/email-not-arriving/': '2026-10-11',
  '/guides/testing-signup-emails/': '2026-10-16',
  '/about/': '2026-10-11',
};
