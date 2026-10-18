// Run by the deploy workflow. Stops the deploy if js/config.js still has the
// placeholders, or if anyone pasted a secret (service_role) key into it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const fail = (msg) => {
  console.error(`::error::${msg}`);
  process.exit(1);
};

const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../js/config.js');

if (SUPABASE_URL.includes('YOUR-PROJECT-REF') || SUPABASE_ANON_KEY.startsWith('YOUR-')) {
  fail('Fill in SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js (README step 6).');
}
if (!/^https:\/\/[^/]+$/.test(SUPABASE_URL.replace(/\/$/, ''))) {
  fail('SUPABASE_URL should look like https://abcdefgh.supabase.co, with nothing after .co (remove any /rest/v1/).');
}

function isSecret(key) {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role === 'service_role';
  } catch {
    return false;
  }
}

if (isSecret(SUPABASE_ANON_KEY)) {
  fail('js/config.js contains a SECRET service_role key. Rotate it in Supabase now and use the anon / publishable key.');
}

// Also scan every published file for anything that looks like a secret key.
const published = ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons'];
const jwtLike = /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g;
function scan(path) {
  if (statSync(path).isDirectory()) {
    for (const f of readdirSync(path)) scan(join(path, f));
    return;
  }
  if (!/\.(js|mjs|html|json|webmanifest|css|svg)$/.test(path)) return;
  const text = readFileSync(path, 'utf8');
  if (text.includes('sb_secret_')) fail(`${path} contains an sb_secret_ key.`);
  for (const m of text.match(jwtLike) ?? []) {
    if (isSecret(m)) fail(`${path} contains a service_role key.`);
  }
}
published.forEach(scan);

console.log('Config looks good: public key only.');
