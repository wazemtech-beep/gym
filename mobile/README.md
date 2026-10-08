# OXGEN GYM member app

React Native / Expo SDK 57 app in this separate folder, connected to the existing web backend. No separate gym database or admin business rules are duplicated here.

## Implemented screens and actions

- Member sign-in, account request with photo and optional DOB, admin activation code, forgot password, reset link/code, forced initial password change.
- Home overview with fixed card skeletons while data loads.
- Membership details/history, renewal and freeze submissions, approval status and renewal cancellation. Members cannot edit price or expiry.
- Invoices, installments, payment history, PDF receipt sharing and private bank-transfer proof submission. Staff confirmation remains required.
- Assigned workout instructions/demo links, per-set reps/load/duration logging, completion/skipping, trainer feedback and paginated session history.
- Encrypted per-account offline workout queue, stable session IDs, foreground/reconnect submission, visible rejected entries and explicit discard. A saved plan is reused only on its saved date.
- Assigned diet, meal adherence, preferences/allergies and diet-change request.
- Measurements/baseline, same-day conflict choices, unusual-change confirmation, weight chart, goals, private photo upload/deletion and trainer-sharing controls.
- Profile/emergency contact, change login email, change password, logout and logout all devices.
- Notifications, mark read, email/push preferences, native FCM registration and token refresh. Notification taps only open approved member screens.
- Attendance history when enabled by the gym. No unverified self check-in.
- Android Health Connect permission selection, separate cloud consent, explicit last-seven-day sync using PKT dates, missing-data-aware summaries, exercise records, trainer/category/history sharing, disconnect and scoped deletion. Deleted data requires an explicit confirmed re-import.
- Public fitness privacy explanation, including Health Connect permissions rationale routing.

## Connection and development

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the backend address reachable by the phone. `localhost` refers to the phone itself; use your computer's LAN address. Android emulator host alias is `10.0.2.2`. The phone and computer should be on the same network for local development. Release builds require an HTTPS backend; the API client rejects HTTP in release mode.

Install with `npm ci`. Run `npm run start` for Metro. Health Connect and Firebase require a native development build, not Expo Go. Build Android with `npx eas-cli@latest build --platform android --profile development`; the `preview` profile creates an APK. Build commands have not been run in this coding pass.

## Native services configuration

For phone notifications, add the Firebase **client** configuration for Android package `com.oxgen.gym` as `google-services.json`, and for iOS bundle `com.oxgen.gym` as `GoogleService-Info.plist`. Alternatively set EAS file environment variables `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICES_PLIST`. These files are ignored. Never put the backend Firebase service-account private key in the app. Configure the existing backend FCM service for the same Firebase project; iOS also needs APNs credentials in Firebase.

`app.config.js` includes native Firebase plugins only when a client configuration exists. Push enablement gives a clear configuration message when missing. Health Connect is Android-only; the rest of the member app targets both Android and iOS. Store publication requires the gym's public privacy-policy URL and Health Connect/notification declarations.

Email reset/verification links currently use the existing web backend pages, which remain usable from a phone. The app also supports `oxgengym://reset-password?token=...`, `oxgengym://activate?token=...` and reception-issued codes. Verified HTTPS app links require the gym's final domain and association files and are not configured with an invented domain.

## Data and cache behavior

Member queries are scoped to account, reused for 30 seconds, refreshed while the screen is focused and invalidated after writes. Switching accounts clears in-memory queries. Authentication and offline workouts use native Keychain/Keystore. Web preview storage is memory-only. Pending workouts remain scoped to their original account after logout and only resume under that same account.

## Current verification status

The user requested file completion before further testing. This pass did not run builds, lint, type checks, database tests or device tests. Native dependency compatibility, permission dialogs, notifications, offline recovery, PDF sharing and screen layout need the later phone verification pass. Firebase client files, release HTTPS address, signing/store accounts and physical-device verification remain deployment steps. This is implemented source code, not a verified production release.
