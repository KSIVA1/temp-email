export interface Env {
  DB: D1Database;
  INBOX_GENERATION_RATE_LIMITER?: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
  TURNSTILE_SECRET_KEY?: string;
  CORS_ORIGIN?: string;
  DEV_SKIP_TURNSTILE?: string;
  ADMIN_BASIC_AUTH?: string;
}

export type InboxRow = {
  id: string;
  local_part: string;
  domain: string;
  created_at: number;
  expires_at: number;
};

export type MessageRow = {
  id: string;
  inbox_id: string;
  from_name: string;
  from_email: string;
  subject: string;
  body_html: string;
  preview: string;
  otp: string | null;
  received_at: number;
  expires_at: number;
};

export type DomainRow = {
  name: string;
  status: 'active' | 'burned' | 'warming';
  added_at: number;
  last_inbound_at: number | null;
};
