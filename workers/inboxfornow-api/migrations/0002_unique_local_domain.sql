-- Prevent two active inboxes from sharing the same email address.
-- Expired inboxes are cleaned by the cron job, so this constraint
-- only blocks true concurrent duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inboxes_local_domain
  ON inboxes(local_part, domain);
