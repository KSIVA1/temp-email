import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { emailQaCases } from '../src/data/email-qa';
import { handleEmail } from '../workers/inboxfornow-api/src/email';
import { handleHttp } from '../workers/inboxfornow-api/src/api';
import { createTestEnv, incomingEmail } from '../workers/inboxfornow-api/test/helpers';

describe('Published synthetic email QA fixtures', () => {
  for (const fixture of emailQaCases) {
    it(`${fixture.file}: matches the documented receiving and retrieval results`, async () => {
      const env = createTestEnv();
      const now = Date.now();
      await env.DB.exec("INSERT INTO domains (name, status, added_at, last_inbound_at) VALUES ('example.com', 'active', 1000, null)");
      await env.DB.prepare('INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind('inb_fixture', 'test-recipient', 'example.com', now, now + 600_000).run();
      const raw = await readFile(new URL(`../public/fixtures/email-qa/${fixture.file}`, import.meta.url), 'utf8');
      // No SMTP, production inbox, sender account or external network is used.
      const delivery = incomingEmail({ to: 'test-recipient@example.com', from: 'sender@example.com', raw });
      await handleEmail(delivery, env);
      expect(delivery.rejection).toBeNull();
      expect(env.DB.table('messages')).toHaveLength(1);
      const [stored] = env.DB.table('messages');
      expect(stored.subject).toBe(fixture.subject);
      expect(stored.from_email).toBe('sender@example.com');
      expect(stored.otp).toBe(fixture.otp);
      expect(stored.body_html).toBe(fixture.html);
      expect(stored.preview).toBe(fixture.preview);

      const response = await handleHttp(new Request('https://api.inboxfornow.com/api/inbox/inb_fixture/messages', {
        headers: { Origin: 'https://inboxfornow.com' },
      }), env);
      expect(response.status).toBe(200);
      const result = await response.json() as { messages: { bodyHtml: string; otp: string }[] };
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({ bodyHtml: fixture.html, otp: fixture.otp });
      expect(JSON.stringify(stored)).not.toContain('SYNTHETIC_ATTACHMENT_ONLY');
      expect(JSON.stringify(result)).not.toContain('SYNTHETIC_ATTACHMENT_ONLY');
      if (fixture.file === 'signup-rendering-limits.eml') {
        expect(raw).toContain('Content-Disposition: attachment; filename="synthetic-note.txt"');
        expect(raw).toContain('SYNTHETIC_ATTACHMENT_ONLY');
        expect(stored.body_html).not.toMatch(/<(?:img|style|script|form)\b|style=|class=/i);
      }
    });
  }
});
