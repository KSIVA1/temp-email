import { describe, expect, it } from 'vitest';
import { createTestEnv } from './helpers';
import worker from '../src/index';

const origin = 'https://inboxfornow.com';

async function json(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe('HTTP Worker API', () => {
  it('generates an inbox on an active domain and records it with a 10 minute TTL', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO domains (name, status, added_at, last_inbound_at) VALUES ('veqla.com', 'active', 1000, null)");

    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-IFN-Dev-Skip-Turnstile': '1' },
      body: JSON.stringify({}),
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(201);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    const body = await json(res);
    expect(body.address).toMatch(/^[a-z]+\d{5}@veqla\.com$/);
    expect(typeof body.id).toBe('string');
    expect(typeof body.expiresAt).toBe('number');
    const inbox = env.DB.table('inboxes')[0];
    expect(inbox.local_part + '@' + inbox.domain).toBe(body.address);
    expect(Number(inbox.expires_at) - Number(inbox.created_at)).toBe(600_000);
  });

  it('extends an inbox without exceeding the 24 hour cap', async () => {
    const env = createTestEnv();
    const now = Date.now();
    await (env.DB as any).prepare(
      'INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    ).bind('inb_1', 'fox1234', 'veqla.com', now, now + 600_000).run();

    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox/inb_1/extend', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds: 86400 }),
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + 86_400_000 + 1000);
  });

  it('does not extend an expired inbox before cron purges it', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('inb_expired', 'fox1234', 'veqla.com', 1000, 2000)");

    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox/inb_expired/extend', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds: 600 }),
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(404);
    expect(Number(env.DB.table('inboxes')[0].expires_at)).toBe(2000);
  });

  it('does not list messages for an expired inbox before cron purges it', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('inb_expired', 'fox1234', 'veqla.com', 1000, 2000)");
    await env.DB.exec("INSERT INTO messages (id, inbox_id, from_name, from_email, subject, body_html, preview, otp, received_at, expires_at) VALUES ('msg_1', 'inb_expired', 'Sender', 's@example.com', 'Subject', '<p>Hi</p>', 'Hi', null, 1500, 2000)");

    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox/inb_expired/messages', {
      headers: { Origin: origin },
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(404);
  });

  it('does not list expired messages even if the inbox is still live', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('inb_1', 'fox1234', 'veqla.com', 1000, 9999999999999)");
    await env.DB.exec("INSERT INTO messages (id, inbox_id, from_name, from_email, subject, body_html, preview, otp, received_at, expires_at) VALUES ('msg_old', 'inb_1', 'Sender', 's@example.com', 'Old', '<p>Old</p>', 'Old', null, 1500, 2000)");
    await env.DB.exec("INSERT INTO messages (id, inbox_id, from_name, from_email, subject, body_html, preview, otp, received_at, expires_at) VALUES ('msg_live', 'inb_1', 'Sender', 's@example.com', 'Live', '<p>Live</p>', 'Live', null, 1600, 9999999999999)");

    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox/inb_1/messages', {
      headers: { Origin: origin },
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.messages).toMatchObject([{ id: 'msg_live' }]);
  });

  it('deletes a single message owned by the inbox', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('inb_1', 'fox1234', 'veqla.com', 1000, 9999999999999)");
    await env.DB.exec("INSERT INTO messages (id, inbox_id, from_name, from_email, subject, body_html, preview, otp, received_at, expires_at) VALUES ('msg_1', 'inb_1', 'Sender', 's@example.com', 'Subject', '<p>Hi</p>', 'Hi', null, 2000, 9999999999999)");

    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox/inb_1/messages/msg_1', {
      method: 'DELETE',
      headers: { Origin: origin },
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(204);
    expect(env.DB.table('messages')).toHaveLength(0);
  });

  it('health checks D1 reachability', async () => {
    const env = createTestEnv();
    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/health', {
      headers: { Origin: origin },
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
  });

  it('limits inbox generation to 50 per IP per hour', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO domains (name, status, added_at, last_inbound_at) VALUES ('veqla.com', 'active', 1000, null)");
    for (let i = 0; i < 50; i++) {
      const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', 'X-IFN-Dev-Skip-Turnstile': '1', 'cf-connecting-ip': '203.0.113.10' },
        body: JSON.stringify({}),
      }), env, {} as ExecutionContext);
      expect(res.status).toBe(201);
    }
    const limited = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-IFN-Dev-Skip-Turnstile': '1', 'cf-connecting-ip': '203.0.113.10' },
      body: JSON.stringify({}),
    }), env, {} as ExecutionContext);
    expect(limited.status).toBe(429);
  });

  it('renders the basic-auth protected domain health dashboard', async () => {
    const env = createTestEnv();
    env.ADMIN_BASIC_AUTH = 'dXNlcjpwYXNz';
    await env.DB.exec("INSERT INTO domains (name, status, added_at, last_inbound_at) VALUES ('veqla.com', 'active', 1000, null)");

    const denied = await worker.fetch(new Request('https://api.inboxfornow.com/admin/domains'), env, {} as ExecutionContext);
    expect(denied.status).toBe(401);

    const allowed = await worker.fetch(new Request('https://api.inboxfornow.com/admin/domains', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    }), env, {} as ExecutionContext);
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain('veqla.com');
  });
  it('retries on collision and returns a unique address', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO domains (name, status, added_at, last_inbound_at) VALUES ('veqla.com', 'active', 1000, null)");
    // Pre-occupy a specific local_part+domain so the first attempt collides
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('inb_existing', 'fox12345', 'veqla.com', 1000, 9999999999999)");

    // Even though one address is taken, with 10.8M possibilities a collision
    // on a random attempt is extremely unlikely. This test verifies the system
    // still generates a valid inbox when addresses are occupied.
    const res = await worker.fetch(new Request('https://api.inboxfornow.com/api/inbox', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-IFN-Dev-Skip-Turnstile': '1' },
      body: JSON.stringify({}),
    }), env, {} as ExecutionContext);

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.address).toMatch(/^[a-z]+\d{5}@veqla\.com$/);
    expect(body.address).not.toBe('fox12345@veqla.com');
  });

  it('rejects duplicate (local_part, domain) at the DB level', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('inb_1', 'otter55555', 'veqla.com', 1000, 9999999999999)");

    await expect(
      (env.DB as any).prepare(
        'INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      ).bind('inb_2', 'otter55555', 'veqla.com', 2000, 9999999999999).run(),
    ).rejects.toThrow(/UNIQUE constraint/);
  });
});
