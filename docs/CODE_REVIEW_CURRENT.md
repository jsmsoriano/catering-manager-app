# Code review – current changes

Review of the codebase after recent changes (Pipeline/Kanban, Settings/Menu, Supabase migrations, Bookings payment/refund and UI).

---

## 1. Pipeline (CRM Kanban) – `app/pipeline/page.tsx`

**Strengths**
- Clear separation: metrics bar, columns, cards, drag overlay.
- Correct drop handling: column id or card id (target column derived from card’s `pipeline_status`).
- Backfill on load: `ensurePipelineStatus` + write-back when missing; `normalizeBookingWorkflowFields` keeps payment/balance consistent.
- Sync: listens to `bookingsUpdated` and `storage`; `persistBookings` triggers write-back to Supabase.
- Status sync: moving to Booked sets `status: 'confirmed'`, to Completed sets `status: 'completed'`.
- Color coding and DragOverlay keep UX clear.

**Minor**
- `loadBookings` is wrapped in `useMemo(() => () => { ... }, [])`; the inner function is stable. No issue.
- Cancelled bookings are excluded from the board; consider an optional “Cancelled” column if you want to see them.

**No issues found.**

---

## 2. Booking workflow – `lib/bookingWorkflow.ts`

**Strengths**
- `derivePaymentStatus`: deposit-paid/deposit-due checked before forcing unpaid for pending; “Deposit Received” shows correctly after recording a deposit.
- `applyPaymentToBooking` / `applyRefundToBooking`: single responsibility; refund sets `status`/`serviceStatus` to `cancelled` and re-derives payment status (refunded when amountPaid > 0).
- `getDefaultPipelineStatus` / `ensurePipelineStatus`: backfill logic is consistent with DB layer.

**Minor**
- `applyRefundToBooking` always sets the booking to cancelled. If you later support “partial refund, booking still active,” you’d add a branch that only reduces `amountPaid` and does not set cancelled.

**No issues found.**

---

## 3. Bookings page – payment and UI

**Paid-in-full → Confirmed**
- After `applyPaymentToBooking`, if `paymentStatus === 'paid-in-full'` and current status was pending, the booking is updated to `status: 'confirmed'`, `serviceStatus: 'confirmed'`, and `confirmedAt` (existing or `now`), then re-normalized. Logic is correct.
- Optional: use the payment date as `confirmedAt` when auto-confirming (e.g. `confirmedAt: paymentForm.date` in ISO or combined with `now` for time) for clearer audit trail.

**Refund flow**
- Refund type and validation (amount ≤ amountPaid), `applyRefundToBooking`, and saving customer payment with `type: 'refund'` are consistent.
- Refund warning copy in the modal is clear.

**Actions dropdown**
- `openDropdownBelow = isFirstRow || !isLastRow` so the first row (including when it’s the only row) opens below; last row when there are multiple opens above. Prevents top cutoff.

**Payment column**
- Uses `paymentDisplayLabel(booking.paymentStatus)`; status is derived in `saveBookings` via `normalizeBookingWorkflowFields`, so “Deposit Received” and “Paid in Full” / “Refunded” stay in sync after payments/refunds.

**No issues found.**

---

## 4. Settings and Menu

**Settings**
- Tabs: Business template, Business rules, Menu Settings; `activeTab` from `tab` search param; `MenuSettingsContent` rendered for `tab=menu`. Tab links and max-width for menu tab are correct.
- Imports (e.g. `WEDDING_CATERING_TEMPLATE`, `BBQ_TEMPLATE`, `CORPORATE_CATERING_TEMPLATE`) are used for presets; no dead code.

**Menus**
- `MenuSettingsContent` exported and used in Settings; `/menus` redirects to `/settings?tab=menu`. Sidebar no longer has a top-level Menus link. Coherent.

**No issues found.**

---

## 5. Supabase and data layer

**Migrations**
- 008: `pipeline_status`, `pipeline_status_updated_at` on `bookings`.
- 009: `event_menus.booking_id` → TEXT (store `app_id`); FK dropped.

**Inquiry form**
- Inserts `pipeline_status: 'inquiry'`, `pipeline_status_updated_at: now`; inserts `event_menus` with `booking_id: bookingId` (app_id). Matches 009 and fixes guest menu lookup on Inquiries page.

**DB layer – `lib/db/bookings.ts`**
- `BookingRow` and `toRow`/`fromRow` include pipeline fields; `defaultPipelineStatus(row)` used in `fromRow` when `pipeline_status` is null. Backfill aligns with `getDefaultPipelineStatus` (inquiry from source, then status mapping).

**No issues found.**

---

## 6. Types – `lib/bookingTypes.ts`

- `PipelineStatus` and optional `pipeline_status` / `pipeline_status_updated_at` on `Booking` are consistent with DB and UI.
- No issues found.

---

## 7. Summary

| Area              | Status   | Notes                                                                 |
|-------------------|----------|-----------------------------------------------------------------------|
| Pipeline Kanban   | Good     | Backfill, drag/drop, metrics, sync; optional Cancelled column later   |
| Booking workflow  | Good     | Payment/refund and status derivation behave as intended               |
| Bookings payment  | Good     | Paid-in-full → confirmed; refund → cancelled; optional confirmedAt   |
| Actions dropdown  | Good     | First row opens below to avoid top cutoff                             |
| Settings / Menu   | Good     | Tabs and redirects correct                                           |
| Supabase / DB     | Good     | Migrations 008/009 and inquiry form aligned with app_id usage         |
| Types             | Good     | Pipeline and booking types consistent                                |

**Lint**
- No linter errors reported for the files reviewed.

**Suggested follow-ups (optional)**
1. When auto-confirming on paid-in-full, consider setting `confirmedAt` from the payment date (or payment date + current time) for a clearer audit trail.
2. Pipeline: consider a “Cancelled” column if you want to see cancelled deals on the board.
3. Refund: if you ever support “partial refund, booking still active,” extend `applyRefundToBooking` (or add a separate path) so cancelled is only set when appropriate.
