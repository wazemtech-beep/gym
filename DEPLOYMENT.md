# Deploy OXGEN GYM on Vercel

The Vercel project serves `web/`: admin, trainer and member websites plus the shared API. The Expo mobile app is built separately and calls that HTTPS API. A VPS or persistent worker process is not required on Vercel.

## Push the prepared source

Run from PowerShell:

```powershell
Set-Location "D:\SAAS APPS PENDING\gym"
git add .
git commit -m "Prepare Vercel deployment with shared cache and scheduled jobs"
git push origin main
```

The configured remote is `https://github.com/wazemtech-beep/gym.git`. `.env`, `.env.vercel`, Firebase service-account files, Android configuration, keys, dependencies and generated native/build folders remain ignored. Do not force-add them.

## Configure the Vercel project

Import the GitHub repository and configure:

- Root Directory: `web`
- Framework: Next.js
- Install Command: `npm ci`
- Build Command: `npm run build:vercel`
- Output Directory: Next.js default
- Node.js: 24.x (matches the verified local runtime)
- Fluid compute enabled
- Vercel Pro for the configured every-minute cron

Use your actual production HTTPS domain in the next command. Keep the project/domain stable so email links and the mobile API point to the same origin.

The current production origin supplied for this project is `https://oxgengen.vercel.app`. A ready local import file is `web/.env.vercel`; it contains all 24 configured production variables and inline Firebase Admin JSON. This file remains ignored. Local development `.env` now also contains the Admin JSON directly; its localhost URL remains the development setting.

```powershell
Set-Location "D:\SAAS APPS PENDING\gym\web"
npm run deploy:env -- --url https://YOUR-SITE.vercel.app
```

This creates ignored `web/.env.vercel` from your existing local configuration. It preserves the existing session secret, converts the local Firebase Admin service-account file to the server-only `FIREBASE_SERVICE_ACCOUNT_JSON` variable, sets HTTPS app URLs, and creates `CRON_SECRET` if missing. Nothing is printed or sent to another service by this command.

The local main `.env` can also hold the credential directly. `npm run deploy:env -- --inline-firebase` replaces the local file-path variable with one-line Admin JSON and preserves the existing app/session settings. If the final domain is not known yet, `npm run deploy:env -- --template` creates the import file with URL placeholders. Replace `APP_URL`, `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` with the real HTTPS origin before deploying; the cloud build rejects the `.invalid` placeholder.

Add those variables in Vercel Project Settings → Environment Variables, scoped to Production, before deploying. Use the `.env` import/paste option if available, or add the values individually. Preserve the JSON value and its `\n` escapes; do not include the surrounding single quotes when entering it individually. Never prefix the Admin credential with `NEXT_PUBLIC_`. Public Firebase web configuration variables are separate.

For Preview deployments, use the appropriate preview environment and database. Preview builds also need database, auth and Firebase JSON configuration, but Vercel only schedules the cron on production. The existing Aiven database must remain reachable and have a connection allowance suitable for your function concurrency; use the provider's pooled URL if available. The app caps each Vercel instance to one Prisma connection, but this is not a global connection cap.

## Deploy

With Git integration, deploy/redeploy the latest `main` commit after adding the environment variables. Alternatively:

```powershell
Set-Location "D:\SAAS APPS PENDING\gym\web"
npx vercel@latest login
npx vercel@latest link
npx vercel@latest --prod
```

Select the configured project. Do not create a second project for this same deployment.

`build:vercel` validates cloud configuration, generates Prisma Client, applies the repeatable additive `prisma/serverless-runtime.sql`, then builds Next.js. The SQL creates only `RuntimeState`; it does not reset or alter existing gym records. It assumes the existing application's database schema is already present. Do not use a reset or force-push against your existing database. A completely new empty database needs the complete application schema first.

## Scheduled processing and cache behavior

`web/vercel.json` calls `GET /api/v1/scheduler/reminders` every minute. Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`. GET requires the secret; authenticated owners can still trigger POST. The route is dynamic, uncached and has a 300-second execution limit. It stops starting new work within its 200-second budget and limits recipient/outbox batches. PostgreSQL leases prevent overlapping cron runs and concurrent delivery of the same event; abandoned leases expire. HTTP/provider retries remain at-least-once: an interruption after provider acceptance but before persistence can still require reconciliation.

Membership/reminder scans persist a member cursor. Announcement recipients are queued in pages and deduplicated. Queued work survives function restarts and continues on later invocations. Newly published announcements are visible immediately; email/push/in-app notification fan-out is processed asynchronously. Large queues can take several cron runs.

Cache revision is one PostgreSQL row shared across instances. A write changes it; a server cache is used only after checking the shared revision. The browser checks a short JSON endpoint about every ten seconds while visible, with one leader tab per session when browser locks are supported. Own writes clear caches immediately; other active sessions notice changes on their next poll. Hidden/offline tabs pause polling and recheck on return. Failed revision checks disable reuse of unverified cached data. No persistent SSE connection or local filesystem marker is required.

Do not run `npm run worker` as a Vercel function. It remains an optional local/VPS wrapper around the same leased runner.

## After deployment

1. Open `/admin/login` and `/login`; verify existing accounts and permissions.
2. Check Settings → Health and Vercel cron logs. A successful run updates the scheduler heartbeat; token authorization, skipped overlaps and failures must appear accurately.
3. With a synthetic account, confirm writes refresh another session, reminders process, and notification queue entries complete. Do not test broadcasts on real members.
4. Verify reset/activation links use the deployed HTTPS domain, SMTP delivery works and private Cloudinary files retain access checks.
5. Set mobile `EXPO_PUBLIC_API_URL` to this HTTPS origin in the appropriate EAS environment and rebuild the standalone APK. Supply Android Firebase config using the EAS file variable supported by `app.config.js`. Then finish the standalone cold-start notification and PDF-sharing tests.

Local verification commands:

```powershell
Set-Location "D:\SAAS APPS PENDING\gym\web"
npm run deploy:prepare
npm run build:vercel
npm run verify:serverless -- --http
```

The verification suite creates scoped synthetic users/announcements, sends no external notifications, tests shared-cache invalidation and job leases, starts a temporary local production server for HTTP authentication checks, then cleans its fixtures. It never invokes an unscoped cron run against your gym data.

References: [Vercel cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables).
