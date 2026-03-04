# Event creation workflow

Recommended flow for creating and confirming events.

---

## 1. Contact (required)

- **Fields:** Customer name, Email, Phone, Event address — **all required**.
- **Validation:** Single message: *"Please enter required info: [missing fields]."* if any are missing. Phone must be (xxx)-xxx-xxxx.
- **Block:** Cannot proceed to Event details until all required fields are filled and valid.

---

## 2. Event details

- **No status** on this step (status is set on Review or when recording payment).
- **Event date** cannot be in the past; validation message: *"Event date cannot be in the past."*
- **Removed from this step:** Distance (miles), Premium add-on, Discount type. These are handled in **Menu creation** (pricing/distance come from the menu flow). Existing values on the booking are kept when saving details.
- **Collected:** Event type, Event date, Event time, Adults, Children, Notes, Staff assignments / staffing profile.

---

## 3. Payment terms

- **Deposit %:** When changed, **Deposit amount ($)** is auto-calculated as `Total × (Deposit % / 100)`.
- **Deposit amount** remains editable if you need to override.
- **Deposit received:** Section shows the same logic as the Payment column on the Events list:
  - **Deposit Pending** when `amountPaid < depositAmount`
  - **Deposit Received** when `amountPaid >= depositAmount`
- If payment is recorded from the **Events** page (e.g. Record Payment), the booking’s `amountPaid` updates; when you open the wizard again, Step 3 shows the updated **Deposit received** and amount paid.

---

## 4. Menu creation

- User goes to the menu form (Create/Edit menu). On **Save**, they are redirected back to the wizard **Menu** step (`/bookings/[id]?step=menu`) so they can click **Next: Staff assignments**.

---

## 5. Staff assignments

- User goes to the staff assignment page. On **Save assignments**, they are redirected back to the wizard **Staff** step (`/bookings/[id]?step=staff`) so they can click **Next: Review & Confirm**.

---

## 6. Review & Confirm

- **Save as draft:** Always shown. Saves the booking as-is (pending) and navigates to the Events list. Use when the event is not yet confirmed.
- **Confirm Event:** Shown **only when payment is recorded** (i.e. deposit received: `amountPaid >= depositAmount`). Sets status to confirmed and applies payment terms (same as current confirm logic).
- If payment is **not** recorded, only **Save as draft** is shown; **Confirm Event** does not appear until the deposit is recorded (e.g. via Events page → Record Payment).

---

## Proposal email: copy to inbox

- When **Send Proposal** is used, the proposal email is sent to the customer and a **BCC copy** is sent to the authenticated user’s email (inbox). Requires Resend; BCC may require a verified sending domain in production.

---

## Summary flow

1. **Contact** → All required; validation blocks next step.
2. **Event details** → No status, no past dates; no distance/premium/discount here.
3. **Payment terms** → Deposit % drives auto deposit amount; Deposit received section matches Events list.
4. **Menu** → Save redirects to wizard Menu step.
5. **Staff** → Save assignments redirects to wizard Staff step.
6. **Review** → Save as draft always; Confirm Event only when deposit received. Proposal sends copy to inbox (BCC).
