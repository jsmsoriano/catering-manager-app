# Account, Admin, and Auth Implementation Plan

## Overview

This plan covers:

1. **Sidebar**: Show logged-in account info at the bottom and link to an Account page.
2. **Account page**: Profile (display name, photo), edit profile, change password.
3. **Google sign-in**: Allow sign up / sign in with Google (Supabase OAuth).
4. **Admin access**: Restrict Settings and Business Rules to admin users.
5. **Settings vs Business Rules**: Recommendation on merging and nav.

---

## 1. Should Business Rules Be Moved to Settings?

**Recommendation: Yes.**

- **Settings** = single place for “business configuration” (who can see it: admins only).
- **Business Rules** = pricing, staffing, labor, costs, profit (operational config).
- **Account** = current user’s profile, photo, password (everyone).

Proposed structure:

- **One nav item: “Settings”** (admin-only).  
  On that page, use **tabs or sections**:
  - **Business template** – current Settings page content (business type, pricing mode, modules, labels).
  - **Business rules** – current Business Rules page content (money rules, staffing profiles, etc.).

Benefits:

- One place for “admin config”; no separate “Business Rules” in the sidebar.
- Easier to add more admin sections later (e.g. Billing, Team admins).
- Clear split: **Account** = me; **Settings** = business (admin only).

**Implementation:** Add a tabbed (or sectioned) Settings page; move Business Rules content into it; remove “Business Rules” from sidebar; redirect `/business-rules` → `/settings?tab=rules` (or `/settings/rules`) so old links still work.

---

## 2. Sidebar: Account Block at Bottom

**Current:** Footer shows email (truncated), Sign out, Theme toggle.

**Change:**

- **Account block** (above Sign out / Theme):
  - Logged-in user: avatar (or initial) + display name or email.
  - Link to **Account** page (e.g. “Account” or “My account”).
- Keep **Sign out** and **Theme** as today.
- Collapsed state: avatar/initial only; tooltip or flyout with “Account” and “Sign out” if desired.

**Data:**

- Avatar: Supabase `user.user_metadata.avatar_url` (Google) or custom profile photo (see Account page).
- Display name: `user.user_metadata.full_name` or `user.user_metadata.name` or fallback to email.

No new API for sidebar; use existing `useAuth().user` and optionally a small `useProfile()` that reads `user_metadata` + any future profile table.

---

## 3. Account Page (`/account`)

**Purpose:** Let the signed-in user manage their own profile and security.

**Sections:**

1. **Profile**
   - Display name (editable; store in `user_metadata` or `profiles` table).
   - Profile photo: upload or URL.
     - Option A: Store URL in `user_metadata.avatar_url` (or custom key) and host images in Supabase Storage (bucket `avatars`, path `{user_id}`).
     - Option B: Same but add a `profiles` table later for display_name, avatar_url, etc., synced with `auth.uid()`.
   - Email: show only (from `user.email`); optionally “Change email” flow later.

2. **Security**
   - **Change password** (only for email/password users; hide for Google-only users).
     - Use `supabase.auth.updateUser({ password: newPassword })`.
   - If you add email/password to a Google account later, show “Set password” instead.

3. **Connected accounts (optional for v1)**
   - Show “Signed in with Google” or “Signed in with Email”.
   - Later: “Link Google account” for email users.

**Implementation notes:**

- New route: `app/account/page.tsx` (client page).
- Photo upload: Supabase Storage bucket (e.g. `avatars`), RLS so user can read/write only their object; then set `user_metadata.avatar_url` or profile row.
- Use `useAuth()` and `supabase.auth.updateUser()` for name/password; no new tables required for minimal v1 if we only use `user_metadata`.

---

## 4. Google Sign-In

**Yes, you can sign up / sign in with Google** using Supabase Auth.

**Supabase:**

- In Dashboard: **Authentication → Providers → Google** → Enable, add Google OAuth Client ID and Secret.
- In Google Cloud Console: create OAuth 2.0 credentials (Web application), add authorized redirect URIs from Supabase (e.g. `https://<project>.supabase.co/auth/v1/callback`).

**App:**

- **Login page:** Add “Sign in with Google” button; call `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })`.
- **Signup page:** Same button (“Sign up with Google”) and same flow; Supabase creates the user on first Google sign-in.
- **Auth callback:** Existing `/auth/callback` already handles post-OAuth redirect; ensure it exchanges code and redirects to `next` or `/`.

**Result:** Users can create an account or sign in with Google; no password required for those users. Profile info (name, avatar) comes from Google in `user_metadata`.

---

## 5. Admin-Only Access to Settings (and Business Rules)

**Model:**

- Only users with an **admin** role can open **Settings** (and thus Business Rules inside it).
- Non-admins: hide “Settings” in the sidebar; if they hit `/settings` or `/business-rules` directly, redirect to dashboard or show “Access denied”.

**Where to store “is admin”:**

- **Option A (recommended for v1):** Supabase **app_metadata**.
  - Set in Dashboard: Authentication → Users → user → Edit → `app_metadata` → `{ "role": "admin" }`.
  - Or set via a backend function / Edge Function after first signup (e.g. first user becomes admin).
  - In app: `const isAdmin = user?.app_metadata?.role === 'admin'`.
- **Option B:** Custom `profiles` table: `id` (uuid, = auth.uid()), `role` ('admin' | 'user'). Sync on first login (trigger or app code). Then RLS and app read role from `profiles`.

**Implementation:**

- **Auth context / hook:** Extend `useAuth()` (or add `useAuthRole()`) to expose `user` and `isAdmin` (derived from app_metadata or profile).
- **Sidebar:** Build nav items from a list; include “Settings” only when `isAdmin`.
- **Settings page:** At top of page, if `!isAdmin` → redirect to `/` or show “You don’t have access.”
- **Middleware (optional):** For `/settings` and `/business-rules`, optionally check admin in middleware (would require reading app_metadata/server-side); or keep check only in UI + Settings page for simplicity.

**Redirect for old link:**  
`/business-rules` → redirect to `/settings?tab=rules` (or `/settings/rules`) so bookmarks still work.

---

## 6. Implementation Order

| Phase | Task |
|-------|------|
| **1** | **Admin role** – Use `app_metadata.role = 'admin'`; extend auth context with `isAdmin`; in Sidebar, show “Settings” only if `isAdmin`. |
| **2** | **Merge Business Rules into Settings** – Add tabs/sections to Settings (Business template + Business rules); remove “Business Rules” from nav; redirect `/business-rules` → `/settings?tab=rules`. |
| **3** | **Sidebar account block** – In sidebar footer, add account summary (avatar/initial, name or email) and link “Account” → `/account`. |
| **4** | **Account page (basic)** – New `/account`: show email, display name (from user_metadata), “Change password” for email/password users. |
| **5** | **Profile photo** – Supabase Storage bucket for avatars; upload on Account page; save URL in user_metadata or profile; show in sidebar and Account. |
| **6** | **Google sign-in** – Enable Google in Supabase; add “Sign in with Google” on login and signup; test callback; handle Google users (no “Change password” unless they set one). |
| **7** | **Access control** – Settings page: if not admin, redirect or show “Access denied”. Optional: middleware for `/settings` and `/account` (e.g. require auth; admin only for `/settings`). |

---

## 7. File / Route Summary

| Item | Action |
|------|--------|
| `components/Sidebar.tsx` | Add account block (avatar, name/email, link to Account); show “Settings” only when `isAdmin`; remove “Business Rules” nav item. |
| `components/AuthProvider.tsx` (or new hook) | Expose `isAdmin` from `user?.app_metadata?.role === 'admin'`. |
| `app/account/page.tsx` | New: profile (name, photo), change password. |
| `app/settings/page.tsx` | Add tabs: “Business template” (current content), “Business rules” (move from business-rules page). |
| `app/business-rules/page.tsx` | Redirect to ` /settings?tab=rules` (or remove and use only Settings). |
| `app/login/page.tsx` | Add “Sign in with Google” button. |
| `app/signup/page.tsx` | Add “Sign up with Google” button. |
| Supabase | Enable Google provider; create Storage bucket `avatars` (optional, for Phase 5); set one user’s `app_metadata.role = 'admin'` for testing. |

---

## 8. Security and RLS (Optional for Later)

- **Storage:** If you use bucket `avatars`, RLS: allow read/write only for `auth.uid()` on object key `{user_id}/*`.
- **Profiles table:** If added, RLS: user can read/update only row where `id = auth.uid()`.
- **Settings/Business rules:** No RLS change needed if data stays in existing tables (app_settings, money_rules); access is controlled in the app by hiding nav and redirecting non-admins.

---

## Summary

- **Sidebar:** Account info at bottom + link to Account; Settings (and thus Business Rules) only for admins.
- **Account page:** Profile (name, photo), change password; optional “Connected accounts” later.
- **Google:** Yes — use Supabase Google provider and `signInWithOAuth`.
- **Admin:** Use `app_metadata.role === 'admin'`; show Settings only to admins; protect Settings route.
- **Business Rules:** Move into Settings as a tab/section and remove from sidebar; redirect `/business-rules` to Settings.

This plan keeps the first version simple (no new DB table for roles if using app_metadata) and leaves room to add a `profiles` table and more account features later.
