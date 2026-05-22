/**
 * Minimal Namecheap XML API client.
 * @see https://www.namecheap.com/support/api/methods/
 */

const PROD = 'https://api.namecheap.com/xml.response';
const SANDBOX = 'https://api.sandbox.namecheap.com/xml.response';

/** @param {string} domain */
export function splitDomain(domain) {
  const parts = domain.toLowerCase().split('.');
  if (parts.length < 2) throw new Error(`Invalid domain: ${domain}`);
  const tld = parts.pop();
  const sld = parts.join('.');
  return { sld, tld };
}

/**
 * @param {Record<string, string>} params
 * @param {{ apiUser: string, apiKey: string, username: string, clientIp: string, sandbox?: boolean }} creds
 */
export async function namecheapRequest(params, creds) {
  const base = creds.sandbox ? SANDBOX : PROD;
  const qs = new URLSearchParams({
    ApiUser: creds.apiUser,
    ApiKey: creds.apiKey,
    UserName: creds.username,
    ClientIp: creds.clientIp,
    ...params,
  });
  const res = await fetch(`${base}?${qs}`);
  const xml = await res.text();
  if (!res.ok) throw new Error(`Namecheap HTTP ${res.status}: ${xml.slice(0, 200)}`);
  return parseApiResponse(xml);
}

/** @param {string} xml */
function parseApiResponse(xml) {
  const status = xml.match(/<ApiResponse[^>]*\sStatus="([^"]+)"/)?.[1];
  const errors = [...xml.matchAll(/<Error Number="(\d+)"[^>]*>([^<]*)<\/Error>/g)].map((m) => ({
    number: m[1],
    message: m[2],
  }));
  if (status !== 'OK' || errors.length) {
    const msg = errors.map((e) => `${e.number}: ${e.message}`).join('; ') || 'Unknown API error';
    throw new Error(`Namecheap API error: ${msg}`);
  }
  return xml;
}

/** @param {string} domain */
export async function getDomainInfo(domain, creds) {
  return namecheapRequest(
    { Command: 'namecheap.domains.getInfo', DomainName: domain },
    creds,
  );
}

/** @param {string} domain */
export async function getDnsList(domain, creds) {
  const { sld, tld } = splitDomain(domain);
  return namecheapRequest(
    { Command: 'namecheap.domains.dns.getList', SLD: sld, TLD: tld },
    creds,
  );
}

/**
 * Point domain at Cloudflare (or any) custom nameservers.
 * @param {string} domain
 * @param {string[]} nameservers
 */
export async function setCustomNameservers(domain, nameservers, creds) {
  const { sld, tld } = splitDomain(domain);
  return namecheapRequest(
    {
      Command: 'namecheap.domains.dns.setCustom',
      SLD: sld,
      TLD: tld,
      Nameservers: nameservers.join(','),
    },
    creds,
  );
}

import { requireEnv } from './env.mjs';

export function loadNamecheapCreds() {
  const apiUser = requireEnv('NAMECHEAP_API_USER');
  return {
    apiUser,
    apiKey: requireEnv('NAMECHEAP_API_KEY'),
    username: process.env.NAMECHEAP_USERNAME?.trim() || apiUser,
    clientIp: requireEnv('NAMECHEAP_CLIENT_IP'),
    sandbox: process.env.NAMECHEAP_USE_SANDBOX === 'true',
  };
}
