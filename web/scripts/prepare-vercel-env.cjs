const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadEnvConfig } = require('@next/env');

const names = [
  'DATABASE_URL', 'SESSION_SECRET', 'BETTER_AUTH_SECRET', 'AUTH_SECRET', 'ASSET_SIGNING_SECRET',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_URL', 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'FIREBASE_PROJECT_ID',
];

function buildDeploymentEnv(env, address, readCredential = file => fs.readFileSync(path.resolve(file), 'utf8')) {
  const url = new URL(address);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Supply the final HTTPS site origin with --url');
  const secret = env.BETTER_AUTH_SECRET || env.AUTH_SECRET || env.SESSION_SECRET;
  if (!env.DATABASE_URL || !secret || secret.length < 32) throw new Error('DATABASE_URL and the existing session secret (32+ characters) are required');
  const values = Object.fromEntries(names.filter(name => env[name]).map(name => [name, env[name]]));
  values.APP_URL = url.origin;
  values.NEXT_PUBLIC_APP_URL = url.origin;
  values.BETTER_AUTH_URL = url.origin;
  values.CRON_SECRET = env.CRON_SECRET || crypto.randomBytes(32).toString('hex');
  if (values.CRON_SECRET.length < 16) throw new Error('CRON_SECRET must be at least 16 characters');
  let account;
  try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || (env.FIREBASE_SERVICE_ACCOUNT_PATH ? readCredential(env.FIREBASE_SERVICE_ACCOUNT_PATH) : '{}')); }
  catch { throw new Error('Firebase Admin credential JSON is invalid'); }
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error('Firebase Admin credentials are required for mobile push');
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID !== account.project_id) throw new Error('Firebase Admin project does not match FIREBASE_PROJECT_ID');
  values.FIREBASE_PROJECT_ID = account.project_id;
  values.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(account);
  const content = Object.entries(values).map(([name, value]) => {
    if (name === 'FIREBASE_SERVICE_ACCOUNT_JSON') {
      if (value.includes("'")) throw new Error('Unsupported quote in Firebase configuration');
      return `${name}='${value}'`;
    }
    if (/[\r\n"]/u.test(value)) throw new Error(`Unsupported multiline or quote in ${name}`);
    return `${name}="${value}"`;
  }).join('\n') + '\n';
  return { content, values };
}

function main() {
  loadEnvConfig(process.cwd());
  if (process.argv.includes('--inline-firebase')) {
    let account;
    try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || fs.readFileSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || ''), 'utf8')); }
    catch { throw new Error('Firebase Admin credential JSON is invalid or missing'); }
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error('Incomplete Firebase Admin credential');
    const json = JSON.stringify(account);
    if (json.includes("'")) throw new Error('Unsupported quote in Firebase configuration');
    const file = path.resolve('.env');
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace(/^\s*FIREBASE_SERVICE_ACCOUNT_PATH\s*=.*(?:\r?\n|$)/gm, '');
    text = text.replace(/^\s*FIREBASE_SERVICE_ACCOUNT_JSON\s*=.*(?:\r?\n|$)/gm, '');
    text = text.trimEnd() + "\nFIREBASE_SERVICE_ACCOUNT_JSON='" + json + "'\n";
    if (!/^\s*CRON_SECRET\s*=/m.test(text)) text += 'CRON_SECRET="' + (process.env.CRON_SECRET || crypto.randomBytes(32).toString('hex')) + '"\n';
    fs.writeFileSync(file + '.tmp', text, { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
    console.log('Updated local .env with direct Firebase Admin JSON and cron secret. Private values are not printed.');
    return;
  }
  const index = process.argv.indexOf('--url');
  const template = process.argv.includes('--template');
  const address = index >= 0 ? process.argv[index + 1] : template ? 'https://replace-with-your-vercel-domain.invalid' : undefined;
  if (!address) throw new Error('Usage: npm run deploy:env -- --url https://YOUR-SITE.vercel.app (or --template)');
  const result = buildDeploymentEnv(process.env, address);
  if (process.argv.includes('--check')) { console.log('Deployment environment validated; no file written'); return; }
  const file = path.resolve('.env.vercel');
  fs.writeFileSync(file, result.content, { mode: 0o600 });
  console.log('Created ignored .env.vercel for Vercel environment import. Credentials are not printed.');
  if (template) console.log('Replace APP_URL, NEXT_PUBLIC_APP_URL and BETTER_AUTH_URL with the actual production HTTPS origin before deploying.');
}
module.exports = { buildDeploymentEnv };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : 'Environment preparation failed'); process.exitCode = 1; }
}
