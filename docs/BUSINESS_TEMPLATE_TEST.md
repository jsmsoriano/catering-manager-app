# Business Template – Manual Test Checklist

Use this checklist to verify the Business Template system (hibachi vs private chef) without duplicating the pricing engine or breaking existing flows.

---

## 1. Existing hibachi bookings still work

- [ ] Open the app with existing bookings in localStorage (or seed a few).
- [ ] Open an existing booking (created before template fields existed). It should open without errors.
- [ ] Confirm **Guests** column and form show as before; **Premium Add-on** field is visible (hibachi template has `guest_pricing` enabled).
- [ ] Edit and save the booking. No regression in totals or payment flow.
- [ ] In the saved booking, `pricingMode` and `businessType` can remain null; the app treats null as hibachi + per_guest.

---

## 2. Switching to private chef changes labels and modules

- [ ] Go to **Settings**.
- [ ] Switch to **Private chef** (or apply the “Private chef” preset).
- [ ] Save. Return to **Bookings**.
- [ ] Open the bookings list: **Guests** column may show as **Covers** if you customized labels.
- [ ] Open **New Booking** or an existing one: the **Premium Add-on** field should be **hidden** (private chef template disables `guest_pricing`).
- [ ] Confirm other sections (event basics, staffing, travel, taxes, profit summary) still appear as configured.

---

## 3. New booking gets template defaults

- [ ] Set template to **Hibachi** in Settings; save.
- [ ] Create a **New Booking**, save it.
- [ ] Confirm the saved booking has `pricingMode: 'per_guest'` and `businessType: 'hibachi'` (inspect in app state or localStorage).
- [ ] Set template to **Private chef**; save.
- [ ] Click **New Booking** (or reset form). Confirm form initializes with `pricingMode: 'flat_fee'` and `businessType: 'private_chef'`.
- [ ] Save. Confirm the new booking has those values stored.

---

## 4. Calculations unchanged; no duplicate pricing engine

- [ ] With **Hibachi** template, create or open a booking with guests, premium add-on, distance. Note subtotal, gratuity, distance fee, total.
- [ ] Confirm numbers match the existing rules (same as before template feature). No second calculation path.
- [ ] Switch to **Private chef** and open the same booking (or one with same inputs). Calculations should be identical when rules/overrides are the same.
- [ ] Confirm **lib/moneyRules.ts** remains the single calculation core (no duplicate engine).

---

## 5. Settings round-trip and presets

- [ ] In Settings, change **Business type**, **Default pricing mode**, **Enabled modules** (e.g. disable **Guest pricing** for hibachi), and one or two **Labels**.
- [ ] Save. Reload the app. Reopen Settings and confirm all values persisted.
- [ ] Apply **Hibachi** preset: defaults and modules reset to hibachi template.
- [ ] Apply **Private chef** preset: defaults and modules reset to private chef template.

---

## 6. Compatibility layer for old bookings

- [ ] With at least one booking that has **no** `pricingMode` or `businessType` (legacy):
  - [ ] Open it: form shows template defaults for pricing mode and business type in the UI.
  - [ ] Save without changing them: booking can remain without these fields (or get them set from template); no errors.
- [ ] Existing behavior (hibachi + per_guest when null) is unchanged.

---

*After all items pass, the Business Template implementation is ready for use.*
