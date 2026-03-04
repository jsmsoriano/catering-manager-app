import { hasRole, isAdminEmail, isAdminUser, isManagerOrAdminUser } from '@/lib/auth/admin';

describe('admin auth helpers', () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail;
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it('accepts admin email from ADMIN_EMAILS allowlist', () => {
    process.env.ADMIN_EMAILS = 'owner@example.com,ops@example.com';
    expect(isAdminEmail('owner@example.com')).toBe(true);
    expect(isAdminEmail('not-listed@example.com')).toBe(false);
  });

  it('accepts fallback ADMIN_EMAIL', () => {
    process.env.ADMIN_EMAILS = '';
    process.env.ADMIN_EMAIL = 'single-admin@example.com';
    expect(isAdminEmail('single-admin@example.com')).toBe(true);
  });

  it('recognizes role-based admin and manager users', () => {
    expect(hasRole({ app_metadata: { role: 'admin' } }, 'admin')).toBe(true);
    expect(isAdminUser({ app_metadata: { role: 'admin' } })).toBe(true);
    expect(isManagerOrAdminUser({ app_metadata: { role: 'manager' } })).toBe(true);
  });

  it('recognizes admin by allowlisted email even without role metadata', () => {
    process.env.ADMIN_EMAILS = 'owner@example.com';
    const user = { email: 'owner@example.com', app_metadata: {} };

    expect(isAdminUser(user)).toBe(true);
    expect(isManagerOrAdminUser(user)).toBe(true);
  });
});
