// Read-only connectivity checks. Does not create users, sessions, or records.
import { readFileSync } from 'node:fs';
const config = { ...process.env };
try {
  for (const line of readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !config[match[1]]) config[match[1]] = match[2];
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const url = config.VITE_SUPABASE_URL;
const key = config.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
if (!key.startsWith('sb_publishable_')) throw new Error('Use a publishable key');
if (new URL(url).protocol !== 'https:') throw new Error('HTTPS required');
const headers = { apikey: key };
const settings = await fetch(`${url}/auth/v1/settings`, { headers, signal: AbortSignal.timeout(15000) });
if (!settings.ok) throw new Error(`Auth settings HTTP ${settings.status}`);
const auth = await settings.json();
console.log(JSON.stringify({ check: 'auth-settings', status: settings.status,
  disable_signup: auth.disable_signup, email_enabled: auth.external?.email }));
let failed = auth.disable_signup !== true || auth.external?.email !== true;
for (const table of ['profiles', 'work_records', 'record_history', 'archive_exports']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers, signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  const denied = [401, 403].includes(response.status) && body.code === '42501';
  console.log(JSON.stringify({ check: 'anonymous-read-denied', table, status: response.status, code: body.code, passed: denied }));
  failed ||= !denied;
}
if (failed) process.exitCode = 1;
