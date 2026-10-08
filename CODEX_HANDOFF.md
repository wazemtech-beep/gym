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

Historical 7 October run: 100 targeted API/auth/financial/worker/provider checks and a production build passed. One authorized forgot-password email reached the user's inbox. This is historical evidence, not exhaustive certification.

8 October targeted checks:
- Web TypeScript and production build passed after the trainer plan access guard; production output generated 123 routes/pages.
- Mobile TypeScript and lint passed after the phone-photo upload and loading-layout fixes. Final Android Hermes export also passed after the Expo 57 upload adapter change (1,581 modules).
- Runtime schema audit found no missing columns across 56 models; SMTP authentication passed without sending mail.
- Isolated suites passed: admin/member API 42, finance 11, mobile auth 10, cache/outbox/templates 12, trainer plans 21, account flows 14, worker lifecycle 11, providers 6. Total: 127 targeted checks, 0 final failures. Fixtures were cleaned up. These checks cover defined contracts and are not exhaustive certification.
- Native Android debug APK compiled, installed on Vivo V2331 / Android API 35, and loaded the current app through Metro over ADB. A fresh synthetic member login succeeded.
- Physical-device flows confirmed: member dashboard and active membership load; assigned workout details render; an offline workout completion queued and synchronized once after reconnect (database stored one 12-minute, 8-rep session); address/emergency contacts saved; diet-change request saved; goal 77 kg saved; synthetic meal log saved; synthetic progress photo uploaded through the Expo 57 `File` multipart adapter and then removed through the app; password change succeeded and new password sign-in worked; logout-all-devices showed confirmation and returned to sign-in; regular logout/re-login worked. Synthetic member fixture and test photo were removed afterward.
- Payments, attendance, updates and privacy pages opened on the phone. Payments had no fixture invoice/receipt, so receipt download/share remains unverified.
- Health Connect native permission screen opened and permissions were granted; the phone reported all four read categories. Cloud-storage consent remained off, so no health data was uploaded or read from a real health source. The test did not verify selecting only a subset of permissions.

Useful scripts include `web/scripts/verify-api.cjs`, `verify-mobile-auth.cjs`, `verify-account-flows.cjs`, `verify-financial.ts`, `verify-support.ts`, `verify-worker.ts`, `verify-providers.ts`, `verify-runtime.cjs`, `verify-trainer.cjs`, and `verify-device-fixture.cjs`. Review before running. API scripts use `GYM_VERIFY_URL` (set explicitly; defaults vary). Do not use old broad `test-*.ts` scripts blindly: some mutate unrelated demo records or broadcast messages. Do not set `GYM_VERIFY_EMAIL` unless actual email delivery is specifically authorized for that run.

## Remaining work

The mobile app is a member app; trainer mobile screens are not implemented. Native push receipt requires Firebase client configuration. PDF receipt sharing needs an invoice fixture/device pass. iOS cannot be device-tested from the current Windows/Android setup. Email-change verification has backend contract coverage and the form was opened on device, but an end-to-end email change was not exercised. Admin/trainer web features have targeted API/build coverage rather than exhaustive browser verification.

Production still needs a persistent worker, HTTPS host, provider/client configuration, signing, store accounts, policy URLs and deployment validation. Never claim every item is final solely because builds and targeted checks pass.
