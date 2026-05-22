import { describe, expect, it } from 'vitest';
import { createTestEnv, incomingEmail } from './helpers';
import worker from '../src/index';

describe('Email Worker', () => {
  it('rejects catch-all mail for unknown inboxes', async () => {
    const env = createTestEnv();
    const message = incomingEmail({
      to: 'missing@veqla.com',
      from: 'sender@example.com',
      raw: 'Subject: Hello\r\n\r\nBody',
    });

    await worker.email(message, env, {} as ExecutionContext);

    expect(message.rejection).toBe('Inbox not found or expired');
    expect(env.DB.table('messages')).toHaveLength(0);
  });

  it('parses, sanitizes, rewrites links, extracts OTP, and drops attachments', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO domains (name, status, added_at, last_inbound_at) VALUES ('veqla.com', 'active', 1000, null)");
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('inb_1', 'fast-fox-1234', 'veqla.com', 1000, 9999999999999)");
    const raw = [
      'From: Test Sender <sender@example.com>',
      'To: fast-fox-1234@veqla.com',
      'Subject: Your code',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Verification code: 418229</p><script>alert(1)</script><img src="https://track.example/pixel.png"><a href="javascript:alert(1)">bad</a><a href="https://example.com/ok">ok</a>',
    ].join('\r\n');

    await worker.email(incomingEmail({ to: 'fast-fox-1234@veqla.com', from: 'sender@example.com', raw }), env, {} as ExecutionContext);

    const [message] = env.DB.table('messages');
    expect(message.otp).toBe('418229');
    expect(message.body_html).not.toContain('<script');
    expect(message.body_html).not.toContain('<img');
    expect(message.body_html).not.toContain('javascript:');
    expect(message.body_html).toContain('/r?u=https%3A%2F%2Fexample.com%2Fok');
    expect(env.DB.table('domains')[0].last_inbound_at).toBeGreaterThan(1000);
  });
});
