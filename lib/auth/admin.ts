type RoleUser = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
} | null | undefined;

const DEFAULT_ADMIN_EMAILS = ['djet.soriano@gmail.com'];

function parseAdminEmails(): string[] {
  const combined = [...DEFAULT_ADMIN_EMAILS, process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
    .filter(Boolean)
    .join(',');
  return combined
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = parseAdminEmails();
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.toLowerCase());
}

export function hasRole(user: RoleUser, ...roles: string[]): boolean {
  if (!user) return false;
  const role = String(user.app_metadata?.['role'] ?? '').toLowerCase();
  return roles.some((r) => role === r.toLowerCase());
}

export function isAdminUser(user: RoleUser): boolean {
  return hasRole(user, 'admin') || isAdminEmail(user?.email);
}

export function isManagerOrAdminUser(user: RoleUser): boolean {
  return hasRole(user, 'admin', 'manager') || isAdminEmail(user?.email);
}
