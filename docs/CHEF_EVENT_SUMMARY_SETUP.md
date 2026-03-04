# Chef event summary setup

Chefs only see events they are **assigned to**. Follow these steps to set up a chef account and have their Event Summary (Calculator tab and Report page) show only their events.

---

## 1. Give the user the chef role in Supabase

The app treats someone as a chef when `app_metadata.role === 'chef'`.

**Option A – Supabase Dashboard**

1. Open [Supabase](https://supabase.com/dashboard) → your project → **Authentication** → **Users**.
2. Find the user (or create one with **Add user**).
3. Open the user → **⋮** → **Edit user** (or **Edit**).
4. Under **User Metadata** or **app_metadata**, set:
   ```json
   { "role": "chef" }
   ```
5. Save.

**Option B – Script (email/password account)**

If you use the project script to create a chef account:

```bash
CHEF_PASSWORD='yourpassword' bash scripts/create-chef-user.sh
```

That creates `chef@hibachi.app` with `role: chef`. Change `CHEF_EMAIL` in the script if you use a different address.

---

## 2. Add them as a staff member with the same email

The app matches the **logged-in chef** to a **staff member** by **email** (case-insensitive). If there is no staff member with that email, the chef sees no events.

1. In the app, go to **Team** (or **Operations** → **Team**).
2. **Add** a staff member (or edit an existing one).
3. Set **Email** to **exactly** the same address the chef uses to log in (e.g. `chef@hibachi.app` or their Google email).
4. Set name, role (e.g. Lead Chef, Full Chef), and other details.
5. Save.

The chef’s login email and the staff member’s email must match so the app can link the account to “events I worked on.”

---

## 3. Assign the chef to events (bookings)

Events show up in the chef’s Event Summary only if that chef is **assigned** to the booking.

1. Go to **Events** → open a booking.
2. Open the **Staff** tab (or the staff assignment step in the booking flow).
3. Assign the chef (the staff member you created) to a role (e.g. Lead Chef, Assistant).
4. Save the booking.

Repeat for every event that chef works. Only those events will appear in:

- **Calculator** → **Event Summary** tab (dropdown and details).
- **Finance** → **Event Summary** (report page), if you gave chefs access.

---

## Quick checklist

| Step | What to do |
|------|------------|
| 1 | In Supabase Auth, set the user’s `app_metadata` to `{ "role": "chef" }`. |
| 2 | In the app **Team**, add (or edit) a staff member whose **email** matches the chef’s login email. |
| 3 | In **Events** → each booking → **Staff** tab, assign that staff member to the events the chef works. |

After that, when the chef logs in they will only see their assigned events in the Event Summary tab and the Event Summary report.
