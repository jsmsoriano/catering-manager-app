# Catering Manager App — Wiki

## Table of Contents
1. [Booking Workflow](#booking-workflow)
2. [Proposal & Client Workflow](#proposal--client-workflow)
3. [Menu & Shopping List Workflow](#menu--shopping-list-workflow)
4. [Chef Portal Workflow](#chef-portal-workflow)
5. [Business Rules & Calculator](#business-rules--calculator)
6. [Staff Management](#staff-management)
7. [Financial Reports](#financial-reports)
8. [Common Questions & Troubleshooting](#common-questions--troubleshooting)

---

## Booking Workflow

### How do I create a new booking?
1. Go to **Bookings** → click **New Booking**
2. Fill in customer name, email, phone, event date, time, location
3. Enter guest count (adults / children separately — children get 50% discount by default)
4. Select event type (Hibachi Private Dinner, Hibachi Buffet, Catering, etc.)
5. Click **Save** — the booking enters the pipeline at **Inquiry** stage

### What are the booking statuses?
| Status | Meaning |
|--------|---------|
| Inquiry | New lead, not yet confirmed |
| Proposal Sent | Client has received a quote |
| Confirmed | Deposit received, event is locked |
| Completed | Event occurred |
| Cancelled | Booking cancelled |

### How do I move a booking through the pipeline?
- Open the booking → go to the **Details** tab
- Change the **Status** field
- Confirmed bookings require a deposit. Set deposit % in Business Rules (default 30%)

### How do I add a deposit?
- Open booking → **Payment** tab → enter deposit amount and mark as received
- The balance due auto-calculates

### Can I lock a booking to prevent changes?
- Yes — open booking → toggle the **Lock** switch in the header
- Locked bookings cannot be edited until unlocked by an admin

---

## Proposal & Client Workflow

### How do I send a proposal to a client?
1. Open the booking → go to **Details** tab
2. Click **Generate Proposal** — this creates a shareable link with a token
3. Click **Copy Link** and send it to the client via email or text
4. The proposal page shows the client their event details, pricing, and menu options

### What can the client do on the proposal page?
- View event summary and pricing
- Accept the proposal (triggers confirmed status)
- Update guest count (within the allowed window)
- Request a menu change (within the menu change cutoff)

### How long is a proposal token valid?
- Default: **30 days** from creation
- Admin can regenerate a new link if it expires

### What is the menu change cutoff?
- By default, clients cannot change the menu within **X days** of the event
- Configure this in **Settings → Business Rules**

---

## Menu & Shopping List Workflow

### How do I set up the menu for a hibachi event?
1. Open the booking → **Menu** tab
2. Each guest's protein selections are entered here (Protein 1, Protein 2)
3. Sides: Fried Rice, Noodles, Salad, Vegetables (yes/no per guest)
4. Once all guest selections are entered, click **Save Menu**

### How is pricing per plate calculated for hibachi?
- Base price is set in **Business Rules → Pricing** (default $65/adult)
- Each protein add-on has its own price (Chicken +$6, Filet Mignon +$10, Scallops +$8)
- Children receive a 50% discount on the base price

### What portion sizes does the shopping list use?
| Item | Portion |
|------|---------|
| Proteins (chicken, steak, etc.) | **4.5 oz per plate** |
| Sides (fried rice, noodles, etc.) | 4 oz per portion |

### How do I generate the shopping list?
1. After filling in the guest menu, go to **Bookings → Shopping List** (or open the booking → Shopping tab)
2. Click **Generate from Menu** — the app automatically calculates total pounds needed per ingredient
3. The list shows: ingredient name, portions needed, oz per portion, total lbs required
4. You can add manual items (propane, supplies) alongside the auto-generated food items
5. Enter package prices and weights to see total cost

### How do I read the shopping list quantities?
- **Portions** = number of plates/servings ordered
- **Lbs Required** = `(portions × oz per portion) ÷ 16`
- Example: 10 guests order chicken → 10 × 4.5 oz ÷ 16 = **2.8 lbs** of chicken

### Can I override quantities on the shopping list?
- Yes — click any generated item to edit the planned quantity or oz per portion
- Manual overrides are preserved when regenerating from the menu

---

## Chef Portal Workflow

### How do I access the Chef Portal?
- Log in with your chef account → you'll see the **Chef Portal** view
- Shows only events where you are assigned as staff

### What does the Chef Portal show?
- **Upcoming Events** — your assigned events in chronological order
- **Completed Events** — past events for reference
- Each event card shows: customer name, date/time, guest count, location, status, total

### How do I view the event summary as a chef?
- Click **View Summary** on any event card
- The event summary shows: event details, your pay breakdown (base pay + gratuity share), food costs, and staff list

### How is a chef's pay calculated?
| Component | Calculation |
|-----------|-------------|
| Base pay | % of event subtotal (Lead Chef: 15%, Full Chef: 10%, Assistant: 8%) |
| Gratuity share | % of total gratuity (Chefs: 55%, Assistant: 45%) |
| Total | Base pay + gratuity share |

---

## Business Rules & Calculator

### What is the Event Calculator?
The calculator at `/calculator` has four tabs:
- **Calculator** — scenario tool: enter guests, price, staff to see live pay/profit breakdown
- **Event Summary** — per-event breakdown for your actual assigned bookings
- **Overhead & Reserves** — track monthly fixed expenses (rent, insurance, etc.)
- **Business Rules** — visual breakdown of where every dollar goes, and chef-owner compensation model

### What does the Business Rules tab show?
- **Dollar flow chart**: food cost %, supplies %, labor %, tax reserve %, distributable profit %
- **Example event breakdown**: line-by-line dollars for a typical 15-guest event
- **Chef-owner compensation**: the three-part pay model

### How is the chef-owner paid?

The chef-owner receives three types of compensation:

| Source | Default | Timing |
|--------|---------|--------|
| **Revenue share** | 20% of event subtotal | Per event |
| **Gratuity share** | 60% of event gratuity | Per event |
| **Monthly profit share** | 40% of remaining distributable profit | Month end |

**Example** (15 guests @ $65):
- Subtotal: $975 → Revenue share = **$195**
- Gratuity (20%): $195 → Gratuity share = **$117**
- Per-event total = **$312**
- Month-end profit pool (after all events) → additional 40% share

Configure these percentages in **Settings → Business Rules → Chef-Owner Compensation**.

### What are the default cost targets?
| Category | Default % |
|----------|-----------|
| Food cost | 18% of subtotal |
| Supplies | 7% of subtotal |
| Labor | ~25–30% of revenue |
| Tax reserve | 30% of gross profit |

### How do I use the Scenario Calculator?
1. Go to **Calculator** → **Calculator** tab
2. Set: number of guests, price per guest, gratuity %
3. Add staff entries (role + pay amount)
4. See live: subtotal, gratuity, food cost, labor cost, gross profit, owner distributions

---

## Staff Management

### How do I add staff members?
- Go to **Bookings → Staff** → click **Add Staff**
- Enter name, role, email (optional), phone (optional)

### How do I assign staff to an event?
- Open the booking → **Staff** tab
- Select staff members and assign their role for that event (Lead Chef, Full Chef, Assistant)

### How does the app match chef accounts to staff profiles?
- The chef's **email** in Supabase Auth is matched to the **email** field on their staff profile
- If no match is found, the chef portal shows all events (unfiltered)
- Make sure the staff profile email matches the login email exactly

### Can I set custom pay for a staff member on a specific event?
- Yes — in the booking → Staff tab, you can override the default pay % per person per event

---

## Financial Reports

### Where can I see financial reports?
- **Reports** → choose from: Event Summary, Sales Funnel, Orders
- **Calculator → Event Summary** tab — detailed per-event financial breakdown

### What is the Event Summary Report?
- Shows revenue, costs, labor, and profit for a selected booking
- Includes staff compensation breakdown per person

### How do I track monthly profit distribution?
- Calculator → Overhead & Reserves tab
- Tracks retained earnings balance and distribution transactions

---

## Common Questions & Troubleshooting

### The chef portal shows "Unknown error" — what does it mean?
- This usually means the database query failed. Check:
  1. Supabase is online and the connection env vars are set correctly
  2. The chef's staff profile email matches their login email
  3. Check Vercel function logs for the specific error message

### Why doesn't my booking show up in the chef portal?
- The chef must be assigned to the booking in the **Staff** tab
- The chef's auth email must match their staff profile email
- Make sure the booking is not cancelled

### Why is the shopping list empty after saving the menu?
- Make sure at least one guest selection is saved (protein 1 must be set)
- Go to Bookings → Shopping → click **Generate from Menu**
- If still empty, check the booking ID in the menu tab matches the shopping list

### How do I reset a proposal token (link expired or compromised)?
- Open the booking → Details tab → click **Regenerate Proposal Link**
- The old link is invalidated and a new 30-day token is created

### Can clients see the full price breakdown on their proposal?
- Yes — the proposal page shows subtotal, gratuity, and total
- Food cost and staff pay are NOT shown to clients (internal only)

### How do I add a new protein to the menu?
- Go to **Settings → Business Rules → Protein Add-Ons**
- Click **Add Protein** → set name, label, and price per person

### What happens if a client accepts a proposal?
1. Booking status automatically changes to **Confirmed**
2. The proposal token is marked as accepted
3. The client is shown a confirmation screen
4. Admin receives a notification (if email configured)

### How does the distance fee work?
- First 20 miles: free
- Miles 21+: $50 base fee + $25 per additional 5-mile increment
- Configure in **Settings → Business Rules → Distance Fees**

### How do I generate BEO (Banquet Event Order)?
- Open booking → click **BEO** in the top nav or side menu
- The BEO page shows all event details formatted for kitchen/staff use

### Can I export data?
- Financial reports can be printed from the browser
- Shopping lists can be printed via the print button on the shopping page
- CSV export is not yet available (planned feature)
