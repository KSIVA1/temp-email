#!/usr/bin/env node
/**
 * Unlock Email Routing DNS and set catch-all → Worker via Cloudflare API.
 * Wrangler CLI only supports forward/drop for catch-all; the REST API supports worker.
 * Usage: node infra/scripts/setup-email-routing.mjs [--dry-run]
 */
import { loadDotEnv, requireEnv } from '../lib/env.mjs';
import {
  loadConfig,
  getZone,
  unlockEmailRoutingDns,
  getCatchAllRule,
  setCatchAllWorker,
} from '../lib/cloudflare.mjs';

const dryRun = process.argv.includes('--dry-run');
loadDotEnv();
requireEnv('CLOUDFLARE_API_TOKEN');

const config = loadConfig();
const { receivingDomain, workerName } = config;

function isWorkerCatchAll(rule) {
  const action = rule?.actions?.[0];
  return (
    rule?.enabled &&
    action?.type === 'worker' &&
    Array.isArray(action.value) &&
    action.value.includes(workerName)
  );
}

console.log(`Email Routing (API) for ${receivingDomain} → worker ${workerName}`);
console.log('');

const zone = await getZone(receivingDomain);
if (!zone) {
  console.error(`No Cloudflare zone for ${receivingDomain}. Run: npm run infra:cf-add-zones`);
  process.exit(1);
}

if (dryRun) {
  console.log(`[dry-run] PATCH /zones/${zone.id}/email/routing/dns (unlock MX)`);
  console.log(
    `[dry-run] PUT catch_all actions=[{type:worker,value:[${workerName}]}] enabled=true`,
  );
  process.exit(0);
}

try {
  console.log('→ Unlock Email Routing DNS (MX records)');
  await unlockEmailRoutingDns(zone.id);
  console.log('  ✓ MX unlock requested');
} catch (err) {
  console.log(`  ⚠ DNS unlock skipped: ${err.message}`);
  console.log('    (OK if MX already unlocked or routing not enabled yet)');
}

console.log('→ Set catch-all → worker');
let rule;
try {
  rule = await setCatchAllWorker(zone.id, workerName);
} catch (err) {
  if (String(err.message).includes('Authentication error')) {
    console.error(
      '  ✗ API token lacks Email Routing Rules permission. Recreate CLOUDFLARE_API_TOKEN with',
    );
    console.error('    Zone → Email Routing Rules → Edit (see infra/env.example).');
  }
  throw err;
}
console.log(`  ✓ catch-all enabled=${rule.enabled} action=${rule.actions?.[0]?.type}`);

const current = await getCatchAllRule(zone.id);
if (isWorkerCatchAll(current)) {
  console.log(`  ✓ verified: catch-all → ${workerName}`);
} else {
  console.error('  ✗ catch-all rule does not match expected worker action');
  process.exit(1);
}
