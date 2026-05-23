#!/usr/bin/env node
import { spawn } from 'child_process';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, '../workers/inboxfornow-api');

console.log("Starting Cloudflare log stream. Listening for live email provisioning events...\n");

const wranglerTail = spawn('npx', ['wrangler', 'tail', '--format', 'json'], {
  cwd: apiDir,
  shell: false
});

const rl = readline.createInterface({
  input: wranglerTail.stdout
});

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

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    
    // Scan all console logs inside this worker invocation
    for (const log of (data.logs || [])) {
      for (const msg of log.message) {
        if (typeof msg === 'string' && msg.includes('inbox-generate')) {
          const payload = JSON.parse(msg);
          const eventTime = new Date(log.timestamp || data.eventTimestamp);
          const localTime = formatter.format(eventTime);
          
          console.log(`[${localTime}] ID: ${payload.inboxId.padEnd(40)} | Domain: ${payload.domain}`);
        }
      }
    }
  } catch (err) {
    // Silently skip non-JSON or parsing errors
  }
});

wranglerTail.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg && !msg.includes('Wrangler detected')) {
    console.warn(`[Wrangler] ${msg}`);
  }
});

wranglerTail.on('close', (code) => {
  console.log(`Log stream stopped (Exit code: ${code})`);
});
