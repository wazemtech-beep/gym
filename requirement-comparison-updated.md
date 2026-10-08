# Requirement comparison — updated source review

Reviewed: 6 October 2026. Source: `requirement.txt`, current `web/src`, Prisma schema and package declarations.

Scope: all non-mobile requirements. Native mobile screens, device queues and mobile delivery are deliberately excluded from the missing list. Shared server permissions, privacy and synchronization rules remain in scope.

This is a code inspection, not runtime verification. No new tests, browser verification, database operations or provider calls were performed for this review after the instruction to inspect code only. Application files were not changed. The codebase has changed since the earlier comparison; this report supersedes its missing-feature list. “Present” means an implementation exists, not that every requirement or edge case is complete.

## Features now present

Password recovery by email/code, staff invitation resend, dedicated invoices/payments pages, reception dashboard, payment allocation across invoices, installment settlement, confirmed transfer allocation, refund records, vendor refund endpoint, Cloudinary upload controls, downloadable receipt PDF, SMTP/FCM sender code, scheduled-announcement processing and measurement deletion now have implementations. These should not remain on the old list as wholly missing features.

## Highest-priority gaps

### 1. Record access and privacy are inconsistent

- `src/app/api/v1/refunds/route.ts` GET rejects trainers but does not restrict members to their own refunds. With no filter it queries all refunds; a supplied member/payment filter is not checked against the signed-in member.
- `src/app/api/v1/payments/route.ts` scopes members, but the non-member branch does not explicitly reject trainers from financial records.
- Financial report routes permit receptionist access without consistently enforcing the required own-staff scope and individual grants.
- Measurement reads check trainer assignment but do not consistently enforce measurement-sharing consent. Photo edit/delete routes do not consistently enforce record ownership for non-member roles.
- Cloudinary deletion accepts a supplied asset ID without checking its ownership. Upload URLs use ordinary delivery rather than establishing private authenticated access for sensitive progress assets.
- Several core routes use role permissions while individual staff grants exist separately. A restriction in settings therefore does not reliably restrict every corresponding operation.

Requirement impact: member-only records, trainer consent, receptionist restrictions and owner-controlled grants are incomplete.

### 2. Advance credit has no complete later application flow

Overpayments and cancellation credits are recorded, but the reviewed source has no `advanceCredit.update/updateMany`, credit-consumption allocation or equivalent later-fee application flow. The requirement needs credit to reduce a later invoice without counting another cash collection.

Evidence: `src/lib/financialAllocation.ts`, payment/membership routes and `prisma/schema.prisma`.

### 3. Financial writes are not protected against all concurrent requests

Receipt numbering reads the previous payment and checks availability before creation. Allocation reads balances and writes computed totals. Two simultaneous requests can choose the same number or compute against the same old invoice balance. Some APIs accept an optional idempotency key, but the reviewed payment components do not supply a stable request key. Duplicate-submit and simultaneous-settlement requirements are consequently incomplete.

Evidence: `src/lib/financialAllocation.ts`, `src/app/api/v1/payments/route.ts`, payment components.

### 4. Cancellation/freeze rules are incomplete

Cancellation calculates credit from the plan fee and remaining days, without establishing the eligible amount actually paid. Balance increment, credit creation and membership cancellation are separate writes. The selected membership is not consistently checked against the member in the route. Scheduled freeze periods, durable freeze/resume history and adjustment of future renewals are incomplete. Overlap checking exists but is performed before the transaction, leaving simultaneous-renewal protection incomplete.

Evidence: `src/app/api/v1/members/[id]/membership/route.ts`.

The previous schema-field mismatch in cancellation credit creation has been corrected in the current source; it is not counted as a remaining gap.

### 5. Notification outbox/retries are incomplete

`processNotificationOutbox` loads existing pending events and calls `dispatchNotification` with their deduplication keys. `dispatchNotification` returns immediately whenever that key already exists, including an unprocessed event. Those pending events can therefore be skipped without delivery. Failed delivery does not have a complete bounded retry flow. Business events and their notification records are not consistently saved in one transaction.

Evidence: `src/lib/notifications.ts`, payment notification dispatch after the financial transaction.

SMTP/FCM implementations and scheduled processors exist. Actual credentials, delivery and deployed scheduling are not established by source inspection.

## Remaining requirements by module

### Authentication, roles and member activation

Recovery and invite resend exist. Better Auth is installed but the reviewed application uses its own authentication implementation rather than integrating the specified library. Separate member login-email verification and consistent current-record/grant/consent enforcement remain incomplete. Invitation/password/session edge cases should not be described as verified merely because their routes exist.

### Collection dashboard and cash drawers

The collection UI shows collection totals but does not expose all required outstanding/overdue dues, active/expiring membership metrics and custom date/account/staff drilldowns. Some financial date boundaries use server-local dates instead of explicitly applying Karachi time.

Cash-session close chooses a supplied session or latest global open session without enforcing staff ownership. A difference reason is stored but not required when the count differs. It immediately records owner handover rather than providing a separate owner acceptance/review flow. Payment drawer selection also needs per-staff ownership.

Evidence: collection components/report routes; `src/app/api/v1/cash-session/close/route.ts`; payments route.

### Members and opening balances

Core member registration/profile/ledger exist. Authorized shared-family contact handling with a recorded reason, stable registration retry protection, complete opening-balance as-of/note/correction handling and separate account-email verification are incomplete.

### Fee plans and membership pricing

Plans and membership snapshots exist. Incrementing the version on the same plan record does not preserve a complete immutable historical plan definition. A durable plan-version history is still required. Current plan-price lookup and owner-only custom discount checks now exist.

### Invoices, payment allocation and discounts

Invoice/payment directories, installment balances and multi-invoice settlement exist. Remaining gaps include applying existing advance credit, concurrency protection, complete issued/paid invoice correction and reallocation rules, stored approval identity for every approval-dependent concession, and the complete admission-waiver treatment. The payment UI does not expose the API's backdate-reason flow.

### Receipts and refunds

Receipt PDF and allocation/balance snapshots exist. Receipt generation still reads some member details from the current member record, so an old receipt can change after a profile edit. The required complete historical branding/member snapshot is incomplete. Automatic receipt-email preference is saved but has no consumption outside settings in the reviewed source. Refund records exist; full linked acknowledgement/snapshot coverage is not established.

Evidence: receipt download route, `src/lib/settings.ts`, settings component and payment/transfer creation.

### Expenses and payables

Expenses, payment records and a vendor-refund endpoint exist. Complete paid-expense adjustment/vendor-refund reconciliation and consistent restrictions around salary/private attachments remain incomplete or not established. Recurring-expense templates are explicitly future scope in the TXT and are not counted as a missing current requirement.

### Reports and exports

Historical dues reconstruction has been added, but using a payment's current reversed status cannot reconstruct its state before the reversal date. Dated refunds/credits, installment-due portions and void handling are not comprehensively accounted for. Report/export filters and calculations are not consistently shared.

The Excel generator emits SpreadsheetML XML (`.xls` style), not a genuine `.xlsx` workbook. Complete generated report PDFs, private large-export jobs and screen/export parity remain incomplete. Receipt PDF availability does not satisfy all report-PDF requirements.

Evidence: dues/export routes and `src/lib/excelGenerator.ts`.

### Attendance and gym settings

Attendance controls and server checks exist. The optional-off state does not consistently hide navigation, and legacy/current permission handling differs. Settings for invoice due days and automatic receipt email are stored but not used by the corresponding business flows in the reviewed source. Uniform version/conflict protection, complete before/after audits and operational backup/status coverage are not established across settings.

### Member web portal

Fees, membership, workout, diet and progress sections exist. Underlying receipt snapshots, credit application, assignment effective dates, privacy and progress-analysis gaps affect the portal as well. Complete profile/request and published-plan renewal request behavior is not established. Native mobile UI is excluded.

### Trainer assignment and consent

Owner-only assignment creation exists. A future assignment deactivates the old assignment and changes the primary trainer immediately instead of retaining the old trainer until the effective date. Access queries relying only on `isActive` do not consistently honor start/end dates. Workout/diet publishing checks plan creator rather than always checking current assignment and consent, so reassignment rules are incomplete.

### Workouts and exercise logs

Plan editors and session logs exist. The editor does not cover the complete strength/cardio/mobility fields and per-exercise instructions, alternatives and rest settings required by the TXT. Today-plan selection does not consistently apply effective date ranges/rest-day behavior. Actual per-set logging, stable web submission identities and correction history are incomplete. Native offline queues remain excluded.

### Diet plans and review requests

Diet templates and allergy checks exist. Complete preference/review change requests and trainer notices, estimate sources, effective-date selection and allergy revalidation at publication are incomplete.

### Measurements and progress photos

Measurements, photos, basic progress views and measurement deletion exist. Required weekly/monthly metric averages with reading counts, metric-specific last-reading dates, explicit same-day reading choice and unusual-entry confirmation are incomplete. Photo ownership, consent, private delivery and asset-deletion lifecycle require the access fixes described above.

### Notifications and announcements

In-app notifications, email/push senders and announcement processors exist. Atomic outbox creation, pending-event delivery, bounded retries, delivery-status accuracy and full obsolete-event handling remain incomplete. Deployment scheduling cannot be confirmed from application source alone.

### Shared fitness synchronization, trainer insights and reconciliation

Native mobile features remain pending and are excluded. Shared fitness routes accept non-member-selected member IDs without consistently proving that caller's authorization. Consent-epoch/deletion replay handling and explicit reimport protections need consistent enforcement rather than trusting a request flag. Trainer insights must honor the actual effective assignment period. Complete cross-source overlap reconciliation and category-level history/privacy behavior are not established.

## Overall conclusion

The non-mobile app covers many of the requested features, and several earlier omissions have been implemented. It does not yet satisfy all non-mobile requirements. Prioritize record-access restrictions, credit application, concurrent financial writes, cancellation/freeze accounting and notification outbox processing; then complete report parity, historical snapshots, effective-date rules and the remaining user workflows.
