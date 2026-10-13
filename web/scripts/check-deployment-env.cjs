const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
if (process.env.VERCEL) {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!secret || secret.length < 32) missing.push('existing auth/session secret (32+ characters)');
  const address = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  try { if (!address || new URL(address).protocol !== 'https:') missing.push('HTTPS APP_URL'); } catch { missing.push('valid APP_URL'); }
  if (process.env.VERCEL_ENV === 'production' && (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 16)) missing.push('CRON_SECRET (16+ characters)');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) missing.push('FIREBASE_SERVICE_ACCOUNT_JSON');
  else {
    try {
      const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (!account.project_id || !account.client_email || !account.private_key) missing.push('complete Firebase Admin JSON');
      if (process.env.FIREBASE_PROJECT_ID && account.project_id !== process.env.FIREBASE_PROJECT_ID) missing.push('matching Firebase project');
    } catch { missing.push('valid Firebase Admin JSON'); }
  }
  if (missing.length) { console.error('Set Vercel environment variables before building: ' + missing.join(', ')); process.exitCode = 1; }
  else console.log('Vercel deployment environment validated');
}
