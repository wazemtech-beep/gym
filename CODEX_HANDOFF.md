# Project handoff — 8 October 2026

## Objective and user preferences

Continue OXGEN GYM, preserving existing backend business rules and role isolation. The user communicates in Roman Urdu and prefers direct implementation, clean gym-style UI, concise visible text, stable loading card layouts and few unnecessary confirmation questions. Testing is currently authorized, including the user's connected Android phone via ADB. The database was explicitly confirmed to contain demo/test data. Use isolated synthetic fixtures and cleanup/rollback; do not send emails or announcements to gym members. Do not treat historical test passes as proof that all current flows pass.

## Architecture and functionality

`web/` is a Next.js application with PostgreSQL/Prisma, custom bearer/cookie sessions, Better Auth compatibility tables, role guards and owner/receptionist/trainer/member roles. Admin login is `/admin/login`, management routes are `/admin/...`, trainer portal is `/admin/trainer/dashboard`. Member routes include `/login`, `/dashboard`, `/membership`, `/payments`, `/workout`, `/diet`, `/progress`, `/profile`, `/notifications`, `/attendance` and `/settings`.

Management includes members/registration approval, fee plans, membership/invoices/installments, payments/transfers/receipts/refunds, cash sessions, expenses/payroll, reporting, announcements, settings and audit records. Trainer web features include assigned members, workout/diet plan draft/publishing, adherence/session feedback, progress review and consent-controlled fitness insights.

`mobile/` is a separate Expo member app sharing the same backend. It includes registration/activation/login/reset, dashboard, renewal/freeze requests, payment proof and PDF receipt sharing, workouts with encrypted account-scoped offline replay, diet preferences/logs/change requests, progress measurements/goals/chart/private photos, profile/security, notification preferences, attendance history and Android Health Connect permissions/consent/sync/sharing/deletion. Trainer mobile screens have NOT been implemented. Member-only mobile access is deliberate current scope; do not claim trainer mobile is done.

Backend reads use authenticated caches with write invalidation and revision notifications. Cross-process revision storage must be shared between web/worker. Mobile uses account-scoped TanStack Query data and native SecureStore for sessions/offline entries. Never let cached data or pending workouts cross accounts. Payment confirmation stays staff-controlled; no unverified attendance self check-in.

## Setup

Run `npm ci` independently in `web` and `mobile`. Configure environment variables through the execution environment, never by committing secrets. Web needs `DATABASE_URL`, session/auth secret, real `APP_URL` or `NEXT_PUBLIC_APP_URL`; SMTP, Cloudinary, Firebase and `CRON_SECRET` for their features. Existing schema/migration SQL is in `web/prisma`. Inspect the target database before applying migrations. Generate the Prisma client with `npx prisma generate`.

Web commands: `npm run dev`, `npm run build`, `npm run start`, `npm run worker`, `npx tsc --noEmit`. Mobile: `npm run typecheck`, `npm run lint`, `npx expo export --platform android`, `npx expo prebuild --platform android --no-install`. Follow version-matched Expo docs before touching SDK APIs. Generated `mobile/android` and `mobile/ios` are excluded; implement native changes through configuration/plugins.

Mobile requires `EXPO_PUBLIC_API_URL` reachable from the phone. For USB testing, use `adb reverse tcp:3003 tcp:3003` plus `adb reverse tcp:8081 tcp:8081`, backend on port 3003 and Metro on 8081 with `EXPO_PUBLIC_API_URL=http://127.0.0.1:3003`. Release mode requires HTTPS. Native Firebase/Health Connect need a development build; Expo Go is insufficient.

Firebase **client** files `google-services.json` and `GoogleService-Info.plist` are not committed. Supply them or EAS file variables `GOOGLE_SERVICES_JSON`/`GOOGLE_SERVICES_PLIST`. Never copy the backend service-account private key into mobile. Signing, APNs, public policy URL, real HTTPS host and store accounts are deployment steps.

## Verification evidence and current limitations

Historical 7 October run: 100 targeted API/auth/financial/worker/provider checks and production build passed. One authorized forgot-password email reached the user's inbox. This is historical evidence, not exhaustive certification.

8 October current pass:
- Web TypeScript and production build passed: 123 generated routes/pages.
- Mobile TypeScript passed and Android JavaScript/Hermes export passed.
- Mobile lint initially had 0 errors and 4 hook dependency warnings. Dependencies were corrected; rerun lint after these edits.
- Database schema audit found no missing columns across 56 models; SMTP authentication passed without sending mail.
- Admin/member isolated API suite: 42 passed, 0 failed; fixtures cleaned up.
- Financial integrity suite: 11 passed, 0 failed; all database fixture changes rolled back.
- Mobile authentication suite detected that current web login responses exposed a bearer token. Source was fixed to expose a token only for legacy no-portal callers or a member mobile client. Rebuild/restart backend and rerun `verify-mobile-auth.cjs` before counting it as passed.
- Source inspection found trainer progress feedback POST lacked active assignment/measurement-consent checks. The guard was added. Add/run explicit assigned/unassigned/revoked-consent tests and rebuild afterward.
- An authorized Vivo V2331 / Android API 35 phone was connected by ADB. Existing gym development app launched. Native Gradle build was still running when repository handoff was requested. Do not count native APK compile/install, fresh device login, offline recovery, photo picker, PDF sharing, push receipt or Health Connect reads as passed yet.

Useful existing scripts: `web/scripts/verify-api.cjs`, `verify-mobile-auth.cjs`, `verify-account-flows.cjs`, `verify-financial.ts`, `verify-support.ts`, `verify-worker.ts`, `verify-providers.ts`, `verify-runtime.cjs`. Review each before running. API scripts use `GYM_VERIFY_URL` (set explicitly; defaults vary). Do not use old broad `test-*.ts` scripts blindly: some mutate unrelated demo records or broadcast messages. Do not set `GYM_VERIFY_EMAIL` unless actual email delivery is specifically authorized for that run.

## Next steps

Finish the current verification: rebuild after auth/trainer fixes; rerun mobile auth; add trainer draft/publish/feedback, foreign-member denial and sharing-revocation checks; exercise member feature writes and cache refresh; complete Android APK build/install and test on the phone. Fix failures and rerun affected checks. Report Passed, Failed, and Not Tested separately, with concrete evidence. Trainer mobile is a separate implementation task, not a test failure. iOS cannot be device-tested from the current Windows/Android setup.

For production, run the worker persistently, configure real HTTPS/providers/signing, validate private asset migration and shared cache revisions for multiple hosts. Never say every item is final solely because TypeScript/build passes.
