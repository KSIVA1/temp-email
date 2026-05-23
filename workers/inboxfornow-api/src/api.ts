import type { DomainRow, Env, InboxRow, MessageRow } from './types';

const DEFAULT_TTL_SECONDS = 600;
const MAX_TTL_MS = 86_400_000;
const ALLOWED_EXTENSIONS = new Set([600, 3600, 86400]);
const ANIMALS = [
  'fox', 'heron', 'otter', 'wren', 'pine', 'crane', 'badger', 'lynx',
  'sparrow', 'marten', 'rook', 'vole', 'dove', 'wolf', 'bear', 'eagle',
  'hawk', 'finch', 'robin', 'swift', 'falcon', 'osprey', 'raven', 'jay',
  'owl', 'hare', 'mole', 'shrew', 'stoat', 'ferret', 'bison', 'moose',
  'elk', 'deer', 'stag', 'ram', 'goat', 'lamb', 'puma', 'tiger',
  'lion', 'panther', 'jaguar', 'cobra', 'viper', 'gecko', 'newt', 'toad',
  'frog', 'salmon', 'trout', 'bass', 'pike', 'perch', 'carp', 'cod',
  'tuna', 'seal', 'whale', 'walrus', 'panda', 'koala', 'sloth', 'lemur',
  'chimp', 'gibbon', 'tapir', 'camel', 'llama', 'alpaca', 'zebra', 'rhino',
  'hippo', 'gator', 'iguana', 'parrot', 'macaw', 'toucan', 'stork', 'ibis',
  'egret', 'pelican', 'puffin', 'tern', 'gull', 'lark', 'pipit', 'dingo',
  'jackal', 'hyena', 'mink', 'orca', 'ray', 'squid', 'clam', 'snail',
  'crab', 'moth', 'beetle', 'ant', 'wasp', 'cricket', 'mantis', 'cicada',
  'coral', 'starling', 'magpie', 'thrush', 'oriole', 'bunting', 'plover',
  'curlew', 'avocet', 'gannet', 'grouse', 'quail', 'pheasant', 'condor',
  'kite', 'ermine', 'bobcat', 'coyote', 'emu', 'kiwi', 'skunk',
];

export async function handleHttp(request: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: await health(env) }, 200, cors);
    if (url.pathname === '/admin/domains' && request.method === 'GET') return adminDomains(request, env);
    if (url.pathname === '/api/domains/active' && request.method === 'GET') return listActiveDomains(env, cors);
    if (url.pathname === '/api/inbox' && request.method === 'POST') return createInbox(request, env, cors);

    const match = url.pathname.match(/^\/api\/inbox\/([^/]+)(?:\/(messages|extend))?(?:\/([^/]+))?$/);
    if (match) {
      const [, inboxId, resource, messageId] = match;
      if (!resource && request.method === 'GET') return getInbox(inboxId, env, cors);
      if (!resource && request.method === 'DELETE') return deleteInbox(inboxId, env, cors);
      if (resource === 'messages' && request.method === 'GET') return listMessages(inboxId, url, env, cors);
      if (resource === 'messages' && messageId && request.method === 'DELETE') return deleteMessage(inboxId, messageId, env, cors);
      if (resource === 'extend' && request.method === 'POST') return extendInbox(inboxId, request, env, cors);
    }

    return json({ error: 'Not found' }, 404, cors);
  } catch (error) {
    console.log(JSON.stringify({ event: 'api-error', error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Internal error' }, 500, cors);
  }
}

async function adminDomains(request: Request, env: Env): Promise<Response> {
  if (!isAdminAuthorized(request, env)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="InboxForNow admin"' },
    });
  }
  const domains = await env.DB.prepare('SELECT * FROM domains ORDER BY name').all<DomainRow>();
  const since = Date.now() - 86_400_000;
  const rows = [];
  for (const domain of domains.results) {
    const count = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE received_at > ? AND inbox_id IN (SELECT id FROM inboxes WHERE domain = ?)',
    ).bind(since, domain.name).first<{ count: number }>();
    rows.push({ ...domain, inbound24h: count?.count ?? 0 });
  }
  const body = `<!doctype html><html><head><title>InboxForNow domain health</title></head><body><h1>Domain health</h1><table><thead><tr><th>Domain</th><th>Status</th><th>Last inbound</th><th>24h inbound</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.status)}</td><td>${row.last_inbound_at ? new Date(row.last_inbound_at).toISOString() : 'never'}</td><td>${row.inbound24h}</td></tr>`).join('')}</tbody></table></body></html>`;
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function createInbox(request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const rateLimited = await applyRateLimit(request, env);
  if (rateLimited) return json({ error: 'Rate limited' }, 429, cors);

  const turnstileOk = await verifyTurnstile(request, env);
  if (!turnstileOk) return json({ error: 'Turnstile verification failed' }, 403, cors);

  const domain = await pickActiveDomain(env);
  if (!domain) return json({ error: 'No active receiving domains' }, 503, cors);

  const now = Date.now();
  const expiresAt = now + DEFAULT_TTL_SECONDS * 1000;
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const localPart = generateLocal();
    const id = `inb_${crypto.randomUUID()}`;
    try {
      await env.DB.prepare(
        'INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(id, localPart, domain.name, now, expiresAt).run();

      console.log(JSON.stringify({ event: 'inbox-generate', inboxId: id, domain: domain.name }));
      return json({ id, address: `${localPart}@${domain.name}`, expiresAt }, 201, cors);
    } catch (err) {
      if (isUniqueViolation(err)) {
        console.log(JSON.stringify({ event: 'inbox-collision', attempt, domain: domain.name }));
        continue;
      }
      throw err;
    }
  }

  return json({ error: 'Could not generate a unique address. Please try again.' }, 503, cors);
}

async function listActiveDomains(env: Env, cors: HeadersInit): Promise<Response> {
  const rows = await env.DB.prepare("SELECT name FROM domains WHERE status = 'active' ORDER BY name").all<{ name: string }>();
  return json({ domains: rows.results.map((row) => row.name) }, 200, cors);
}

async function getInbox(id: string, env: Env, cors: HeadersInit): Promise<Response> {
  const inbox = await env.DB.prepare('SELECT * FROM inboxes WHERE id = ? AND expires_at > ?').bind(id, Date.now()).first<InboxRow>();
  if (!inbox) return json({ error: 'Inbox not found' }, 404, cors);
  return json({ id: inbox.id, address: `${inbox.local_part}@${inbox.domain}`, expiresAt: inbox.expires_at }, 200, cors);
}

async function listMessages(inboxId: string, url: URL, env: Env, cors: HeadersInit): Promise<Response> {
  const since = Number(url.searchParams.get('since') || 0);
  const rows = await env.DB.prepare(
    'SELECT id, from_name, from_email, subject, body_html, preview, otp, received_at FROM messages WHERE inbox_id = ? AND received_at > ? ORDER BY received_at DESC',
  ).bind(inboxId, since).all<MessageRow>();
  return json({
    messages: rows.results.map((row) => ({
      id: row.id,
      fromName: row.from_name,
      fromEmail: row.from_email,
      subject: row.subject,
      bodyHtml: row.body_html,
      preview: row.preview,
      otp: row.otp ?? undefined,
      receivedAt: row.received_at,
    })),
  }, 200, cors);
}

async function extendInbox(id: string, request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { seconds?: number };
  if (!ALLOWED_EXTENSIONS.has(Number(body.seconds))) return json({ error: 'Invalid extension' }, 400, cors);
  const inbox = await env.DB.prepare('SELECT * FROM inboxes WHERE id = ?').bind(id).first<InboxRow>();
  if (!inbox) return json({ error: 'Inbox not found' }, 404, cors);
  const base = Math.max(Date.now(), inbox.expires_at);
  const expiresAt = Math.min(base + Number(body.seconds) * 1000, Date.now() + MAX_TTL_MS);
  await env.DB.prepare('UPDATE inboxes SET expires_at = ? WHERE id = ?').bind(expiresAt, id).run();
  await env.DB.prepare('UPDATE messages SET expires_at = ? WHERE inbox_id = ?').bind(expiresAt, id).run();
  return json({ expiresAt }, 200, cors);
}

async function deleteInbox(id: string, env: Env, cors: HeadersInit): Promise<Response> {
  await env.DB.prepare('DELETE FROM messages WHERE inbox_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM inboxes WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204, headers: cors });
}

async function deleteMessage(inboxId: string, messageId: string, env: Env, cors: HeadersInit): Promise<Response> {
  await env.DB.prepare('DELETE FROM messages WHERE inbox_id = ? AND id = ?').bind(inboxId, messageId).run();
  return new Response(null, { status: 204, headers: cors });
}

async function pickActiveDomain(env: Env): Promise<DomainRow | null> {
  const rows = await env.DB.prepare("SELECT * FROM domains WHERE status = 'active'").all<DomainRow>();
  if (rows.results.length === 0) return null;
  return rows.results[Math.floor(Math.random() * rows.results.length)];
}

async function health(env: Env): Promise<boolean> {
  await env.DB.prepare('SELECT 1').first();
  return true;
}

async function applyRateLimit(request: Request, env: Env): Promise<boolean> {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const key = `inbox:${ip}`;
  const hourlyLimited = await applyHourlyD1RateLimit(key, env);
  if (hourlyLimited) return true;
  if (!env.INBOX_GENERATION_RATE_LIMITER) return false;
  const { success } = await env.INBOX_GENERATION_RATE_LIMITER.limit({ key });
  return !success;
}

async function applyHourlyD1RateLimit(key: string, env: Env): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / 3_600_000) * 3_600_000;
  const row = await env.DB.prepare('SELECT key, window_start, count FROM rate_limits WHERE key = ?').bind(key).first<{ key: string; window_start: number; count: number }>();
  if (!row || row.window_start !== windowStart) {
    await env.DB.prepare('INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)').bind(key, windowStart, 1).run();
    return false;
  }
  if (row.count >= 50) return true;
  await env.DB.prepare('UPDATE rate_limits SET count = ? WHERE key = ?').bind(row.count + 1, key).run();
  return false;
}

async function verifyTurnstile(request: Request, env: Env): Promise<boolean> {
  if (request.headers.get('X-IFN-Dev-Skip-Turnstile') === '1' && env.DEV_SKIP_TURNSTILE === '1') return true;
  if (!env.TURNSTILE_SECRET_KEY) return true;
  const body = await request.clone().json().catch(() => ({})) as { turnstileToken?: string };
  if (!body.turnstileToken) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', body.turnstileToken);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const result = await res.json() as { success?: boolean };
  return !!result.success;
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const allowedOrigins = (env.CORS_ORIGIN || 'https://inboxfornow.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin');
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-IFN-Dev-Skip-Turnstile',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function isAdminAuthorized(request: Request, env: Env): boolean {
  if (!env.ADMIN_BASIC_AUTH) return false;
  return request.headers.get('Authorization') === `Basic ${env.ADMIN_BASIC_AUTH}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function generateLocal(): string {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${animal}${num}`;
}

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('unique') || msg.includes('constraint');
}
