import PostalMime from 'postal-mime';
import { detectOTP, previewFromHtml, sanitizeMessageHtml } from './mail';
import type { Env, InboxRow } from './types';

type EmailLike = ForwardableEmailMessage & {
  raw?: ReadableStream<Uint8Array> | ArrayBuffer | string;
};

export async function handleEmail(message: EmailLike, env: Env): Promise<void> {
  const to = message.to.toLowerCase();
  const [localPart, domain] = to.split('@');
  if (!localPart || !domain) {
    message.setReject('Invalid recipient');
    return;
  }

  const inbox = await env.DB.prepare(
    'SELECT * FROM inboxes WHERE lower(local_part) = ? AND lower(domain) = ? AND expires_at > ?',
  ).bind(localPart, domain, Date.now()).first<InboxRow>();
  if (!inbox) {
    message.setReject('Inbox not found or expired');
    return;
  }

  const parsed = await PostalMime.parse(await readRaw(message));
  const from = parseAddress(parsed.from?.address || message.from);
  const subject = parsed.subject || '(no subject)';
  const htmlSource = parsed.html || (parsed.text ? `<p>${escapeHtml(parsed.text)}</p>` : '<p></p>');
  const sanitized = sanitizeMessageHtml(htmlSource);
  const otp = detectOTP(sanitized.html);
  const now = Date.now();
  const id = `msg_${crypto.randomUUID()}`;

  await env.DB.prepare(
    'INSERT INTO messages (id, inbox_id, from_name, from_email, subject, body_html, preview, otp, received_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    inbox.id,
    parsed.from?.name || from.name,
    from.email,
    subject,
    sanitized.html,
    previewFromHtml(sanitized.html),
    otp,
    now,
    inbox.expires_at,
  ).run();
  await env.DB.prepare('UPDATE domains SET last_inbound_at = ? WHERE name = ?').bind(now, inbox.domain).run();

  console.log(JSON.stringify({
    event: 'message-received',
    inboxId: inbox.id,
    domain: inbox.domain,
    otpDetected: !!otp,
  }));
  console.log(JSON.stringify({
    event: 'sanitization-strip-count',
    inboxId: inbox.id,
    count: sanitized.stripCount,
  }));
}

async function readRaw(message: EmailLike): Promise<ArrayBuffer | string> {
  if (!message.raw) return '';
  if (typeof message.raw === 'string' || message.raw instanceof ArrayBuffer) return message.raw;
  return new Response(message.raw).arrayBuffer();
}

function parseAddress(address: string): { name: string; email: string } {
  return { name: address.split('@')[0] || 'Sender', email: address };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
