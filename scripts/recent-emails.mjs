#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '../workers/inboxfornow-api');

try {
  const query = "SELECT local_part, domain, created_at, expires_at FROM inboxes ORDER BY created_at DESC LIMIT 10";
  const cmd = `npx wrangler d1 execute inboxfornow --remote --command "${query}" --json`;
  
  const stdout = execSync(cmd, { cwd: apiDir, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
  const response = JSON.parse(stdout);
  
  const results = response[0]?.results || [];
  if (results.length === 0) {
    console.log("No provisioned emails found.");
    process.exit(0);
  }

  console.log("\nMost Recent 10 Provisioned Emails (US/Central):\n");
  console.log("".padEnd(95, '-'));
  console.log(`${"Email Address".padEnd(38)} | ${"Created At (US/Central)".padEnd(25)} | ${"Expires At (US/Central)"}`);
  console.log("".padEnd(95, '-'));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  for (const row of results) {
    const email = `${row.local_part}@${row.domain}`;
    const createdStr = formatter.format(new Date(row.created_at));
    const expiresStr = formatter.format(new Date(row.expires_at));
    console.log(`${email.padEnd(38)} | ${createdStr.padEnd(25)} | ${expiresStr}`);
  }
  console.log("".padEnd(95, '-') + "\n");
} catch (error) {
  console.error("Error executing query or formatting results:", error.message);
  process.exit(1);
}
