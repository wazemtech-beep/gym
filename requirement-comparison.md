# Requirement.txt vs current codebase

Review date: 6 October 2026. Scope: `D:/SAAS APPS PENDING/gym/web` and the 3,058-line requirement.txt.

This is a source-code comparison, not a live deployment or database test. Application code was not changed. “Missing” means no corresponding working flow was found in this workspace. “Partial” means the basic module exists but one or more detailed rules in the TXT are absent or implemented differently. A model, a screen title or a test script alone was not treated as a finished feature.

The major feature areas are represented in the codebase. The important gaps are inside their detailed flows; workout, diet, progress and fitness-sharing modules should not be described as entirely absent.

## 1. Login, accounts and roles — partial

- **Missing:** Forgot-password page and email recovery-link flow; reception-issued reset code for members without email. The existing change-password action needs a signed-in session and does not provide account recovery.
- **Missing:** Staff invitation email sending, resend for an expired invitation, invalidation of the previous link on resend, and a delivery-retry action. Staff invite currently returns an activation link; an existing account is rejected instead of supported through a resend flow. Member activation similarly needs its specified email-delivery flow.
- **Different implementation:** Better Auth is installed, but authentication/passwords/sessions are implemented through custom bcrypt and Prisma logic instead of the Better Auth integration required in the TXT.
- **Partial:** Logout-all-devices exists in the API but is not exposed by the current shared logout controls.
- **Missing flow:** Changing a login email with verification of the new email. Ordinary member contact editing is not a substitute for this account-identity flow.

Evidence: [auth implementation](<D:/SAAS APPS PENDING/gym/web/src/lib/auth.ts:1>), [staff invitations](<D:/SAAS APPS PENDING/gym/web/src/app/api/staff/invite/route.ts:45>), [logout API](<D:/SAAS APPS PENDING/gym/web/src/app/api/auth/logout/route.ts:1>), [shared navigation](<D:/SAAS APPS PENDING/gym/web/src/components/layout/TopNav.tsx:1>). TXT: [account recovery](<D:/SAAS APPS PENDING/gym/requirement.txt:188>), [invitation resend](<D:/SAAS APPS PENDING/gym/requirement.txt:121>).

## 2. Collection/dashboard — partial

- **Missing on the owner screen:** Outstanding/overdue dues, active-member count and expiring-membership overview. Some totals are calculated server-side but never rendered; expiring memberships are not part of the dashboard query.
- **Missing dashboard controls:** Custom date range, receiving-account/staff filtering, and collection-card drill-down into payment details. The current cards are display cards; the visible collection filters are period, search and method.
- **Partial:** Collection date boundaries use the server's local `Date` methods rather than explicit Karachi boundaries. They can differ when the server timezone is not Asia/Karachi.
- **Missing operational reception home:** Reception dashboard currently contains static cards, without working navigation/actions or the receptionist's own daily collection summary. Some owner-prefixed operational pages exist, but that does not finish the reception-dashboard flow.

Evidence: [dashboard totals](<D:/SAAS APPS PENDING/gym/web/src/app/owner/dashboard/page.tsx:96>), [rendered metrics](<D:/SAAS APPS PENDING/gym/web/src/components/dashboard/CollectionSection.tsx:175>), [date boundaries](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/dashboard/collection/route.ts:8>), [reception page](<D:/SAAS APPS PENDING/gym/web/src/app/reception/dashboard/page.tsx:25>).

## 3. Member management — core present, detailed gaps

- **Missing:** Controlled Cloudinary file upload for identification photos. Existing fields store/provide image URLs; that is not the upload flow specified in the TXT.
- **Incomplete:** Same-name possible-match warning, reason/audit capture for an authorized shared-family-phone exception, and a stable request key to make member creation retry-safe.
- **Incomplete existing-member import:** Opening dues are accepted during member creation, but the specified separate balance-as-of date, note, owner-confirmation and audited correction flow are not complete.
- **Partial profile integration:** Full workout/diet/activity/progress functionality exists in separate member/trainer modules; the operational member-profile tabs do not provide the complete, permission-aware integration described in the TXT.

Evidence: [member creation](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/route.ts:160>), [member form](<D:/SAAS APPS PENDING/gym/web/src/components/members/AddMemberModal.tsx:1>), [profile tabs](<D:/SAAS APPS PENDING/gym/web/src/components/members/MemberProfileClient.tsx:1>). TXT: [uploads](<D:/SAAS APPS PENDING/gym/requirement.txt:634>), [opening balance](<D:/SAAS APPS PENDING/gym/requirement.txt:1074>).

## 4. Multiple fee plans — core present, version history partial

- Plans, duration types, pricing, active/inactive handling and membership snapshots exist.
- **Incomplete:** Full historical plan-version records. Editing updates the same FeePlan row and increments a version number for selected changes; the old complete definition is not retained as a separate version. Service/admission/payment-term changes also do not consistently increment the version.

Evidence: [plan update](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/fee-plans/[id]/route.ts:80>), [FeePlan model](<D:/SAAS APPS PENDING/gym/web/prisma/schema.prisma:239>).

## 5. Membership/renewal/freeze/cancel — partial

- **Incomplete overlap protection:** Assignment checks ACTIVE memberships, but not all UPCOMING/frozen reservations, and concurrent requests are not protected with an atomic overlap check.
- **Incomplete freeze flow:** Planned freeze start/end, active-membership eligibility, overlap/history checks, and review/adjustment of an already-booked future renewal are not complete. A freeze uses the current time and unfreeze extends the end date.
- **Missing:** Member/receptionist freeze-request review flow and cancellation's explicit financial-treatment review—credit, waiver or refund as separate approved actions.
- **Missing validation:** Submitted membership IDs in freeze/unfreeze/cancel are not consistently verified as belonging to the selected member.

Evidence: [membership actions](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/[id]/membership/route.ts:51>), [overlap check](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/[id]/membership/route.ts:264>). TXT: [freeze and cancellation rules](<D:/SAAS APPS PENDING/gym/requirement.txt:940>).

## 6. Invoices/dues — partial

- **Missing:** Standalone `/owner/invoices` page linked in the sidebar, issued-invoice credit/adjustment workflow, and paid-invoice void/refund/reallocation review.
- **Incomplete installment accounting:** Payments update invoice totals, but do not settle individual installment amounts/statuses. Member fee summaries sum unpaid installment amounts and can therefore disagree with the reduced invoice balance.
- **Missing correct historical reconstruction:** The “as-of” dues endpoint uses current invoice status/balance, filtered by issue date. A later payment can erase what was owed on the earlier selected date.

Evidence: [sidebar link](<D:/SAAS APPS PENDING/gym/web/src/components/layout/Sidebar.tsx:47>), [payment allocation](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/payments/route.ts:86>), [member installment totals](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/dashboard/route.ts:170>), [historical dues](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/reports/dues/route.ts:27>).

## 7. Manual payments/transfers — partial; important correctness gaps

- **Missing:** Stable payment request keys, duplicate transaction-reference/account checks, concurrency-safe receipt numbering and robust protection against simultaneous allocations/approvals. A database transaction alone does not satisfy these requirements.
- **Incomplete invoice allocation:** One invoice ID is supported; there is no complete multiple-invoice allocation preview/default-oldest-due flow. The API also needs to verify that the selected invoice belongs to the selected member and that an invoice ID is valid before confirming payment.
- **Incorrect transfer approval flow:** Approval creates a payment/receipt but does not allocate it to invoices or reduce invoice dues. It also records `paymentDate` as approval time, not the actual receiving date required by the TXT.
- **Missing backdate controls:** Mandatory backdate reason and authorization are not enforced; actual receiving date and transfer-verification date are not fully handled separately.
- **Missing standalone page:** Sidebar links to `/owner/payments`, but no page was found there.

Evidence: [payment API](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/payments/route.ts:26>), [transfer approval](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/transfers/verify/route.ts:103>). TXT: [duplicate prevention](<D:/SAAS APPS PENDING/gym/requirement.txt:334>).

## 8. Partial payments/opening dues/advance credit — partial

- Ordinary partial payment and an opening-dues invoice exist.
- **Missing:** Advance-credit ledger, overpayment confirmation, storing the excess separately and later applying that credit without counting collection a second time. Current allocation clamps invoice balance to zero without implementing that credit flow.
- **Incomplete:** Owner-approved opening-balance date/note/correction, splitting a payment between old and new invoices, and installment-aware due-now/upcoming/overdue calculations.

Evidence: [payment balance calculation](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/payments/route.ts:92>), [opening dues creation](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/route.ts:228>). TXT: [advance credit](<D:/SAAS APPS PENDING/gym/requirement.txt:1080>).

## 9. Admission fee/discounts — calculations present, approval incomplete

- **Missing authoritative server pricing:** Membership assignment accepts membership/admission prices and duration from the request instead of loading and validating all agreed values against the active fee plan.
- **Missing enforcement:** Owner approval for custom discounts/admission waivers is not enforced in the assignment API; the API allows ordinary member-management staff and accepts these amounts.
- **Missing:** Post-issue discount via credit adjustment, and the complete previously-charged/imported-member admission-fee record/rejoining approval flow.

Evidence: [client-submitted fee values](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/[id]/membership/route.ts:207>), [pricing calculation](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/[id]/membership/route.ts:242>).

## 10. Receipts — partial

- A4/thermal rendering, unique receipt identity and owner reversal exist.
- **Incomplete immutable snapshot:** Branding is partly saved, but receipt details include current member/account/invoice data. The displayed balance comes from the current invoice, so an old receipt's balance can change after a later payment. Logo and the configured footer are not fully wired into the rendered snapshot.
- **Missing:** Saved-record backend PDF generation/download for web and Flutter; current PDF handling uses browser Print/Save as PDF. Receipt email sending/retry and actual device-share flow are not complete.
- **Missing:** Separate linked refund acknowledgement; reversal is implemented but actual money refund is a different required flow.
- **Missing access restriction:** Receipt GET does not reject the trainer role, although the TXT excludes trainers from receipts.

Evidence: [receipt response and live relations](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/receipts/[id]/route.ts:18>), [current balance in receipt](<D:/SAAS APPS PENDING/gym/web/src/components/receipts/ReceiptModal.tsx:673>), [browser print/share](<D:/SAAS APPS PENDING/gym/web/src/components/receipts/ReceiptModal.tsx:79>).

## 11. Expenses — core present, corrections/refunds incomplete

- Categories, paid/partial/unpaid expenses, copy and unpaid void exist; category activation/deactivation API exists.
- **Missing:** Paid-expense/payment adjustment workflow and linked vendor-refund records. Member payment reversal is not a vendor refund.
- **Incomplete:** Controlled/private bill upload rather than a URL field, and request-key/concurrency guarantees for expense creation/payment retries.

Evidence: [expense routes](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/expenses/route.ts:1>), [expense payments](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/expenses/[id]/pay/route.ts:1>), [attachment form](<D:/SAAS APPS PENDING/gym/web/src/components/expenses/AddExpenseModal.tsx:829>).

## 12. Reports/export — partial

- **Missing:** XLSX export and generated PDF export; CSV and browser printing exist. Large-export processing/ready/private-download workflow is not implemented in this repo.
- **Incomplete report set/UI:** A dedicated invoice/adjustment report and all specified account/staff/member/plan/status filters are not exposed. Attendance can be exported by the backend, but is not a normal report tab in the current reports component.
- **Incorrect historical dues:** Current balances are used instead of reconstructing balances at the selected historical date.
- **Incomplete screen/export parity:** Export does not consistently reuse screen filters/calculations; for example the dues export ignores `asOfDate`, membership export does not apply the displayed range, and collection export totals omit the full refund/net summary.
- **Permission mismatch:** Report/export endpoints allow receptionist access to gym-wide financial records rather than limiting default access to their permitted operational/own collection scope.

Evidence: [export API](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/reports/export/route.ts:11>), [CSV/print controls](<D:/SAAS APPS PENDING/gym/web/src/components/reports/ReportsDirectoryClient.tsx:81>), [dues reconstruction](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/reports/dues/route.ts:27>).

## 13. Attendance — core present, access/menu details incomplete

- Optional feature setting, check-in, repeated visits, owner override, void and history exist.
- **Incomplete:** Attendance navigation is not consistently hidden when disabled; shared sidebar always renders its link.
- **Incomplete:** Reception home does not expose its check-in operation, and some legacy member-attendance routes use general member-management permission rather than the specific attendance permission/setting flow.
- The newer attendance API has substantially more of the requested rules than the legacy member attendance route; these need a single consistent path and permission contract.

Evidence: [sidebar](<D:/SAAS APPS PENDING/gym/web/src/components/layout/Sidebar.tsx:56>), [legacy attendance route](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/[id]/attendance/route.ts:1>), [main attendance API](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/attendance/check-in/route.ts:1>).

## 14. Settings/audit — core present, rule application incomplete

- Gym/payment accounts, staff permissions, reauthentication, versioned settings and an audit viewer exist.
- **Incomplete application of defaults:** `invoiceDueDays`, receipt auto-email, configured receipt footer/logo and notification defaults are not consistently applied by the financial/receipt/sender flows. Membership invoices default to the membership end date.
- **Incomplete permission overrides:** Some core endpoints still call role-only permission checks and therefore do not honour the per-staff grants saved in Settings.
- **Missing:** Real backup/email-delivery/configuration health overview and the corresponding backup/restore/deletion-retention process in this repo.
- **Incomplete concurrent-edit guarantee:** Settings version is checked before the update transaction; the write itself does not require the expected version to still match.

Evidence: [settings defaults](<D:/SAAS APPS PENDING/gym/web/src/lib/settings.ts:98>), [version check/write](<D:/SAAS APPS PENDING/gym/web/src/lib/settings.ts:69>), [reported system status](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/settings/route.ts:44>), [role vs custom-grant helpers](<D:/SAAS APPS PENDING/gym/web/src/lib/permissions.ts:32>).

## 15. Member dashboard — core present, financial/privacy gaps inherited

- Membership, expiry, invoices/payments, transfer submission, renewal requests and workout summary exist.
- **Incomplete:** Correct installment-level balances, advance credit, actual PDF receipt download and complete self-service account/profile recovery flows.
- Staff dashboard-preview access also needs to exclude private workout/diet/progress information unless the specified consent permits it.

Evidence: [dashboard fee summary](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/dashboard/route.ts:170>), [member dashboard](<D:/SAAS APPS PENDING/gym/web/src/components/member/MemberDashboardClient.tsx:1>).

## 16. Trainer assignment — partial

- Assign/change trainer, history and trainer member lists exist.
- **Permission mismatch:** Assignment API allows receptionist/member-management staff; TXT says owner-only.
- **Incomplete effective dates:** A future-start assignment closes the old one immediately, sets the new assignment active and updates the member's primary trainer immediately. Trainer lists do not gate that access by start/end date.
- **Missing:** Complete reassignment notifications and suspended-trainer/affected-member handover/reassignment-pending flow.
- Fresh member consent must be authoritative; staff-submitted consent flags are not a substitute for member opt-in.

Evidence: [assignment permission](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/[id]/trainer/route.ts:57>), [immediate activation](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/members/[id]/trainer/route.ts:122>), [trainer access query](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/trainer/members/route.ts:32>).

## 17. Workout plans — partial

- Draft/publish, templates, programme records, member logs and trainer feedback exist.
- **Incomplete editor/logging:** Full editable cardio duration/distance, rest, instructions, alternative/demo inputs and actual per-set results are not all exposed in the current editor/member form.
- **Missing:** Protected offline drafts/queue, Not synced state and replay-safe client session IDs. The API can accept a session ID, but the member submission does not send it.
- **Incomplete schedule/effective dates:** Today lookup does not enforce plan start/end and falls back to the first workout day when today's day does not match. Future published plans archive the old plan immediately.
- **Incomplete backend eligibility:** Publish checks the plan author, but not that the author is still the member's current assigned trainer. Session submission also needs to validate plan ownership/publication/effective dates.
- **Incomplete corrections:** Logs are overwritten/deleted on update without the complete edit history specified in the TXT.

Evidence: [member submission](<D:/SAAS APPS PENDING/gym/web/src/components/member/MemberDashboardClient.tsx:342>), [session API](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/workout/session/route.ts:50>), [today schedule](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/workout/today/route.ts:35>), [publish guard](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/trainer/plans/[id]/publish/route.ts:33>).

## 18. Diet plans — core present, detailed workflows partial

- Preferences, meals/alternatives, draft/publish, allergy checks, adherence logs, specialist reference and trainer feedback exist.
- **Missing/incomplete:** Dedicated member change-request review and preference-change notice to the assigned trainer.
- **Incomplete:** Published plan effective-date selection, current-assignment recheck at publish, and allergy/restriction revalidation at the actual publish step. The create flow's allergy check is not sufficient for a later changed preference/draft publish.
- Nutrition estimates have fields, but the complete estimate-source metadata/UI required by the TXT is not implemented.

Evidence: [diet preferences](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/diet/preferences/route.ts:1>), [publish flow](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/trainer/diet/plans/[id]/publish/route.ts:25>), [today selection](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/diet/today/route.ts:36>).

## 19. Progress tracking — partial

- Measurements, goals, baseline/latest comparison, photo URLs and trainer review exist.
- **Missing:** Complete weekly/monthly averages plus reading counts; independent latest date/value per metric when entries contain different measurements.
- **Incomplete:** Explicit same-day Edit existing/separate reading choice, unusual-change confirmation and measurement edit/delete lifecycle. Current POST silently updates an existing same-day record; no measurement DELETE endpoint was found.
- **Missing:** Protected Cloudinary upload/delivery/asset deletion and front-to-front/side-to-side comparison flow. Deleting a stored URL reference is not deletion of the external photo/thumbnail.
- **Incomplete:** Imported/manual measurement reconciliation with stable source identifiers and comprehensive consent checks.

Evidence: [measurement comparison/save](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/progress/measurements/route.ts:51>), [same-day overwrite](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/progress/measurements/route.ts:197>), [photo URL API](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/progress/photos/route.ts:89>).

## 20. Notifications/announcements — partial; some delivery is simulated

- In-app inbox/read state, preferences, events, reminder scan, announcements and SMTP sender code exist.
- **Missing:** Actual FCM sending. Code marks push accepted when a token exists without contacting FCM.
- **Incorrect delivery status:** If SMTP is not configured, email is marked accepted through a mock path although nothing was sent.
- **Missing reliable processing:** Business transaction/outbox atomicity, queued worker and bounded failed-channel retry. Payment notification dispatch happens after committing the payment; processed events are not a complete delivery retry system.
- **Incomplete scheduling:** Announcement publish timestamps exist, but no scheduled broadcast worker was found. Future notices can become visible through time-filtered GET without actually generating the scheduled recipient inbox/email/push broadcast.
- **Deployment wiring not present in this repo:** Automatic scheduler/worker trigger. The reminder API/manual scan does not demonstrate an installed recurring job.
- **Incomplete:** Logout does not automatically remove device-token association; the separate token-delete endpoint is not wired into the normal logout flow.

Evidence: [SMTP/push simulation](<D:/SAAS APPS PENDING/gym/web/src/lib/notifications.ts:210>), [payment dispatch outside transaction](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/payments/route.ts:155>), [immediate-only broadcast](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/announcements/route.ts:131>), [scheduler endpoint](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/scheduler/reminders/route.ts:1>).

## 21. Fitness data connection — backend/web foundation present; native integration missing here

- Consent/connection/permissions/sharing API and web controls exist.
- **Missing from this workspace:** Flutter/Android app, Health Connect runtime availability check, actual OS permission prompts, granted-permission checks and real on-device reads. No Dart/pubspec/Android project was found.
- Web permission controls submit reported categories to the backend; they cannot grant or verify Android permissions.
- **Missing:** Device account-switch/logout handling and protected local pending-upload queue from the TXT.

Evidence: [web permissions](<D:/SAAS APPS PENDING/gym/web/src/components/member/FitnessPermissionsModal.tsx:60>), [reported state API](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/fitness/connection/route.ts:129>). TXT: [native connection responsibilities](<D:/SAAS APPS PENDING/gym/requirement.txt:2526>).

## 22. Activity sync/history — backend partial; real source sync missing

- Summary/session upserts, batch IDs, history and available-day averages exist.
- **Missing real sync:** Web Sync now only refreshes GET data; it does not read or upload Health Connect activity.
- **Incomplete source reconciliation:** No complete source-deleted-record/change-checkpoint flow or multi-source overlap handling. Source record IDs and upserts alone do not implement all these rules.
- **Incomplete atomicity/validation:** Batch processing happens through multiple writes before its batch record is saved; complete batch-size/date-range/unit/ownership validation and a consent/connection-version fence are absent.
- **Missing UI:** Custom range on the member Activity screen; the current range type is today/week/month.

Evidence: [Sync now action](<D:/SAAS APPS PENDING/gym/web/src/components/member/FitnessActivitySection.tsx:69>), [sync writes](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/fitness/sync/route.ts:102>), [activity averages](<D:/SAAS APPS PENDING/gym/web/src/lib/fitness.ts:65>).

## 23. Trainer activity insights — substantial implementation, access lifecycle partial

- Shared-category/date filtering, two-week comparison, coverage, observations, feedback and access-request flow exist.
- **Incomplete:** Scheduled assignment effective-date validation, automatic clearing/refetching of an already-open trainer screen on consent revocation, and the complete plan-review/permission-change operational notices.
- Publishing an old draft after reassignment still needs a current-assignment check, not just an author check.

Evidence: [insights access](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/trainer/members/[id]/insights/route.ts:32>), [trainer view](<D:/SAAS APPS PENDING/gym/web/src/components/trainer/TrainerActivityInsightsModal.tsx:1>).

## 24. Sharing/disconnect/delete — controls present, important enforcement gaps

- Separate consent/sharing/disconnect and scoped deletion controls exist.
- **Missing replay protection:** Deletion audit is saved but not enforced by sync as a deletion boundary/consent epoch. Full deletion also removes batch IDs, allowing an old upload to be treated as new. Deleted history can therefore return without the explicit reimport flow required by the TXT.
- **Incomplete disconnect guard:** Sync checks upload consent/reported permissions, but does not reject disconnected connection state as a distinct prerequisite.
- **Missing consistent record-level permission enforcement:** Several member fitness/progress endpoints let any non-member signed-in role select a `memberId`, without the required assignment/consent checks. For example progress-photo GET can return another member's photos to a non-member role.
- **Missing in this repo:** Clearing native caches/queued uploads, permission revoke detection and backup-restoration deletion-boundary replay.

Evidence: [scoped deletion](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/fitness/delete-scoped/route.ts:41>), [sync guards](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/fitness/sync/route.ts:54>), [unrestricted non-member photo path](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/member/progress/photos/route.ts:23>). TXT: [old retries must not restore deletion](<D:/SAAS APPS PENDING/gym/requirement.txt:3023>).

## Financial cross-cutting gaps

- Actual member-refund entry, linked refund acknowledgement and explicit invoice/dues treatment are missing; a Refund model and read-only totals exist, but no complete refund creation/review flow was found.
- Cash-session close exists, but session open/shift ownership, owner review/acceptance, opening cash/refunds/withdrawals/handover movements and mandatory server-side discrepancy reason are not a complete workflow.
- Money is stored as Float rather than the exact Decimal or integer-paisa representation required in the TXT.
- Settings overrides and owner-only approvals need consistent enforcement in the actual APIs, not just permission checkboxes or hidden buttons.

Evidence: [refund model](<D:/SAAS APPS PENDING/gym/web/prisma/schema.prisma:551>), [cash close](<D:/SAAS APPS PENDING/gym/web/src/app/api/v1/cash-session/close/route.ts:23>), [money types](<D:/SAAS APPS PENDING/gym/web/prisma/schema.prisma:479>).

## Recommended implementation order

1. Fix payment allocation/transfer dates, installment balances, duplicate prevention and server pricing/approval checks.
2. Enforce role/record/consent checks consistently; then fix delete/reimport guards.
3. Add recovery/invitation-delivery workflows and operational reception navigation.
4. Finish refunds, advance credit, historical dues and cash-session review.
5. Finish receipt snapshots/PDF/email and matching report exports.
6. Complete real notification delivery/worker/scheduler wiring, protected uploads and native Health Connect integration.

Explicit future/non-required items were not counted as missing launch requirements: online payment gateway, biometric/QR hardware, automated recurring payroll/expense templates, SMS/WhatsApp sending, automatic nutrition prescriptions and optional later background fitness sync.

This list concerns the code found in this workspace. A separate mobile repository, external cron configuration or provider configuration might exist elsewhere; it was not available as evidence for this comparison.
