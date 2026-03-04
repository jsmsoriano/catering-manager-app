'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useFeatureFlags } from '@/lib/useFeatureFlags';
import { useTheme } from 'next-themes';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { formatCurrency } from '@/lib/moneyRules';
import { ensurePipelineStatus, normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import type { Booking, PipelineStatus } from '@/lib/bookingTypes';
import { loadCrmTasks } from '@/lib/crmStorage';
import { useBookingsQuery } from '@/lib/hooks/useBookingsQuery';
import { runPipelineStageAutomation } from '@/lib/crmAutomation';
import { LEAD_SOURCE_OPTIONS, getLeadSourceLabel } from '@/lib/leadSources';

const PIPELINE_COLUMNS: { id: PipelineStatus; label: string }[] = [
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'quote_sent', label: 'Quote Sent' },
  { id: 'booked', label: 'Booked' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
];

const FLOW_STAGES: { id: PipelineStatus; label: string }[] = [
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'quote_sent', label: 'Quote Sent' },
  { id: 'booked', label: 'Booked' },
  { id: 'completed', label: 'Completed' },
];

function normalizeStageForFlow(status: PipelineStatus | undefined): PipelineStatus {
  if (status === 'follow_up' || status === 'deposit_pending') return 'quote_sent';
  return status ?? 'inquiry';
}

/** Color coding per pipeline status: left border + soft background */
const PIPELINE_CARD_STYLES: Record<PipelineStatus, string> = {
  inquiry: 'border-l-4 border-l-info bg-info/10',
  qualified: 'border-l-4 border-l-indigo-500 bg-indigo-500/10',
  quote_sent: 'border-l-4 border-l-info bg-info/5',
  follow_up: 'border-l-4 border-l-violet-500 bg-violet-500/10',
  deposit_pending: 'border-l-4 border-l-warning bg-warning/10',
  booked: 'border-l-4 border-l-success bg-success/10',
  completed: 'border-l-4 border-l-success bg-success/5',
  declined: 'border-l-4 border-l-slate-400 bg-slate-500/10',
};

function parseLocalDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso: string) {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Metrics bar ────────────────────────────────────────────────────────────

function MetricsBar({
  bookings,
  now,
}: {
  bookings: Booking[];
  now: Date;
}) {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const {
    totalInquiriesThisMonth,
    qualifiedThisMonth,
    conversionRate,
    revenueBooked,
    inquiryToQualifiedRate,
    qualifiedToQuoteRate,
    quoteToAcceptedRate,
    acceptedToConfirmedRate,
    medianStageAgeDays,
    overdueFollowUpRate,
  } = useMemo(() => {
    const inMonth = (b: Booking) => {
      const d = new Date(b.createdAt);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    };
    const pipelineInMonth = bookings.filter(
      (b) => b.status !== 'cancelled' && inMonth(b)
    );
    const inquiriesThisMonth = pipelineInMonth.filter(
      (b) => (b.pipeline_status ?? 'inquiry') === 'inquiry'
    ).length;
    const qualifiedThisMonth = pipelineInMonth.filter((b) => {
      const ps = b.pipeline_status ?? 'inquiry';
      return ps !== 'inquiry';
    }).length;
    const totalInMonth = pipelineInMonth.length;
    const bookedOrCompleted = pipelineInMonth.filter(
      (b) => {
        const ps = b.pipeline_status ?? 'inquiry';
        return ps === 'booked' || ps === 'completed';
      }
    ).length;
    const conversion = qualifiedThisMonth > 0 ? (bookedOrCompleted / qualifiedThisMonth) * 100 : 0;
    const stageCount = (status: PipelineStatus) =>
      bookings.filter((b) => (b.pipeline_status ?? 'inquiry') === status && b.status !== 'cancelled').length;
    const inquiryCount = stageCount('inquiry');
    const qualifiedCount = stageCount('qualified');
    const quoteCount = stageCount('quote_sent');
    const acceptedCount = stageCount('deposit_pending');
    const confirmedCount = stageCount('booked');

    const inquiryToQualifiedRate = inquiryCount > 0 ? (qualifiedCount / inquiryCount) * 100 : 0;
    const qualifiedToQuoteRate = qualifiedCount > 0 ? (quoteCount / qualifiedCount) * 100 : 0;
    const quoteToAcceptedRate = quoteCount > 0 ? (acceptedCount / quoteCount) * 100 : 0;
    const acceptedToConfirmedRate = acceptedCount > 0 ? (confirmedCount / acceptedCount) * 100 : 0;

    const activeForAge = bookings.filter(
      (b) =>
        b.status !== 'cancelled' &&
        (b.pipeline_status ?? 'inquiry') !== 'declined' &&
        (b.pipeline_status ?? 'inquiry') !== 'completed'
    );
    const stageAges = activeForAge
      .map((b) => {
        const updatedAt = b.pipeline_status_updated_at ?? b.updatedAt ?? b.createdAt;
        const ms = now.getTime() - new Date(updatedAt).getTime();
        return Math.max(0, Math.round(ms / 86400000));
      })
      .sort((a, b) => a - b);
    const medianStageAgeDays =
      stageAges.length === 0
        ? 0
        : stageAges.length % 2 === 1
        ? stageAges[(stageAges.length - 1) / 2]
        : Math.round((stageAges[stageAges.length / 2 - 1] + stageAges[stageAges.length / 2]) / 2);

    const crmTasks = loadCrmTasks();
    const openTasks = crmTasks.filter((t) => t.status === 'open');
    const today = now.toISOString().slice(0, 10);
    const overdueOpen = openTasks.filter((t) => !!t.dueDate && t.dueDate < today);
    const overdueFollowUpRate = openTasks.length > 0 ? (overdueOpen.length / openTasks.length) * 100 : 0;

    const revenue = bookings
      .filter((b) => {
        const ps = b.pipeline_status ?? 'inquiry';
        return (ps === 'booked' || ps === 'completed') && b.status !== 'cancelled';
      })
      .reduce((sum, b) => sum + b.total, 0);

    return {
      totalInquiriesThisMonth: inquiriesThisMonth,
      qualifiedThisMonth,
      conversionRate: conversion,
      revenueBooked: revenue,
      inquiryToQualifiedRate,
      qualifiedToQuoteRate,
      quoteToAcceptedRate,
      acceptedToConfirmedRate,
      medianStageAgeDays,
      overdueFollowUpRate,
    };
  }, [bookings, monthStart, monthEnd, now]);

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="rounded-lg border border-border bg-card-elevated px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Inquiries this month
          </p>
          <p className="text-2xl font-bold text-text-primary">{totalInquiriesThisMonth}</p>
        </div>
        <div className="rounded-lg border border-border bg-card-elevated px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Qualified this month
          </p>
          <p className="text-2xl font-bold text-text-primary">{qualifiedThisMonth}</p>
        </div>
        <div className="rounded-lg border border-border bg-card-elevated px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Conversion rate (qualified → booked)
          </p>
          <p className="text-2xl font-bold text-text-primary">{conversionRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border bg-card-elevated px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Revenue booked
          </p>
          <p className="text-2xl font-bold text-text-primary">{formatCurrency(revenueBooked)}</p>
        </div>
      </div>
      <div className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-card-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">Inquiry → Qualified</p>
          <p className="mt-1 font-semibold text-text-primary">{inquiryToQualifiedRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-md border border-border bg-card-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">Qualified → Quote Submitted</p>
          <p className="mt-1 font-semibold text-text-primary">{qualifiedToQuoteRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-md border border-border bg-card-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">Quote Submitted → Quote Accepted</p>
          <p className="mt-1 font-semibold text-text-primary">{quoteToAcceptedRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-md border border-border bg-card-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">Quote Accepted → Confirmed</p>
          <p className="mt-1 font-semibold text-text-primary">{acceptedToConfirmedRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-md border border-border bg-card-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">Median days in stage</p>
          <p className="mt-1 font-semibold text-text-primary">{medianStageAgeDays} days</p>
        </div>
        <div className="rounded-md border border-border bg-card-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">Overdue follow-up rate</p>
          <p className="mt-1 font-semibold text-text-primary">{overdueFollowUpRate.toFixed(1)}%</p>
        </div>
      </div>
    </>
  );
}

// ─── Kanban column (droppable) ─────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  cards,
  onCardClick,
  onUpdateSource,
  darkHeader,
}: {
  status: PipelineStatus;
  label: string;
  cards: Booking[];
  onCardClick: (b: Booking) => void;
  onUpdateSource: (bookingId: string, sourceChannel: string) => void;
  darkHeader: boolean;
}) {
  const { setNodeRef, isOver } = useDroppableColumn(status);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[280px] max-w-[280px] flex-col rounded-lg border-2 border-dashed p-3 transition-colors ${
        isOver ? 'border-accent bg-accent/5' : 'border-border bg-card'
      }`}
    >
      <div
        className={`mb-3 flex items-center justify-between rounded-md px-2 py-1.5 ${
          darkHeader ? 'bg-slate-700' : ''
        }`}
      >
        <h3 className={`font-semibold ${darkHeader ? 'text-slate-100' : 'text-text-primary'}`}>{label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-sm ${darkHeader ? 'bg-slate-600 text-slate-200' : 'bg-card-elevated text-text-muted'}`}>
          {cards.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {cards.map((booking) => (
          <PipelineCard
            key={booking.id}
            booking={booking}
            onClick={() => onCardClick(booking)}
            onUpdateSource={onUpdateSource}
          />
        ))}
      </div>
    </div>
  );
}

function useDroppableColumn(id: PipelineStatus) {
  return useDroppable({ id });
}

function StatusFlowBar({ bookings }: { bookings: Booking[] }) {
  const counts = useMemo(() => {
    const map: Record<PipelineStatus, number> = {
      inquiry: 0,
      qualified: 0,
      quote_sent: 0,
      follow_up: 0,
      deposit_pending: 0,
      booked: 0,
      completed: 0,
      declined: 0,
    };
    bookings.forEach((b) => {
      const normalized = normalizeStageForFlow(b.pipeline_status ?? 'inquiry');
      map[normalized] = (map[normalized] ?? 0) + 1;
    });
    return map;
  }, [bookings]);

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Lead Flow Status
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {FLOW_STAGES.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card-elevated px-3 py-1.5">
              <span className="text-xs font-medium text-text-secondary">{stage.label}</span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                {counts[stage.id] ?? 0}
              </span>
            </div>
            {idx < FLOW_STAGES.length - 1 && (
              <span className="text-text-muted">→</span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Leads in Follow-up and Quote Accepted are grouped under Quote Sent for a simpler flow.
      </p>
    </div>
  );
}

// ─── Draggable card ────────────────────────────────────────────────────────

function PipelineCard({
  booking,
  onClick,
  onUpdateSource,
}: {
  booking: Booking;
  onClick: () => void;
  onUpdateSource: (bookingId: string, sourceChannel: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggableCard(booking.id);
  const status = normalizeStageForFlow(booking.pipeline_status ?? 'inquiry');
  const statusStyles = PIPELINE_CARD_STYLES[status];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return;
        onClick();
      }}
      className={`cursor-grab rounded-lg border border-border p-3 shadow-sm transition-shadow active:cursor-grabbing hover:shadow-md ${statusStyles} ${
        isDragging ? 'opacity-0' : ''
      }`}
    >
      <p className="font-medium text-text-primary">{booking.customerName}</p>
      <p className="mt-0.5 text-xs text-text-muted">{formatDate(booking.eventDate)}</p>
      <p className="mt-1 text-xs text-text-secondary">
        {booking.adults + booking.children} guests · {formatCurrency(booking.total)}
      </p>
      <div
        className="mt-2 rounded-md border border-border/70 bg-card/70 p-2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Lead Source
        </p>
        <select
          value={booking.sourceChannel ?? ''}
          onChange={(e) => onUpdateSource(booking.id, e.target.value)}
          className="w-full rounded border border-border bg-card-elevated px-2 py-1 text-[11px] text-text-primary focus:border-accent focus:outline-none"
          title="Update lead source"
        >
          <option value="">Not provided</option>
          {LEAD_SOURCE_OPTIONS.filter((option) => option.value).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {(booking.pipeline_status_updated_at || booking.updatedAt) && (
        <p className="mt-1 text-[10px] text-text-muted">
          Updated {formatDateTime(booking.pipeline_status_updated_at ?? booking.updatedAt)}
        </p>
      )}
    </div>
  );
}

function useDraggableCard(id: string) {
  return useDraggable({ id });
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const router = useRouter();
  const { flags } = useFeatureFlags();
  const { bookings: rawBookings, saveBooking } = useBookingsQuery();
  const bookings = useMemo(() => rawBookings.map(ensurePipelineStatus).map((b) => normalizeBookingWorkflowFields(b)), [rawBookings]);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const justDraggedRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!flags.pipeline) router.replace('/bookings');
  }, [flags.pipeline, router]);

  const darkHeader = mounted && resolvedTheme === 'light';

  const sourceOptions = useMemo(() => {
    const keys = new Set<string>();
    bookings.forEach((b) => keys.add(b.sourceChannel || 'unknown'));
    return ['all', ...Array.from(keys).sort((a, b) => getLeadSourceLabel(a).localeCompare(getLeadSourceLabel(b)))];
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (sourceFilter === 'all') return bookings;
    return bookings.filter((b) => (b.sourceChannel || 'unknown') === sourceFilter);
  }, [bookings, sourceFilter]);

  const cardsByStatus = useMemo(() => {
    const map: Record<PipelineStatus, Booking[]> = {
      inquiry: [],
      qualified: [],
      quote_sent: [],
      follow_up: [],
      deposit_pending: [],
      booked: [],
      completed: [],
      declined: [],
    };
    filteredBookings.forEach((b) => {
      const ps = normalizeStageForFlow(b.pipeline_status ?? 'inquiry');
      if (map[ps]) map[ps].push(b);
      else map.inquiry.push(b);
    });
    return map;
  }, [filteredBookings]);

  const activeBooking = activeId ? filteredBookings.find((b) => b.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const handleUpdateSource = (bookingId: string, sourceChannel: string) => {
    const now = new Date().toISOString();
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;
    const updated = {
      ...target,
      sourceChannel: sourceChannel || undefined,
      updatedAt: now,
    };
    saveBooking(updated);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    justDraggedRef.current = true;
    if (!over || active.id === over.id) return;
    const bookingId = active.id as string;
    const overId = String(over.id);
    // over.id can be a column (pipeline status) or another card (booking id) when dropping on a card
    let newStatus: PipelineStatus | null = PIPELINE_COLUMNS.some((c) => c.id === overId)
      ? (overId as PipelineStatus)
      : null;
    if (!newStatus) {
      const overBooking = bookings.find((b) => b.id === overId);
      if (overBooking) newStatus = normalizeStageForFlow(overBooking.pipeline_status ?? 'inquiry');
    }
    if (!newStatus) return;
    const now = new Date().toISOString();
    const updated = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      let nextStatus = b.status;
      if (newStatus === 'booked') nextStatus = 'confirmed';
      if (newStatus === 'completed') nextStatus = 'completed';
      if (newStatus === 'declined') nextStatus = 'cancelled';
      if (
        (newStatus === 'inquiry' ||
          newStatus === 'qualified' ||
          newStatus === 'quote_sent') &&
        b.status === 'cancelled'
      ) {
        nextStatus = 'pending';
      }
      return {
        ...b,
        pipeline_status: newStatus,
        pipeline_status_updated_at: now,
        updatedAt: now,
        status: nextStatus,
      };
    });
    const movedBookingBefore = bookings.find((b) => b.id === bookingId) ?? null;
    const movedBookingAfter = updated.find((b) => b.id === bookingId) ?? null;
    if (movedBookingBefore && movedBookingAfter) {
      runPipelineStageAutomation({
        booking: movedBookingAfter,
        prevStage: movedBookingBefore.pipeline_status ?? 'inquiry',
        nextStage: newStatus,
      });
      saveBooking(movedBookingAfter);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const now = new Date();

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Pipeline</h1>
          <Link
            href="/"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card hover:text-text-primary"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="mb-4 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Lead Source Filter
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All Sources' : getLeadSourceLabel(source)}
                </option>
              ))}
            </select>
          </div>
          <p className="pb-1 text-xs text-text-muted">
            Showing {filteredBookings.length} of {bookings.length} leads
          </p>
        </div>

        <StatusFlowBar bookings={filteredBookings} />
        <MetricsBar bookings={filteredBookings} now={now} />

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                status={col.id}
                label={col.label}
                cards={cardsByStatus[col.id]}
                darkHeader={darkHeader}
                onCardClick={(b) => {
                  if (justDraggedRef.current) {
                    justDraggedRef.current = false;
                    return;
                  }
                  window.location.assign(`/bookings?bookingId=${b.id}`);
                }}
                onUpdateSource={handleUpdateSource}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeBooking ? (
              <div
                className={`min-w-[260px] max-w-[260px] cursor-grabbing rounded-lg border-2 border-accent p-3 shadow-lg ${PIPELINE_CARD_STYLES[normalizeStageForFlow(activeBooking.pipeline_status ?? 'inquiry')]}`}
              >
                <p className="font-medium text-text-primary">{activeBooking.customerName}</p>
                <p className="mt-0.5 text-xs text-text-muted">{formatDate(activeBooking.eventDate)}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {activeBooking.adults + activeBooking.children} guests · {formatCurrency(activeBooking.total)}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
