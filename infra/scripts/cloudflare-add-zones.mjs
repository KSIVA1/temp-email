#!/usr/bin/env node
/**
 * Add MVP domains as Cloudflare zones (idempotent).
 * Usage: node infra/scripts/cloudflare-add-zones.mjs [--dry-run]
 */
import { loadDotEnv } from '../lib/env.mjs';
import { loadConfig, getZone, createZone } from '../lib/cloudflare.mjs';

const dryRun = process.argv.includes('--dry-run');
loadDotEnv();
const config = loadConfig();

for (const domain of config.namecheapDomains) {
  const existing = await getZone(domain);
  if (existing) {
    console.log(`  ✓ ${domain} — zone ${existing.id}, NS: ${existing.name_servers.join(', ')}`);
    continue;
  }
  if (dryRun) {
    console.log(`[dry-run] would create zone ${domain}`);
    continue;
  }
  console.log(`Creating zone ${domain}…`);
  const zone = await createZone(domain);
  console.log(`  ✓ ${domain} — zone ${zone.id}, NS: ${zone.name_servers.join(', ')}`);
}

console.log('\nNext: npm run infra:namecheap:point-ns  (after .env has Namecheap + Cloudflare tokens)');
