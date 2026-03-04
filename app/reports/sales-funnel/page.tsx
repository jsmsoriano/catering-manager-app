'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { endOfMonth, isWithinInterval, startOfMonth, startOfYear } from 'date-fns';
import { ensurePipelineStatus } from '@/lib/bookingWorkflow';
import type { Booking, PipelineStatus } from '@/lib/bookingTypes';
import { getLeadSourceLabel } from '@/lib/leadSources';

const STAGE_ORDER: PipelineStatus[] = [
  'inquiry',
  'qualified',
  'quote_sent',
  'follow_up',
  'deposit_pending',
  'booked',
  'completed',
];

const STAGE_LABELS: Record<PipelineStatus, string> = {
  inquiry: 'Inquiry',
  qualified: 'Qualified',
  quote_sent: 'Quote Submitted',
  follow_up: 'Follow-up',
  deposit_pending: 'Quote Accepted',
  booked: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
};

interface StageRow {
  stage: PipelineStatus;
  count: number;
  shareOfLeads: number;
  conversionFromPrev: number;
}

interface SourceRow {
  source: string;
  leads: number;
  confirmed: number;
  completed: number;
  declined: number;
  leadToConfirmedRate: number;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getPeriodRange(period: string): { start: Date; end: Date } | null {
  const now = new Date();
  if (period === 'month') {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }
  if (period === 'ytd') {
    return { start: startOfYear(now), end: now };
  }
  return null;
}

function dateInRange(booking: Booking, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true;
  const leadDate = booking.createdAt ? new Date(booking.createdAt) : parseLocalDate(booking.eventDate);
  return isWithinInterval(leadDate, range);
}

export default function SalesFunnelReportPage() {
  const params = useSearchParams();
  const period = params.get('period') ?? 'all';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (!saved) {
        setBookings([]);
        return;
      }
      try {
        const parsed = JSON.parse(saved) as Booking[];
        setBookings(parsed.map((b) => ensurePipelineStatus(b)));
      } catch {
        setBookings([]);
      }
    };

    loadBookings();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bookings') loadBookings();
    };
    const onCustom = () => loadBookings();
    window.addEventListener('storage', onStorage);
    window.addEventListener('bookingsUpdated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bookingsUpdated', onCustom);
    };
  }, []);

  const periodFilteredBookings = useMemo(() => {
    const range = getPeriodRange(period);
    return bookings.filter((b) => dateInRange(b, range));
  }, [bookings, period]);

  const sourceOptions = useMemo(() => {
    const keys = new Set<string>();
    periodFilteredBookings.forEach((b) => keys.add(b.sourceChannel || 'unknown'));
    return ['all', ...Array.from(keys).sort((a, b) => getLeadSourceLabel(a).localeCompare(getLeadSourceLabel(b)))];
  }, [periodFilteredBookings]);

  const filteredBookings = useMemo(() => {
    if (sourceFilter === 'all') return periodFilteredBookings;
    return periodFilteredBookings.filter((b) => (b.sourceChannel || 'unknown') === sourceFilter);
  }, [periodFilteredBookings, sourceFilter]);

  const stageRows = useMemo<StageRow[]>(() => {
    const leadCount = filteredBookings.length;
    const countByStage = new Map<PipelineStatus, number>();
    STAGE_ORDER.forEach((stage) => countByStage.set(stage, 0));

    filteredBookings.forEach((booking) => {
      const stage = booking.pipeline_status ?? 'inquiry';
      if (!countByStage.has(stage)) return;
      countByStage.set(stage, (countByStage.get(stage) ?? 0) + 1);
    });

    return STAGE_ORDER.map((stage, index) => {
      const count = countByStage.get(stage) ?? 0;
      const prevStageCount = index === 0 ? leadCount : countByStage.get(STAGE_ORDER[index - 1]) ?? 0;
      return {
        stage,
        count,
        shareOfLeads: leadCount > 0 ? (count / leadCount) * 100 : 0,
        conversionFromPrev: prevStageCount > 0 ? (count / prevStageCount) * 100 : 0,
      };
    });
  }, [filteredBookings]);

  const summary = useMemo(() => {
    const leadCount = filteredBookings.length;
    const confirmedCount = stageRows.find((s) => s.stage === 'booked')?.count ?? 0;
    const completedCount = stageRows.find((s) => s.stage === 'completed')?.count ?? 0;
    const declinedCount = filteredBookings.filter((b) => b.pipeline_status === 'declined').length;
    return {
      leadCount,
      confirmedCount,
      completedCount,
      declinedCount,
      leadToConfirmedRate: leadCount > 0 ? (confirmedCount / leadCount) * 100 : 0,
      leadToCompletedRate: leadCount > 0 ? (completedCount / leadCount) * 100 : 0,
    };
  }, [filteredBookings, stageRows]);

  const sourceRows = useMemo<SourceRow[]>(() => {
    const grouped = new Map<string, Booking[]>();
    periodFilteredBookings.forEach((booking) => {
      const key = booking.sourceChannel || 'unknown';
      const arr = grouped.get(key) ?? [];
      arr.push(booking);
      grouped.set(key, arr);
    });

    return Array.from(grouped.entries())
      .map(([source, rows]) => {
        const leads = rows.length;
        const confirmed = rows.filter((b) => (b.pipeline_status ?? 'inquiry') === 'booked').length;
        const completed = rows.filter((b) => (b.pipeline_status ?? 'inquiry') === 'completed').length;
        const declined = rows.filter((b) => (b.pipeline_status ?? 'inquiry') === 'declined').length;
        return {
          source,
          leads,
          confirmed,
          completed,
          declined,
          leadToConfirmedRate: leads > 0 ? (confirmed / leads) * 100 : 0,
        };
      })
      .sort((a, b) => b.leads - a.leads);
  }, [periodFilteredBookings]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Sales Funnel</h1>
          <p className="mt-1 text-sm text-text-muted">
            Lead progression from inquiry to confirmed events.
          </p>
        </div>
        <Link
          href="/reports"
          className="rounded-lg border border-border bg-card-elevated px-3 py-2 text-sm text-text-secondary hover:bg-card"
        >
          Back to Reports
        </Link>
      </div>

      <div className="mb-6 flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
            Lead Source Filter
          </label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source === 'all' ? 'All Sources' : getLeadSourceLabel(source)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Leads</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{summary.leadCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Confirmed</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{summary.confirmedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Lead to Confirmed</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{summary.leadToConfirmedRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Declined</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{summary.declinedCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-card-elevated">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                Stage
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                Count
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                Share of Leads
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                Conversion from Previous
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stageRows.map((row) => (
              <tr key={row.stage} className="hover:bg-card-elevated/70">
                <td className="px-4 py-3 text-sm font-medium text-text-primary">{STAGE_LABELS[row.stage]}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{row.count}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{row.shareOfLeads.toFixed(1)}%</td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {row.stage === 'inquiry' ? '—' : `${row.conversionFromPrev.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-card-elevated px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Conversion by Lead Source</h2>
        </div>
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-card-elevated/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Source</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Leads</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Confirmed</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Completed</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Declined</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Lead to Confirmed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sourceRows.map((row) => (
              <tr key={row.source} className="hover:bg-card-elevated/70">
                <td className="px-4 py-3 text-sm font-medium text-text-primary">{getLeadSourceLabel(row.source)}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{row.leads}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{row.confirmed}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{row.completed}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{row.declined}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{row.leadToConfirmedRate.toFixed(1)}%</td>
              </tr>
            ))}
            {sourceRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">
                  No lead source data for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-text-muted">
        Period filter comes from the Reports page dropdown ({period === 'all' ? 'All Time' : period === 'ytd' ? 'Year to Date' : period === 'month' ? 'This Month' : 'Custom'}).
      </p>
    </div>
  );
}
