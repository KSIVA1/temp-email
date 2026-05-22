import type { Env } from './types';

export async function handleScheduled(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM messages WHERE expires_at < ?').bind(now).run();
  await env.DB.prepare('DELETE FROM inboxes WHERE expires_at < ?').bind(now).run();

  const active = await env.DB.prepare("SELECT name, last_inbound_at FROM domains WHERE status = 'active'").all<{ name: string; last_inbound_at: number | null }>();
  if (active.results.length === 1) {
    const domain = active.results[0];
    if (!domain.last_inbound_at || now - domain.last_inbound_at > 21_600_000) {
      console.log(JSON.stringify({ event: 'domain-burned-flag', domain: domain.name, reason: 'single-domain-zero-inbound-6h' }));
    }
  }
}
