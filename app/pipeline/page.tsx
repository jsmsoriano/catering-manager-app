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

const PIPELINE_COLUMNS: { id: PipelineStatus; label: string }[] = [
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'quote_sent', label: 'Quote Sent' },
  { id: 'deposit_pending', label: 'Deposit Pending' },
  { id: 'booked', label: 'Booked' },
  { id: 'completed', label: 'Completed' },
];

/** Color coding per pipeline status: left border + soft background */
const PIPELINE_CARD_STYLES: Record<PipelineStatus, string> = {
  inquiry: 'border-l-4 border-l-info bg-info/10',
  quote_sent: 'border-l-4 border-l-info bg-info/5',
  deposit_pending: 'border-l-4 border-l-warning bg-warning/10',
  booked: 'border-l-4 border-l-success bg-success/10',
  completed: 'border-l-4 border-l-success bg-success/5',
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

// ─── Persist and notify (same pattern as bookings page) ─────────────────────

function persistBookings(bookings: Booking[]) {
  const normalized = bookings.map((b) => normalizeBookingWorkflowFields(b));
  localStorage.setItem('bookings', JSON.stringify(normalized));
  window.dispatchEvent(new Event('bookingsUpdated'));
  return normalized;
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

  const { totalInquiriesThisMonth, conversionRate, revenueBooked } = useMemo(() => {
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
    const totalInMonth = pipelineInMonth.length;
    const bookedOrCompleted = pipelineInMonth.filter(
      (b) => {
        const ps = b.pipeline_status ?? 'inquiry';
        return ps === 'booked' || ps === 'completed';
      }
    ).length;
    const conversion = totalInMonth > 0 ? (bookedOrCompleted / totalInMonth) * 100 : 0;
    const revenue = bookings
      .filter((b) => {
        const ps = b.pipeline_status ?? 'inquiry';
        return (ps === 'booked' || ps === 'completed') && b.status !== 'cancelled';
      })
      .reduce((sum, b) => sum + b.total, 0);

    return {
      totalInquiriesThisMonth: inquiriesThisMonth,
      conversionRate: conversion,
      revenueBooked: revenue,
    };
  }, [bookings, monthStart, monthEnd]);

  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <div className="rounded-lg border border-border bg-card-elevated px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Inquiries this month
        </p>
        <p className="text-2xl font-bold text-text-primary">{totalInquiriesThisMonth}</p>
      </div>
      <div className="rounded-lg border border-border bg-card-elevated px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Conversion rate
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
  );
}

// ─── Kanban column (droppable) ─────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  cards,
  onCardClick,
  darkHeader,
}: {
  status: PipelineStatus;
  label: string;
  cards: Booking[];
  onCardClick: (b: Booking) => void;
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
          <PipelineCard key={booking.id} booking={booking} onClick={() => onCardClick(booking)} />
        ))}
      </div>
    </div>
  );
}

function useDroppableColumn(id: PipelineStatus) {
  return useDroppable({ id });
}

// ─── Draggable card ────────────────────────────────────────────────────────

function PipelineCard({ booking, onClick }: { booking: Booking; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggableCard(booking.id);
  const status = booking.pipeline_status ?? 'inquiry';
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const justDraggedRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!flags.pipeline) router.replace('/bookings');
  }, [flags.pipeline, router]);

  const darkHeader = mounted && resolvedTheme === 'light';

  const loadBookings = useMemo(() => {
    return () => {
      const raw = localStorage.getItem('bookings');
      if (!raw) {
        setBookings([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as Booking[];
        const withBackfill = parsed.map(ensurePipelineStatus);
        const changed = withBackfill.some(
          (b, i) => b.pipeline_status !== (parsed[i] as Booking)?.pipeline_status
        );
        if (changed) {
          localStorage.setItem('bookings', JSON.stringify(withBackfill));
          window.dispatchEvent(new Event('bookingsUpdated'));
        }
        setBookings(withBackfill.map((b) => normalizeBookingWorkflowFields(b)));
      } catch {
        setBookings([]);
      }
    };
  }, []);

  useEffect(() => {
    loadBookings();
    const onUpdate = () => loadBookings();
    const onStorage = (e: StorageEvent) => e.key === 'bookings' && loadBookings();
    window.addEventListener('bookingsUpdated', onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('bookingsUpdated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadBookings]);

  const cardsByStatus = useMemo(() => {
    const filtered = bookings.filter((b) => b.status !== 'cancelled');
    const map: Record<PipelineStatus, Booking[]> = {
      inquiry: [],
      quote_sent: [],
      deposit_pending: [],
      booked: [],
      completed: [],
    };
    filtered.forEach((b) => {
      const ps = b.pipeline_status ?? 'inquiry';
      if (map[ps]) map[ps].push(b);
      else map.inquiry.push(b);
    });
    return map;
  }, [bookings]);

  const activeBooking = activeId ? bookings.find((b) => b.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
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
      if (overBooking) newStatus = overBooking.pipeline_status ?? 'inquiry';
    }
    if (!newStatus) return;
    const now = new Date().toISOString();
    const updated = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      let nextStatus = b.status;
      if (newStatus === 'booked') nextStatus = 'confirmed';
      if (newStatus === 'completed') nextStatus = 'completed';
      return {
        ...b,
        pipeline_status: newStatus,
        pipeline_status_updated_at: now,
        updatedAt: now,
        status: nextStatus,
      };
    });
    setBookings(updated);
    persistBookings(updated);
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

        <MetricsBar bookings={bookings} now={now} />

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
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeBooking ? (
              <div
                className={`min-w-[260px] max-w-[260px] cursor-grabbing rounded-lg border-2 border-accent p-3 shadow-lg ${PIPELINE_CARD_STYLES[activeBooking.pipeline_status ?? 'inquiry']}`}
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
