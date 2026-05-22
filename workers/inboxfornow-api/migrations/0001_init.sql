CREATE TABLE IF NOT EXISTS inboxes (
  id TEXT PRIMARY KEY,
  local_part TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  inbox_id TEXT NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  preview TEXT NOT NULL,
  otp TEXT NULL,
  received_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  name TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'burned', 'warming')),
  added_at INTEGER NOT NULL,
  last_inbound_at INTEGER NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_inbox_received ON messages(inbox_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inboxes_expires_at ON inboxes(expires_at);

INSERT OR IGNORE INTO domains (name, status, added_at, last_inbound_at)
VALUES ('veqla.com', 'active', unixepoch() * 1000, null);
