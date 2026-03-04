# Code review: Booking wizard & shopping list

Review based on another agent’s notes: Payment step, Review & Confirm step, and shopping list audit.

---

## 1. Booking wizard – Payment step (not implemented)

**Intended design:** Add a **Payment Terms** step between **Details** and **Menu**:  
Contact → Details → **Payment Terms** → Menu → Staff. Let the user set `depositAmount`, `depositPercent`, `depositDueDate`, `balanceDueDate` during event creation.

**Current state:**

- **Steps** are defined in `lib/bookingWizardSteps.ts` as:  
  `contact` → `details` → `menu` → `staff`.  
  There is **no** `payment` step.
- **Flow:** `saveContact` → `goToStep('details')`; `saveDetails` → `goToStep('menu')`. Payment terms are never edited in the wizard.
- **Booking type** (`lib/bookingTypes.ts`) already has the fields:  
  `depositPercent`, `depositAmount`, `depositDueDate`, `balanceDueDate`.
- **When terms are set today:** Only when the booking is confirmed from the main **Bookings** page (`app/bookings/page.tsx`), via `applyConfirmationPaymentTerms()`, which uses the money rules’ default deposit % and sets deposit/balance due dates if not already set.

**Gap:** Users cannot set payment terms upfront in the wizard; terms are only auto-generated at confirm time.

**Recommendation:** Add a `payment` step in `BOOKING_WIZARD_STEPS` between `details` and `menu`. On the booking detail page, add a Payment Terms step UI that reads/writes `depositPercent`, `depositAmount`, `depositDueDate`, `balanceDueDate` on the booking (and in `formData` if you keep a single form state). After saving, call `goToStep('menu')`. Optionally pre-fill deposit from money rules (e.g. default deposit %) and total.

---

## 2. Booking wizard – Review & Confirm step (not implemented)

**Intended design:** A final **Review & Confirm** step that shows a summary of everything entered, with a **Confirm Event** button that sets status to confirmed, applies payment terms, and can trigger deposit email/proposal.

**Current state:**

- The last step is **Staff** (`stepId === 'staff'`). It only shows “Manage staff assignments” and “Done — Back to Events”. There is **no** summary step and **no** “Confirm Event” in the wizard.
- Confirmation and payment terms are applied on the main Bookings page (e.g. status dropdown → Confirmed, or confirm action that calls `applyConfirmationPaymentTerms`).

**Gap:** The wizard does not close the loop with an explicit “Review → Confirm event” flow; users leave the wizard and confirm elsewhere.

**Recommendation:** Add a `review` (or `confirm`) step as the last step in `BOOKING_WIZARD_STEPS` (after `staff`). On that step render a read-only summary (contact, details, payment terms, menu status, staff). Include a **Confirm Event** button that: (1) updates the booking with `status: 'confirmed'`, (2) calls `applyConfirmationPaymentTerms()` so deposit/balance and payment status are set, (3) saves the booking, (4) optionally opens “Send proposal” or deposit email flow. Then link “Done” to `/bookings` or the booking detail.

---

## 3. Shopping list builder – audit

**Route and entry points:**  
`/bookings/shopping` is implemented in `app/bookings/shopping/page.tsx`. It expects `?bookingId=`. If `bookingId` is missing or the booking is not found, it redirects to `/bookings`. The main Bookings list links to it (Actions → “Add Shopping List” / “Update Shopping List”; card icon when a list exists). No direct link from the wizard (e.g. from the Menu step); that’s acceptable since the list is event-scoped and the main list is the primary entry.

**Behavior:**

- Loads booking and shopping list from localStorage; creates a list per booking when needed (`ensureShoppingListForBooking`).
- **Generate From Menu:** Uses `eventMenus` (hibachi) or `cateringEventMenus` (catering); builds items with portions, oz/portion, qty required (lbs), and optional package price/weight/unit required.
- **Table:** Item, Category, Portions, Oz/portion, Qty required (lbs), Unit required, Pkg $, Pkg weight (lbs), Line total, Purchased, Actions. Manual items supported; no override checkbox/columns.
- **Save List**, **Mark Purchased**, **Sync Totals to Expenses** are present. Totals and line totals use package-based math when package fields are set.

**Possible polish / gaps:**

1. **Wizard discoverability:** Optional “Create shopping list” (or “Add Shopping List”) link on the Menu or Staff step that goes to `/bookings/shopping?bookingId={id}` so users can open the list without leaving the wizard flow.
2. **Empty state:** When there are no items, the table shows “No items yet. Add ingredients and supplies above.” Clear and fine.
3. **Validation:** No strict validation that a menu exists before “Generate From Menu”; if no menu, generation yields no items (handled). Could add a short hint like “Create a menu first” when the event has no menu and the list is empty.
4. **Back navigation:** Breadcrumb/link to the booking (e.g. “Back to [Customer name]” or “Edit Booking”) is present and good for UX.

**Verdict:** Shopping list route and page are in good shape; the redesign (portions → lbs, unit required, package $/weight) is consistent. Gaps are minor (optional wizard link, optional “create menu first” hint).

---

## Summary

| Area                 | Status        | Action |
|----------------------|---------------|--------|
| Payment wizard step  | Not implemented | Add step between Details and Menu; form for deposit %, amount, deposit due date, balance due date; persist on booking and in wizard state. |
| Review & Confirm step| Not implemented | Add final step with summary + “Confirm Event” that applies confirmation and payment terms and optionally triggers proposal/deposit email. |
| Shopping list        | Implemented   | Optional: link from wizard (Menu/Staff); optional “Create menu first” when no menu. |

The other agent’s notes describe the **intended** design. The code currently has the four-step wizard (Contact → Details → Menu → Staff) and no Payment or Review & Confirm steps; payment terms are applied only when confirming from the main Bookings page.
