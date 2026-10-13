import { platforms } from './platforms';

// Dates of substantive published content changes, never the time of a rebuild.
// Update only the affected routes when their visible content changes.
export const editorialDates: Record<string, string> = {
  '/': '2026-10-11',
  '/use-case/': '2026-10-09',
  // These pages embed the inbox tool, whose visible lifecycle changed today.
  ...Object.fromEntries(platforms.map(p => [`/use-case/${p.slug}/`, '2026-10-11'])),
  '/privacy/': '2026-10-11',
  '/terms/': '2026-10-09',
  '/guides/': '2026-10-11',
  '/guides/email-not-arriving/': '2026-10-11',
  '/guides/testing-signup-emails/': '2026-10-13',
  '/about/': '2026-10-11',
};
