#!/usr/bin/env node
/**
 * Check public DNS for MVP domains (NS, MX, apex).
 * Usage: node infra/scripts/verify-dns.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, '../config.json'), 'utf8'));

/** @param {string} domain @param {string} type */
function dig(domain, type) {
  try {
    return execSync(`dig @1.1.1.1 +short ${type} ${domain}`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

let failed = false;

console.log('DNS verification\n');

for (const domain of config.namecheapDomains) {
  const ns = dig(domain, 'NS');
  const onCf = ns.includes('cloudflare.com');
  console.log(`${domain} NS: ${ns || '(none)'}`);
  if (!onCf) {
    console.log(`  ⚠ nameservers not on Cloudflare yet`);
    failed = true;
  } else {
    console.log('  ✓ Cloudflare nameservers');
  }
}

const mx = dig(config.receivingDomain, 'MX');
console.log(`\n${config.receivingDomain} MX:\n${mx || '(none)'}`);
const mxHosts = mx.split('\n').map((line) => line.split(/\s+/).pop()?.replace(/\.$/, '')).filter(Boolean);
const expected = new Set(config.expectedMxHosts);
const mxOk = mxHosts.length > 0 && mxHosts.every((h) => expected.has(h));
if (mxOk) {
  console.log('  ✓ Cloudflare Email Routing MX');
} else {
  console.log(`  ⚠ expected: ${config.expectedMxHosts.join(', ')}`);
  console.log('  Run: npm run infra:email-routing');
  failed = true;
}

const api = dig(config.apiHostname, 'A') || dig(config.apiHostname, 'AAAA') || dig(config.apiHostname, 'CNAME');
console.log(`\n${config.apiHostname}: ${api || '(not configured)'}`);
if (!api) {
  console.log('  ⚠ deploy worker + add custom domain (see workers/inboxfornow-api/wrangler.toml)');
}

process.exit(failed ? 1 : 0);
