import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireEnv } from './env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
  const raw = readFileSync(resolve(__dirname, '../config.json'), 'utf8');
  return JSON.parse(raw);
}

const API = 'https://api.cloudflare.com/client/v4';

function headers() {
  return {
    Authorization: `Bearer ${requireEnv('CLOUDFLARE_API_TOKEN')}`,
    'Content-Type': 'application/json',
  };
}

/** @param {string} path */
async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(), ...init.headers } });
  const json = await res.json();
  if (!json.success) {
    const err = json.errors?.map((e) => e.message).join('; ') || res.statusText;
    throw new Error(`Cloudflare API: ${err}`);
  }
  return json.result;
}

/** @param {string} name */
export async function getZone(name) {
  const zones = await cf(`/zones?name=${encodeURIComponent(name)}`);
  return zones[0] ?? null;
}

/** @param {string} name */
export async function createZone(name) {
  const config = loadConfig();
  return cf('/zones', {
    method: 'POST',
    body: JSON.stringify({
      name,
      account: { id: process.env.CLOUDFLARE_ACCOUNT_ID || config.cloudflareAccountId },
      jump_start: false,
    }),
  });
}

/** @param {string} zoneId @param {Array<{type:string,name:string,content:string,proxied?:boolean,ttl?:number}>} records */
export async function upsertDnsRecords(zoneId, records) {
  const existing = await cf(`/zones/${zoneId}/dns_records?per_page=100`);
  for (const rec of records) {
    const match = existing.find(
      (e) => e.type === rec.type && e.name === rec.name && e.content === rec.content,
    );
    if (match) continue;
    const dup = existing.find((e) => e.type === rec.type && e.name === rec.name);
    if (dup) {
      await cf(`/zones/${zoneId}/dns_records/${dup.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...rec, ttl: rec.ttl ?? 1 }),
      });
    } else {
      await cf(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({ ...rec, ttl: rec.ttl ?? 1 }),
      });
    }
  }
}

/** @param {string} zoneId */
export async function enableEmailRouting(zoneId) {
  return cf(`/zones/${zoneId}/email/routing/enable`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** @param {string} zoneId */
export async function unlockEmailRoutingDns(zoneId) {
  return cf(`/zones/${zoneId}/email/routing/dns`, { method: 'PATCH' });
}

/** @param {string} zoneId */
export async function getCatchAllRule(zoneId) {
  return cf(`/zones/${zoneId}/email/routing/rules/catch_all`);
}

/** @param {string} zoneId @param {string} workerName */
export async function setCatchAllWorker(zoneId, workerName) {
  return cf(`/zones/${zoneId}/email/routing/rules/catch_all`, {
    method: 'PUT',
    body: JSON.stringify({
      actions: [{ type: 'worker', value: [workerName] }],
      matchers: [{ type: 'all' }],
      enabled: true,
      name: `Catch-all → ${workerName}`,
    }),
  });
}

/** @param {string} zoneId */
export async function listRedirectRulesets(zoneId) {
  return cf(`/zones/${zoneId}/rulesets?phase=http_request_dynamic_redirect`);
}

/** @param {string} zoneId @param {Array<unknown>} rules */
export async function createRedirectRuleset(zoneId, rules) {
  return cf(`/zones/${zoneId}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'default',
      kind: 'zone',
      phase: 'http_request_dynamic_redirect',
      rules,
    }),
  });
}

/** @param {string} zoneId @param {string} rulesetId @param {Object} rule */
export async function addRedirectRule(zoneId, rulesetId, rule) {
  return cf(`/zones/${zoneId}/rulesets/${rulesetId}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}
