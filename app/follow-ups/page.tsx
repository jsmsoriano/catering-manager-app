'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Booking } from '@/lib/bookingTypes';
import type { CrmTask } from '@/lib/crmTypes';
import { addCrmActivity, addCrmTask, CRM_UPDATED_EVENT, loadCrmTasks, setCrmTaskStatus } from '@/lib/crmStorage';
import { loadFromStorage } from '@/lib/storage';
import { normalizeCustomerId } from '@/lib/useCustomers';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

export default function FollowUpsPage() {
  const [tick, setTick] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(CRM_UPDATED_EVENT, refresh);
    window.addEventListener('bookingsUpdated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CRM_UPDATED_EVENT, refresh);
      window.removeEventListener('bookingsUpdated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const bookings = useMemo(() => loadFromStorage<Booking[]>('bookings', []), [tick]);
  const tasks = useMemo(() => loadCrmTasks(), [tick]);
  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const rows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const filtered = tasks.filter((t) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'completed') return t.status === 'completed';
      return t.status === 'open';
    });
    return filtered
      .map((task) => {
        const booking = task.bookingId ? bookingById.get(task.bookingId) : undefined;
        const isOverdue = task.status === 'open' && !!task.dueDate && task.dueDate < today;
        return { task, booking, isOverdue };
      })
      .sort((a, b) => {
        if (a.task.status !== b.task.status) return a.task.status === 'open' ? -1 : 1;
        return (a.task.dueDate ?? '9999-99-99').localeCompare(b.task.dueDate ?? '9999-99-99');
      });
  }, [tasks, bookingById, statusFilter]);

  const openCount = rows.filter((r) => r.task.status === 'open').length;
  const overdueCount = rows.filter((r) => r.isOverdue).length;

  const completeTask = (task: CrmTask) => {
    setCrmTaskStatus(task.id, 'completed');
    addCrmActivity({
      customerId: task.customerId,
      bookingId: task.bookingId,
      type: 'task_completed',
      text: `Task completed: ${task.title}`,
    });
    setTick((n) => n + 1);
  };

  const loadTestFollowUps = () => {
    setSeeding(true);
    const now = new Date();
    const datePlus = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const existingTasks = loadCrmTasks();
    const hasSeeded = existingTasks.some((t) => t.notes?.includes('[test-seed]'));
    if (hasSeeded) {
      setSeedMessage('Test follow-ups already loaded.');
      setTimeout(() => setSeedMessage(null), 2500);
      setSeeding(false);
      return;
    }

    const candidates = bookings
      .filter((b) => b.source !== 'menu-template')
      .slice(0, 4);

    if (candidates.length === 0) {
      const fallbackCustomerId = 'email:test-followup@example.com';
      const t1 = addCrmTask({
        customerId: fallbackCustomerId,
        title: '[Test] Call lead to confirm guest count',
        notes: '[test-seed]',
        dueDate: datePlus(0),
      });
      addCrmActivity({
        customerId: fallbackCustomerId,
        type: 'task_created',
        text: `Task created: ${t1.title}`,
      });
      const t2 = addCrmTask({
        customerId: fallbackCustomerId,
        title: '[Test] Send proposal reminder email',
        notes: '[test-seed]',
        dueDate: datePlus(1),
      });
      addCrmActivity({
        customerId: fallbackCustomerId,
        type: 'task_created',
        text: `Task created: ${t2.title}`,
      });
      setSeedMessage('Loaded 2 fallback test follow-ups.');
      setTimeout(() => setSeedMessage(null), 2500);
      setSeeding(false);
      setTick((n) => n + 1);
      return;
    }

    let created = 0;
    candidates.forEach((b, idx) => {
      const customerId = normalizeCustomerId(b.customerPhone ?? '', b.customerEmail ?? '');
      const dueOffset = idx - 1; // one overdue, one today, rest upcoming
      const task = addCrmTask({
        bookingId: b.id,
        customerId,
        title:
          idx % 2 === 0
            ? `[Test] Follow up on quote for ${b.customerName}`
            : `[Test] Confirm event details with ${b.customerName}`,
        notes: '[test-seed]',
        dueDate: datePlus(dueOffset),
      });
      addCrmActivity({
        bookingId: b.id,
        customerId,
        type: 'task_created',
        text: `Task created: ${task.title}`,
      });
      created += 1;
    });

    setSeedMessage(`Loaded ${created} test follow-ups.`);
    setTimeout(() => setSeedMessage(null), 2500);
    setSeeding(false);
    setTick((n) => n + 1);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Follow-ups</h1>
            <p className="mt-1 text-sm text-text-muted">
              Central queue for inquiry and customer CRM tasks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTestFollowUps}
              disabled={seeding}
              className="rounded-md border border-border bg-card-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card disabled:opacity-50"
            >
              {seeding ? 'Loading…' : 'Load Test Follow-ups'}
            </button>
            <span className="rounded-full bg-card-elevated px-2.5 py-1 text-xs font-medium text-text-primary">
              Open: {openCount}
            </span>
            <span className="rounded-full bg-danger px-2.5 py-1 text-xs font-medium text-white">
              Overdue: {overdueCount}
            </span>
          </div>
        </div>
        {seedMessage && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {seedMessage}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`rounded-md px-3 py-1.5 text-sm ${statusFilter === 'open' ? 'bg-accent text-white' : 'bg-card-elevated text-text-secondary'}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`rounded-md px-3 py-1.5 text-sm ${statusFilter === 'completed' ? 'bg-accent text-white' : 'bg-card-elevated text-text-secondary'}`}
          >
            Completed
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-md px-3 py-1.5 text-sm ${statusFilter === 'all' ? 'bg-accent text-white' : 'bg-card-elevated text-text-secondary'}`}
          >
            All
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Task</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Due</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                    No follow-up tasks found.
                  </td>
                </tr>
              ) : (
                rows.map(({ task, booking, isOverdue }) => (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className={`font-medium ${task.status === 'completed' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {task.title}
                      </p>
                      {task.notes && <p className="mt-0.5 text-xs text-text-muted">{task.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {task.dueDate ? (
                        <span className={isOverdue ? 'font-medium text-danger' : ''}>{formatDate(task.dueDate)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {booking?.customerName ?? task.customerId ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          task.status === 'completed'
                            ? 'bg-success/15 text-success'
                            : isOverdue
                            ? 'bg-danger/15 text-danger'
                            : 'bg-info/15 text-info'
                        }`}
                      >
                        {task.status === 'completed' ? 'Completed' : isOverdue ? 'Overdue' : 'Open'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {booking && (
                          <Link
                            href={`/bookings?bookingId=${booking.id}`}
                            className="rounded-md border border-border bg-card-elevated px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-card"
                          >
                            View Event
                          </Link>
                        )}
                        {task.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => completeTask(task)}
                            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
