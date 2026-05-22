import { describe, expect, it } from 'vitest';
import { createTestEnv } from './helpers';
import worker from '../src/index';

describe('Cron Worker', () => {
  it('deletes expired messages and inboxes', async () => {
    const env = createTestEnv();
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('old', 'old', 'veqla.com', 1, 2)");
    await env.DB.exec("INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES ('live', 'live', 'veqla.com', 1, 9999999999999)");
    await env.DB.exec("INSERT INTO messages (id, inbox_id, from_name, from_email, subject, body_html, preview, otp, received_at, expires_at) VALUES ('old_msg', 'old', 'Sender', 's@example.com', 'Subject', '<p>Hi</p>', 'Hi', null, 1, 2)");

    await worker.scheduled({} as ScheduledController, env, {} as ExecutionContext);

    expect(env.DB.table('inboxes').map((row) => row.id)).toEqual(['live']);
    expect(env.DB.table('messages')).toHaveLength(0);
  });
});
