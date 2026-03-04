# Inquiry Form & Notifications Workflow

## Overview

- **Notifications** (formerly Inbox): Where the business sees new inquiries and alerts (overdue deposits, etc.).
- **Inquiry form**: Customer-facing form (shareable link, websites, social). Simulates **steps 1, 2, and 4** of the event booking wizard: **Contact → Event details → Menu**. No payment, no staff, no business financials. Submissions are saved as **draft** inquiries; the business completes the rest in the app.

---

## 1. Rename: Inbox → Notifications

- **Sidebar**: Label "Inbox" → "Notifications" (same route `/inquiries`, same feature flag key `inbox`).
- **Page title**: "Inbox" → "Notifications".
- **Settings**: Feature description updated to "Notifications (inquiries & alerts)".
- **Badge**: Unreviewed inquiries + critical alerts; variable renamed to `notificationBadgeCount` for clarity.

---

## 2. Inquiry Form (Customer-Facing)

**Purpose**: Single shareable form for websites, social media, or direct link. No login; no business financials.

**Route**: `/inquiry` (and optionally `/inquiry-form` as alias).

**Steps (align with booking wizard steps 1, 2, 4):**

| Step | Name           | Content |
|------|----------------|--------|
| 1    | Contact        | Name, phone, email (no event address required for inquiry). |
| 2    | Event details  | Event type, occasion, date, time, location, adults, children, notes. No status, no distance, no premium, no discount, no pricing. |
| 3    | Menu           | **Hibachi / private-dinner**: Per-guest protein choices and sides (no prices). **Catering**: Optional “Menu or catering preferences” text. |
| 4    | Review & submit| Summary of contact, event, and menu; submit button. |

**On submit:**

- Create booking with `source: 'inquiry'`, `status: 'pending'`, no financials (totals can be 0; business sets later).
- Create or update `event_menus` with `guest_selections` (hibachi) or leave empty (catering preferences in notes if needed).
- Optional: send inquiry-ack email to customer.
- Data stored in Supabase (and synced to app via existing sync so it appears in Notifications).

**No business financials**: No deposit, no total, no pricing, no staff—customer only provides contact, event details, and menu preferences.

---

## 3. Efficient Workflow (Business Side)

1. **Customer** fills the inquiry form (Contact → Event details → Menu) and submits.
2. **Submission** is saved as a **draft** inquiry (booking with `source: 'inquiry'`, `pipeline_status: 'inquiry'`).
3. **Business** sees it under **Notifications** (`/inquiries`). New inquiries can be highlighted (e.g. not yet “[reviewed]”).
4. **Business** opens the inquiry and can:
   - **Convert to booking**: Move to Events, add payment terms (step 3), assign staff (step 5), confirm when ready. Menu data from the form is already there (guest selections for hibachi or notes for catering).
   - **Decline**: Mark as declined and optionally notify.
5. **Completing the booking**: Payment terms, staff, and “Confirm Event” are done in the main event booking flow (or from the inquiry detail actions), not on the public form.

---

## 4. Shareable Link & Embedding

- **Link**: `https://yourdomain.com/inquiry` (or `/inquiry-form` if alias is added).
- Use this link on websites, social media, or in emails.
- Form is public (no auth); middleware already allows `/inquiry` as a public path.
- Embedding: Use an iframe with `src="https://yourdomain.com/inquiry"` if the form is to be embedded on another site.

---

## 5. Implementation Checklist

- [x] Rename Inbox → Notifications in UI and docs.
- [x] Inquiry form: Add **Menu** step (step 3) and move Review to step 4.
- [x] Menu step: Hibachi = per-guest proteins/sides (no prices); Catering = optional preferences text.
- [x] Submit: Persist `guest_selections` to `event_menus` for hibachi; catering preferences in notes; keep inquiry as draft.
- [x] Optional: Add `/inquiry-form` route that redirects to `/inquiry` for clearer naming in marketing.
