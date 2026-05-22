#!/usr/bin/env node
/**
 * Point Namecheap domains at Cloudflare nameservers (from zone lookup or args).
 *
 * Usage:
 *   node infra/scripts/namecheap-point-ns.mjs
 *   node infra/scripts/namecheap-point-ns.mjs veqla.com ada.ns.cloudflare.com bob.ns.cloudflare.com
 *
 * Without NS args, reads nameservers from Cloudflare zones (requires CLOUDFLARE_API_TOKEN).
 */
import { loadDotEnv, requireEnv } from '../lib/env.mjs';
import { loadNamecheapCreds, setCustomNameservers } from '../lib/namecheap.mjs';
import { loadConfig, getZone } from '../lib/cloudflare.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
loadDotEnv();

const config = loadConfig();
const creds = loadNamecheapCreds();
const [, , domainArg, ...nsArgs] = process.argv.filter((a) => a !== '--dry-run');

/** @type {Record<string, string[]>} */
const nsByDomain = {};

if (domainArg && nsArgs.length >= 2) {
  nsByDomain[domainArg] = nsArgs;
} else {
  try {
    requireEnv('CLOUDFLARE_API_TOKEN');
  } catch {
    console.error('Set CLOUDFLARE_API_TOKEN in .env, or pass NS manually:');
    console.error('  node infra/scripts/namecheap-point-ns.mjs veqla.com ns1.example ns2.example');
    process.exit(1);
  }
  for (const domain of config.namecheapDomains) {
    const zone = await getZone(domain);
    if (!zone) {
      console.error(`No Cloudflare zone for ${domain}. Run: npm run infra:cf-add-zones`);
      process.exitCode = 1;
      continue;
    }
    nsByDomain[domain] = zone.name_servers;
    console.log(`${domain} → Cloudflare NS: ${zone.name_servers.join(', ')}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);

for (const [domain, nameservers] of Object.entries(nsByDomain)) {
  if (dryRun) {
    console.log(`[dry-run] would set ${domain} NS → ${nameservers.join(', ')}`);
    continue;
  }
  console.log(`Setting ${domain} nameservers…`);
  await setCustomNameservers(domain, nameservers, creds);
  console.log(`  ✓ ${domain} updated`);
}

console.log('\nPropagation can take up to 48h (often < 1h). Verify: npm run infra:verify-dns');
