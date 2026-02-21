# Code review: agent changes

Review of the current codebase after agent changes (auth, sidebar, settings, account, business rules, bookings, menus, etc.).

---

## What looks good

- **AuthProvider** – `isAdmin` is exposed correctly from `user?.app_metadata?.role === 'admin'`.
- **LayoutSwitcher** – Sidebar wrapped in `print:hidden` so it doesn’t show when printing.
- **Sidebar** – Collapsible sidebar, flyout for collapsed state, account block at bottom (avatar/initial, link to `/account`), Sign out and Theme toggle. Uses `visibleNav` and accordion/flyout logic consistently.
- **Settings page** – Tabs (Business template | Business rules), Suspense for `useSearchParams`, imports `BusinessRulesContent` from business-rules page. Single content area with `maxWidth` by tab.
- **Business rules** – `BusinessRulesContent` exported for use in Settings; default export `BusinessRulesRedirectPage` redirects `/business-rules` → `/settings?tab=rules`.
- **Account page** – Present at `/account` with profile (display name, avatar) and change-password for email users.
- **Login/Signup** – Google OAuth buttons added.
- **next.config.ts** – `images.remotePatterns` includes `lh3.googleusercontent.com` for avatar images.
- **Lint** – No linter errors on the reviewed files.

---

## Issues and recommendations

### 1. Settings visible to everyone (design change)

- **Current:** `visibleNav` in Sidebar is `useMemo(() => navigation, [])`, so **Settings** is shown to all users.
- **Previous design:** Settings (and Business rules) were admin-only: `visibleNav` filtered to show Settings only when `isAdmin`.
- **Recommendation:** If Settings should remain admin-only, restore the filter in `components/Sidebar.tsx`:

```ts
const visibleNav = useMemo(
  () => navigation.filter((item) => item.name !== 'Settings' || isAdmin),
  [isAdmin]
);
```

### 2. Settings page: admin check removed

- **Current:** Settings page uses `isAdmin` from `useAuth()` but does **not** redirect or block non-admins. Any logged-in user can open `/settings` and `/settings?tab=rules`.
- **Previous design:** Non-admins were redirected to `/` or shown “You don’t have access to settings.”
- **Recommendation:** If Settings is meant to be admin-only, restore the guard in `app/settings/page.tsx` (e.g. after loading checks):

```ts
if (user && !isAdmin) {
  router.replace('/');
  return null;
}
// or show an “Access denied” message and link back to dashboard
```

### 3. Unused import (fixed)

- **Sidebar** imported `UserCircleIcon` but did not use it. Removed in this review.

### 4. Sidebar: collapse all sections on every pathname change

- **Current:** In `Sidebar.tsx`, a `useEffect` depends on `[pathname, directLinkHrefs, accordionNames]` and does `setExpandedSections(Object.fromEntries(accordionNames.map((name) => [name, false])))`, so **every navigation** closes all accordions (Staff, Reports).
- **Effect:** Expanding “Reports” then opening “Event Summary” will collapse Reports again when the route changes.
- **Recommendation:** If the goal is only to close the **flyout** when navigating (e.g. so the flyout doesn’t stay open on a new page), consider clearing only the flyout state or the expanded state for the **collapsed** sidebar, instead of closing every section on every pathname change. Otherwise the current behavior is acceptable if “navigate → close all” is desired.

### 5. Business rules default export

- **Current:** `app/business-rules/page.tsx` exports `BusinessRulesRedirectPage` as default and uses `useEffect` + `router.replace('/settings?tab=rules')`. Correct and works for client-side redirect.
- No change needed.

---

## Summary table

| Area              | Status        | Note                                                                 |
|-------------------|---------------|----------------------------------------------------------------------|
| AuthProvider      | OK            | `isAdmin` exposed.                                                   |
| Sidebar           | OK + 1 fix    | Account block, collapse, flyout; removed unused `UserCircleIcon`.   |
| Settings visibility| Design choice | Settings shown to all; restore filter in Sidebar if admin-only.     |
| Settings page     | Design choice | No admin guard; add redirect/block if admin-only.                   |
| Settings tabs     | OK            | Template + Business rules, Suspense.                                 |
| Business rules    | OK            | Redirect and shared content.                                         |
| Account page      | OK            | Profile + change password.                                           |
| Login/Signup      | OK            | Google OAuth.                                                        |
| LayoutSwitcher    | OK            | `print:hidden` on sidebar.                                           |

---

## Optional: restore admin-only Settings

If you want Settings (and Business rules) to be admin-only again:

1. In **`components/Sidebar.tsx`**, set  
   `visibleNav = useMemo(() => navigation.filter((item) => item.name !== 'Settings' || isAdmin), [isAdmin])`.
2. In **`app/settings/page.tsx`**, after the loading check, add: if `user && !isAdmin` then `router.replace('/')` (and return) or show an “Access denied” message.

No other functional or type errors were found in the reviewed auth/sidebar/settings/account flow.
