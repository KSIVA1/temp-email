#!/usr/bin/env node
/**
 * DNS records for inboxfornow.com → Cloudflare Pages (CNAME to pages.dev).
 * Run after the zone exists and nameservers point to Cloudflare.
 *
 * Usage: node infra/scripts/cloudflare-pages-dns.mjs [--dry-run]
 */
import { loadDotEnv } from '../lib/env.mjs';
import { loadConfig, getZone, upsertDnsRecords, listRedirectRulesets, createRedirectRuleset, addRedirectRule } from '../lib/cloudflare.mjs';

const dryRun = process.argv.includes('--dry-run');
loadDotEnv();
const { brandDomain, pagesProject } = loadConfig();

const zone = await getZone(brandDomain);
if (!zone) {
  console.error(`Zone not found: ${brandDomain}. Run infra:cf-add-zones first.`);
  process.exit(1);
}

const pagesTarget = `${pagesProject}.pages.dev`;
const records = [
  { type: 'CNAME', name: brandDomain, content: pagesTarget, proxied: true },
  { type: 'CNAME', name: `www.${brandDomain}`, content: pagesTarget, proxied: true },
];

if (dryRun) {
  console.log(`[dry-run] would upsert on ${brandDomain}:`, records);
  process.exit(0);
}

await upsertDnsRecords(zone.id, records);
console.log(`✓ ${brandDomain} and www → ${pagesTarget}`);

try {
  const rulesets = await listRedirectRulesets(zone.id);
  let ruleset = rulesets[0];
  if (!ruleset) {
    ruleset = await createRedirectRuleset(zone.id, []);
  }
  const hasRule = ruleset.rules?.some((r) =>
    r.expression?.includes(`www.${brandDomain}`) && r.action === 'redirect'
  );
  if (!hasRule) {
    await addRedirectRule(zone.id, ruleset.id, {
      expression: `(http.host eq "www.${brandDomain}")`,
      action: 'redirect',
      action_parameters: {
        from_value: {
          status_code: 301,
          preserve_query_string: true,
          target_url: {
            expression: `concat("https://${brandDomain}", http.request.uri.path)`,
          },
        },
      },
      description: `Redirect www.${brandDomain} to apex`,
      enabled: true,
    });
    console.log(`✓ Created redirect rule: www.${brandDomain} → ${brandDomain}`);
  } else {
    console.log(`✓ Redirect rule already exists: www.${brandDomain} → ${brandDomain}`);
  }
} catch (err) {
  console.warn(`⚠ Could not create redirect rule (token may lack Zone:Edit permission): ${err.message}`);
}

console.log('\nAlso run: npx wrangler pages project list');
console.log('Add custom domains in dashboard or: wrangler pages deployment (see infra/README.md)');
