'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type RoleOption = '' | 'chef' | 'manager' | 'admin';

type UserRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string | null;
  lastSignInAt: string | null;
};

const ROLE_OPTIONS: { value: RoleOption; label: string }[] = [
  { value: '', label: 'No role' },
  { value: 'chef', label: 'Chef' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminPermissionsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/permissions', { cache: 'no-store' });
        const body = (await readApiJson(res)) as { users?: UserRow[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Failed to load users');
        if (!active) return;
        const users = (body.users ?? []).sort((a, b) => a.email.localeCompare(b.email));
        setRows(users);
        setDraft(
          Object.fromEntries(
            users.map((u) => [u.id, u.role])
          )
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [authLoading, isAdmin]);

  const changedCount = useMemo(
    () => rows.filter((r) => (draft[r.id] ?? '') !== (r.role ?? '')).length,
    [rows, draft]
  );

  async function saveRole(userId: string) {
    const role = (draft[userId] ?? '') as RoleOption;
    setSavingId(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const body = (await readApiJson(res)) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to save role');
      setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSavingId(null);
    }
  }

  if (authLoading) {
    return <div className="p-6 text-sm text-text-secondary">Loading...</div>;
  }
  if (!isAdmin) {
    return <div className="p-6 text-sm text-danger">Forbidden</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Admin Permissions</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Assign app roles for users. Admin includes full access and can manage roles.
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Default admin allowlist includes djet.soriano@gmail.com.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-text-secondary">
          Loading users...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-card-elevated text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Last sign in</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isDirty = (draft[row.id] ?? '') !== (row.role ?? '');
                return (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-4 py-3 text-text-primary">{row.email || row.id}</td>
                    <td className="px-4 py-3">
                      <select
                        value={draft[row.id] ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        className="rounded-md border border-border bg-card-elevated px-2 py-1.5 text-text-primary"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value || 'none'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => saveRole(row.id)}
                        disabled={!isDirty || savingId === row.id}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
                          !isDirty || savingId === row.id
                            ? 'cursor-not-allowed bg-border'
                            : 'bg-accent hover:bg-accent-hover'
                        }`}
                      >
                        {savingId === row.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <p className="text-xs text-text-muted">
          Pending changes: {changedCount}
        </p>
      )}
    </div>
  );
}

async function readApiJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const excerpt = text.slice(0, 160).trim();
    throw new Error(
      excerpt
        ? `Unexpected server response: ${excerpt}`
        : 'Unexpected empty server response'
    );
  }
}
