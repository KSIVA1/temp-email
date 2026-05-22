#!/usr/bin/env node
/**
 * Verify Namecheap API credentials and list configured domains.
 * Usage: node infra/scripts/namecheap-verify.mjs
 */
import { loadDotEnv, REPO_ROOT } from '../lib/env.mjs';
import { loadNamecheapCreds, getDomainInfo } from '../lib/namecheap.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadDotEnv();
const config = JSON.parse(readFileSync(resolve(REPO_ROOT, 'infra/config.json'), 'utf8'));
const creds = loadNamecheapCreds();

console.log(`Namecheap API (${creds.sandbox ? 'sandbox' : 'production'}) — checking domains…\n`);

for (const domain of config.namecheapDomains) {
  try {
    const xml = await getDomainInfo(domain, creds);
    const created = xml.match(/<DomainGetInfoResult[^>]*Created="([^"]+)"/)?.[1] ?? 'unknown';
    const expires = xml.match(/<DomainGetInfoResult[^>]*Expires="([^"]+)"/)?.[1] ?? 'unknown';
    console.log(`  ✓ ${domain} — created ${created}, expires ${expires}`);
  } catch (err) {
    console.error(`  ✗ ${domain} — ${err.message}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error('\nFix API access: whitelist ClientIp, enable API, check credentials in repo-root `.env`.');
} else {
  console.log('\nNamecheap API OK.');
}
