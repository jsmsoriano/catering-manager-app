'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO, subMonths, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { loadShoppingLists } from '@/lib/shoppingStorage';
import type { ShoppingList } from '@/lib/shoppingTypes';
import type { Booking } from '@/lib/bookingTypes';
import type { EventMenu, CateringEventMenu } from '@/lib/menuTypes';
import { CATERING_EVENT_MENUS_KEY } from '@/lib/menuCategories';

// ─── Data loading ─────────────────────────────────────────────────────────────

function loadEventMenus(): EventMenu[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('eventMenus');
    return raw ? (JSON.parse(raw) as EventMenu[]) : [];
  } catch {
    return [];
  }
}

function loadCateringMenus(): CateringEventMenu[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
    return raw ? (JSON.parse(raw) as CateringEventMenu[]) : [];
  } catch {
    return [];
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedEvent {
  booking: Booking;
  eventMenu: EventMenu | null;
  cateringMenu: CateringEventMenu | null;
  shoppingList: ShoppingList | null;
  eventDate: string;
  customerName: string;
  guests: number;
  hasMenu: boolean;
  hasShoppingList: boolean;
}

type DateRange = 'all' | '30' | '90';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenusAndShoppingReportPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventMenus, setEventMenus] = useState<EventMenu[]>([]);
  const [cateringMenus, setCateringMenus] = useState<CateringEventMenu[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  useEffect(() => {
    const load = () => {
      try {
        setBookings(JSON.parse(localStorage.getItem('bookings') || '[]'));
      } catch {
        setBookings([]);
      }
    };
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'bookings') load(); };
    const onCustom = () => load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('bookingsUpdated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bookingsUpdated', onCustom);
    };
  }, []);

  useEffect(() => {
    setEventMenus(loadEventMenus());
    setCateringMenus(loadCateringMenus());
    setShoppingLists(loadShoppingLists());
    const onStorage = () => {
      setEventMenus(loadEventMenus());
      setCateringMenus(loadCateringMenus());
      setShoppingLists(loadShoppingLists());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('shoppingListsUpdated', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('shoppingListsUpdated', onStorage);
    };
  }, []);

  const eventMenusByBooking = useMemo(() => {
    const map = new Map<string, EventMenu>();
    eventMenus.forEach((m) => map.set(m.bookingId, m));
    return map;
  }, [eventMenus]);

  const cateringMenusByBooking = useMemo(() => {
    const map = new Map<string, CateringEventMenu>();
    cateringMenus.forEach((m) => map.set(m.bookingId, m));
    return map;
  }, [cateringMenus]);

  const shoppingByBooking = useMemo(() => {
    const map = new Map<string, ShoppingList>();
    shoppingLists.forEach((l) => map.set(l.bookingId, l));
    return map;
  }, [shoppingLists]);

  const rangeStart = useMemo(() => {
    if (dateRange === 'all') return null;
    return startOfDay(subMonths(new Date(), dateRange === '30' ? 1 : 3));
  }, [dateRange]);

  const rangeEnd = useMemo(() => endOfDay(new Date()), []);

  const linkedEvents: LinkedEvent[] = useMemo(() => {
    return bookings
      .filter((b) => {
        if (!rangeStart) return true;
        const d = parseISO(b.eventDate);
        return isWithinInterval(d, { start: rangeStart, end: rangeEnd });
      })
      .map((booking) => {
        const eventMenu = booking.menuId
          ? eventMenus.find((m) => m.id === booking.menuId) ?? null
          : null;
        const cateringMenu = booking.cateringMenuId
          ? cateringMenus.find((m) => m.id === booking.cateringMenuId) ?? null
          : cateringMenusByBooking.get(booking.id) ?? null;
        const shoppingList = shoppingByBooking.get(booking.id) ?? null;
        const guests = booking.adults + (booking.children ?? 0);
        return {
          booking,
          eventMenu,
          cateringMenu,
          shoppingList,
          eventDate: booking.eventDate,
          customerName: booking.customerName,
          guests,
          hasMenu: !!(eventMenu || cateringMenu),
          hasShoppingList: !!shoppingList,
        };
      })
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [bookings, eventMenus, cateringMenus, cateringMenusByBooking, shoppingByBooking, rangeStart, rangeEnd]);

  // Most ordered: proteins from per-guest menus
  const proteinCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    linkedEvents.forEach(({ eventMenu }) => {
      if (!eventMenu?.guestSelections) return;
      eventMenu.guestSelections.forEach((g) => {
        [g.protein1, g.protein2].forEach((p) => {
          if (p) counts[p] = (counts[p] ?? 0) + 1;
        });
      });
    });
    return counts;
  }, [linkedEvents]);

  const mostOrderedProteins = useMemo(
    () =>
      Object.entries(proteinCounts)
        .map(([protein, count]) => ({ protein, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    [proteinCounts]
  );

  // Most ordered: catering items (name + total servings)
  const cateringItemCounts = useMemo(() => {
    const byName: Record<string, { servings: number; events: number }> = {};
    linkedEvents.forEach(({ cateringMenu }) => {
      if (!cateringMenu?.selectedItems) return;
      cateringMenu.selectedItems.forEach((item) => {
        const name = item.name || item.menuItemId;
        if (!name) return;
        if (!byName[name]) byName[name] = { servings: 0, events: 0 };
        byName[name].servings += item.servings ?? 0;
        byName[name].events += 1;
      });
    });
    return byName;
  }, [linkedEvents]);

  const mostOrderedCateringItems = useMemo(
    () =>
      Object.entries(cateringItemCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.servings - a.servings)
        .slice(0, 15),
    [cateringItemCounts]
  );

  // Most common shopping list items (by name, total qty across events)
  const shoppingItemCounts = useMemo(() => {
    const byName: Record<string, { qty: number; events: number; unit: string }> = {};
    linkedEvents.forEach(({ shoppingList }) => {
      if (!shoppingList?.items?.length) return;
      shoppingList.items.forEach((item) => {
        const name = item.name || 'Unknown';
        if (!byName[name]) byName[name] = { qty: 0, events: 0, unit: item.plannedUnit || 'ea' };
        byName[name].qty += item.plannedQty ?? 0;
        byName[name].events += 1;
      });
    });
    return byName;
  }, [linkedEvents]);

  const mostShoppingItems = useMemo(
    () =>
      Object.entries(shoppingItemCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 20),
    [shoppingItemCounts]
  );

  // Metrics
  const metrics = useMemo(() => {
    const withMenu = linkedEvents.filter((e) => e.hasMenu).length;
    const withShopping = linkedEvents.filter((e) => e.hasShoppingList).length;
    const totalGuests = linkedEvents.reduce((s, e) => s + e.guests, 0);
    const totalShoppingItems = linkedEvents.reduce(
      (s, e) => s + (e.shoppingList?.items?.length ?? 0),
      0
    );
    return {
      totalEvents: linkedEvents.length,
      eventsWithMenu: withMenu,
      eventsWithShoppingList: withShopping,
      totalGuests,
      avgGuestsPerEvent: linkedEvents.length ? Math.round((totalGuests / linkedEvents.length) * 10) / 10 : 0,
      totalShoppingLines: totalShoppingItems,
      avgShoppingLinesPerEvent: withShopping ? Math.round((totalShoppingItems / withShopping) * 10) / 10 : 0,
    };
  }, [linkedEvents]);

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Menus & Shopping
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Event menus and shopping lists linked to events. Use for most-ordered items, metrics, tracking, and forecasting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">Period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <Link
              href="/reports"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              ← Reports
            </Link>
          </div>
        </div>

        {/* Metrics cards */}
        <section className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
            <ChartBarIcon className="h-5 w-5" />
            Metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Events in period</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{metrics.totalEvents}</p>
            </div>
            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">With event menu</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{metrics.eventsWithMenu}</p>
              <p className="text-xs text-text-muted">{metrics.totalEvents ? Math.round((metrics.eventsWithMenu / metrics.totalEvents) * 100) : 0}% of events</p>
            </div>
            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">With shopping list</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{metrics.eventsWithShoppingList}</p>
              <p className="text-xs text-text-muted">{metrics.totalEvents ? Math.round((metrics.eventsWithShoppingList / metrics.totalEvents) * 100) : 0}% of events</p>
            </div>
            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Total guests</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{metrics.totalGuests}</p>
              <p className="text-xs text-text-muted">Avg {metrics.avgGuestsPerEvent} per event</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Shopping list lines (total)</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{metrics.totalShoppingLines}</p>
              <p className="text-xs text-text-muted">Avg {metrics.avgShoppingLinesPerEvent} per event with list</p>
            </div>
          </div>
        </section>

        {/* Most ordered: proteins */}
        {mostOrderedProteins.length > 0 && (
          <section className="mb-8 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Most ordered proteins (guest menu)
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              From per-guest event menus (Protein 1 & 2 selections). Use for ordering and forecasting.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-text-secondary">Protein</th>
                    <th className="py-2 text-right font-medium text-text-secondary">Selections</th>
                  </tr>
                </thead>
                <tbody>
                  {mostOrderedProteins.map(({ protein, count }) => (
                    <tr key={protein} className="border-b border-border/50">
                      <td className="py-2 text-text-primary">{protein}</td>
                      <td className="py-2 text-right font-medium text-text-primary">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Most ordered: catering items */}
        {mostOrderedCateringItems.length > 0 && (
          <section className="mb-8 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Most ordered catering items
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              From catering/buffet event menus (total servings across events).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-text-secondary">Item</th>
                    <th className="py-2 text-right font-medium text-text-secondary">Total servings</th>
                    <th className="py-2 text-right font-medium text-text-secondary">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {mostOrderedCateringItems.map(({ name, servings, events }) => (
                    <tr key={name} className="border-b border-border/50">
                      <td className="py-2 text-text-primary">{name}</td>
                      <td className="py-2 text-right font-medium text-text-primary">{servings}</td>
                      <td className="py-2 text-right text-text-muted">{events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Most common shopping list items */}
        {mostShoppingItems.length > 0 && (
          <section className="mb-8 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <ShoppingCartIcon className="h-5 w-5" />
              Most common shopping list items
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              Aggregated from all event shopping lists. Use for purchasing and inventory forecasting.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-text-secondary">Item</th>
                    <th className="py-2 text-right font-medium text-text-secondary">Total qty</th>
                    <th className="py-2 text-right font-medium text-text-secondary">Unit</th>
                    <th className="py-2 text-right font-medium text-text-secondary">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {mostShoppingItems.map(({ name, qty, unit, events }) => (
                    <tr key={name} className="border-b border-border/50">
                      <td className="py-2 text-text-primary">{name}</td>
                      <td className="py-2 text-right font-medium text-text-primary">{qty}</td>
                      <td className="py-2 text-right text-text-muted">{unit}</td>
                      <td className="py-2 text-right text-text-muted">{events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Event table: linked menus & shopping */}
        <section className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
            <CalendarDaysIcon className="h-5 w-5" />
            Events linked to menus & shopping
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Tracking: each event with links to its event menu and shopping list.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium text-text-secondary">Date</th>
                  <th className="py-2 text-left font-medium text-text-secondary">Client</th>
                  <th className="py-2 text-right font-medium text-text-secondary">Guests</th>
                  <th className="py-2 text-center font-medium text-text-secondary">Menu</th>
                  <th className="py-2 text-center font-medium text-text-secondary">Shopping</th>
                  <th className="py-2 text-left font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkedEvents.map((row) => (
                  <tr key={row.booking.id} className="border-b border-border/50 hover:bg-card-elevated/50">
                    <td className="py-2 text-text-primary">
                      {format(parseISO(row.eventDate), 'MMM d, yyyy')}
                    </td>
                    <td className="py-2 text-text-primary">{row.customerName}</td>
                    <td className="py-2 text-right text-text-muted">{row.guests}</td>
                    <td className="py-2 text-center">
                      {row.hasMenu ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Yes
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      {row.hasShoppingList ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Yes
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {row.hasMenu && (
                          <Link
                            href={`/bookings/menu?bookingId=${row.booking.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                          >
                            View menu
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <Link
                          href={`/bookings/shopping?bookingId=${row.booking.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        >
                          Shopping list
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {linkedEvents.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              No events in the selected period.
            </p>
          )}
        </section>

        {/* Forecasting note */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">Forecasting</h2>
          <p className="text-sm text-text-muted">
            Use the metrics and most-ordered tables above to plan inventory and purchasing: average guests per event,
            average shopping list lines per event, and top proteins and items by volume. Filter by last 30 or 90 days
            to emphasize recent trends.
          </p>
        </section>
      </div>
    </div>
  );
}
