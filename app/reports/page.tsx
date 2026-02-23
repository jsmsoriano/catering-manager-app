'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  BanknotesIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportDef {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: React.ElementType;
  iconClass: string;
}

// ─── Report definitions ───────────────────────────────────────────────────────

const REPORTS: ReportDef[] = [
  {
    id: 'event-summary',
    name: 'Event Summary',
    description:
      'Per-event breakdown of revenue, food cost, staff pay, and profit for any period.',
    href: '/reports/event-summary',
    icon: CalendarDaysIcon,
    iconClass: 'bg-blue-500/10 text-blue-500',
  },
  {
    id: 'business-summary',
    name: 'Business Summary',
    description:
      'Overall revenue, expenses, and profit with date-range filtering and trend charts.',
    href: '/reports/business-summary',
    icon: ChartBarIcon,
    iconClass: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    id: 'owner-monthly',
    name: 'Owner Profit Distribution',
    description:
      'Monthly payout summary, retained earnings, and owner profit share breakdown.',
    href: '/reports/owner-monthly',
    icon: BanknotesIcon,
    iconClass: 'bg-amber-500/10 text-amber-500',
  },
  {
    id: 'comparative',
    name: 'Staff Payouts',
    description:
      'Staff compensation report — per-event and period totals by staff member.',
    href: '/reports/comparative',
    icon: UsersIcon,
    iconClass: 'bg-purple-500/10 text-purple-500',
  },
  {
    id: 'menus-and-shopping',
    name: 'Menus & Shopping',
    description:
      'Event menus and shopping lists linked to events. Most ordered items, metrics, tracking, and forecasting.',
    href: '/reports/menus-and-shopping',
    icon: ClipboardDocumentListIcon,
    iconClass: 'bg-teal-500/10 text-teal-500',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildHref(base: string, period: string): string {
  if (period === 'all' || period === 'custom') return base;
  return `${base}?period=${period}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [periods, setPeriods] = useState<Record<string, string>>({});

  const getPeriod = (id: string) => periods[id] ?? 'all';
  const setPeriod = (id: string, val: string) =>
    setPeriods((prev) => ({ ...prev, [id]: val }));

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <p className="mt-1 text-sm text-text-muted">
          Select a report to view detailed analytics.
        </p>
      </div>

      {/* Report list */}
      <div className="space-y-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
            >
              {/* Icon */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${report.iconClass}`}
              >
                <Icon className="h-5 w-5" />
              </div>

              {/* Name + description */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary">{report.name}</p>
                <p className="mt-0.5 text-sm text-text-muted">
                  {report.description}
                </p>
              </div>

              {/* Controls */}
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={getPeriod(report.id)}
                  onChange={(e) => setPeriod(report.id, e.target.value)}
                  className="rounded-md border border-border bg-card-elevated px-2 py-1.5 text-sm text-text-secondary focus:border-accent focus:outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="ytd">Year to Date</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>

                <Link
                  href={buildHref(report.href, getPeriod(report.id))}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
                >
                  View
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
