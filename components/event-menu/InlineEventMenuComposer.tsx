'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { DEFAULT_MENU_ITEMS } from '@/lib/defaultMenuItems';
import { buildMenuPricingSnapshot } from '@/lib/menuPricing';
import type { MoneyRules } from '@/lib/types';
import type { Booking } from '@/lib/bookingTypes';
import type {
  CateringEventMenu,
  CateringSelectedItem,
  EventMenu,
  GuestMenuSelection,
  MenuItem,
} from '@/lib/menuTypes';
import { CATERING_EVENT_MENUS_KEY } from '@/lib/menuCategories';
import { useAuth } from '@/components/AuthProvider';

const FALLBACK_PROTEINS = ['Chicken', 'Steak', 'Shrimp'];

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function loadMenuItems(): MenuItem[] {
  try {
    const raw = localStorage.getItem('menuItems');
    const parsed: MenuItem[] = raw ? JSON.parse(raw) : DEFAULT_MENU_ITEMS;
    return parsed.filter((item) => item.isAvailable);
  } catch {
    return DEFAULT_MENU_ITEMS.filter((item) => item.isAvailable);
  }
}

function loadBookings(): Booking[] {
  try {
    const raw = localStorage.getItem('bookings');
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    return [];
  }
}

function saveBookings(bookings: Booking[]) {
  localStorage.setItem('bookings', JSON.stringify(bookings));
  window.dispatchEvent(new Event('bookingsUpdated'));
}

function initializeGuestRows(booking: Booking): GuestMenuSelection[] {
  const total = Math.max(booking.adults + (booking.children ?? 0), 1);
  return Array.from({ length: total }).map((_, idx) => ({
    id: `guest-${Date.now()}-${idx}`,
    guestName: `Guest ${idx + 1}`,
    isAdult: idx < booking.adults,
    protein1: FALLBACK_PROTEINS[0],
    protein2: FALLBACK_PROTEINS[1],
    wantsFriedRice: true,
    wantsNoodles: true,
    wantsSalad: true,
    wantsVeggies: true,
    specialRequests: '',
    allergies: '',
  }));
}

export default function InlineEventMenuComposer({
  booking,
  rules,
}: {
  booking: Booking;
  rules: MoneyRules;
}) {
  const { user, isAdmin } = useAuth();
  const isPrivateDinner = booking.eventType === 'private-dinner';
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [guestSelections, setGuestSelections] = useState<GuestMenuSelection[]>([]);
  const [selectedItems, setSelectedItems] = useState<CateringSelectedItem[]>([]);
  const [notes, setNotes] = useState('');
  const [existingPrivateMenu, setExistingPrivateMenu] = useState<EventMenu | null>(null);
  const [existingCateringMenu, setExistingCateringMenu] = useState<CateringEventMenu | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'draft' | 'ready' | 'approved'>('draft');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userRole = String(user?.app_metadata?.role ?? '').toLowerCase();
  const canApproveMenu = isAdmin || userRole === 'manager';
  const approverName =
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ??
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name ??
    user?.email ??
    'manager';

  useEffect(() => {
    setMenuItems(loadMenuItems());

    if (isPrivateDinner) {
      const raw = localStorage.getItem('eventMenus');
      const menus: EventMenu[] = raw ? JSON.parse(raw) : [];
      const existing = booking.menuId ? menus.find((m) => m.id === booking.menuId) : null;
      setExistingPrivateMenu(existing ?? null);
      setGuestSelections(existing?.guestSelections ?? initializeGuestRows(booking));
      setApprovalStatus(existing?.approvalStatus ?? 'draft');
      return;
    }

    const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
    const menus: CateringEventMenu[] = raw ? JSON.parse(raw) : [];
    const existing = booking.cateringMenuId ? menus.find((m) => m.id === booking.cateringMenuId) : null;
    setExistingCateringMenu(existing ?? null);
    setSelectedItems(existing?.selectedItems ?? []);
    setNotes(existing?.notes ?? '');
    setApprovalStatus(existing?.approvalStatus ?? 'draft');
  }, [booking.id, booking.menuId, booking.cateringMenuId, booking.adults, booking.children, isPrivateDinner]);

  const proteinOptions = useMemo(() => {
    const proteins = menuItems
      .filter((item) => item.category === 'protein')
      .map((item) => item.name);
    return proteins.length > 0 ? proteins : FALLBACK_PROTEINS;
  }, [menuItems]);

  const addCateringItem = (itemId: string) => {
    if (!itemId) return;
    const item = menuItems.find((m) => m.id === itemId);
    if (!item) return;
    if (selectedItems.some((s) => s.menuItemId === item.id)) return;
    const guests = booking.adults + (booking.children ?? 0);
    setSelectedItems((prev) => [
      ...prev,
      {
        menuItemId: item.id,
        name: item.name,
        servings: Math.max(guests, 1),
        pricePerServing: item.pricePerServing,
        costPerServing: item.costPerServing,
        unit: item.unit,
      },
    ]);
  };

  const privateMenuIsComplete = useMemo(() => {
    const totalGuests = booking.adults + (booking.children ?? 0);
    if (guestSelections.length < totalGuests) return false;
    return !guestSelections.some(
      (g) => !g.guestName.trim() || !g.protein1 || !g.protein2 || g.protein1 === g.protein2
    );
  }, [booking.adults, booking.children, guestSelections]);

  const savePrivateDinnerMenu = (nextStatus: 'draft' | 'ready' | 'approved' = 'draft') => {
    const totalGuests = booking.adults + (booking.children ?? 0);
    if (nextStatus !== 'draft' && !privateMenuIsComplete) {
      setMessage(`Menu must be complete before ${nextStatus === 'ready' ? 'marking ready' : 'approval'} (${guestSelections.length}/${totalGuests} guests).`);
      return;
    }
    if (nextStatus === 'approved' && !canApproveMenu) {
      setMessage('Only manager/admin can approve menus.');
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const menuId = existingPrivateMenu?.id ?? booking.menuId ?? `menu-${Date.now()}`;
    const menu: EventMenu = {
      id: menuId,
      bookingId: booking.id,
      guestSelections,
      approvalStatus: nextStatus,
      approvedAt: nextStatus === 'approved' ? now : undefined,
      approvedBy: nextStatus === 'approved' ? approverName : undefined,
      createdAt: existingPrivateMenu?.createdAt ?? now,
      updatedAt: now,
    };

    const rawMenus = localStorage.getItem('eventMenus');
    const allMenus: EventMenu[] = rawMenus ? JSON.parse(rawMenus) : [];
    const nextMenus = (existingPrivateMenu || booking.menuId)
      ? allMenus.map((m) => (m.id === menuId ? menu : m))
      : [...allMenus, menu];
    localStorage.setItem('eventMenus', JSON.stringify(nextMenus));

    const snapshot = buildMenuPricingSnapshot(menu, menuItems, {
      childDiscountPercent: rules.pricing.childDiscountPercent,
      premiumAddOnPerGuest: booking.premiumAddOn,
    });
    const updatedFinancials = calculateEventFinancials(
      {
        adults: booking.adults,
        children: booking.children,
        eventType: booking.eventType,
        eventDate: parseLocalDate(booking.eventDate),
        distanceMiles: booking.distanceMiles,
        premiumAddOn: booking.premiumAddOn,
        staffingProfileId: booking.staffingProfileId,
        subtotalOverride: snapshot.subtotalOverride,
        foodCostOverride: snapshot.foodCostOverride,
      },
      rules
    );

    const bookings = loadBookings();
    saveBookings(
      bookings.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              menuId,
              menuPricingSnapshot: snapshot,
              subtotal: updatedFinancials.subtotal,
              gratuity: updatedFinancials.gratuity,
              distanceFee: updatedFinancials.distanceFee,
              total: updatedFinancials.totalCharged,
              updatedAt: now,
            }
          : b
      )
    );

    setSaving(false);
    setApprovalStatus(nextStatus);
    setExistingPrivateMenu(menu);
    setMessage(nextStatus === 'approved' ? 'Menu approved.' : nextStatus === 'ready' ? 'Menu marked ready.' : 'Menu draft saved.');
  };

  const cateringMenuIsComplete = selectedItems.length > 0;

  const saveCateringMenu = (nextStatus: 'draft' | 'ready' | 'approved' = 'draft') => {
    if (nextStatus !== 'draft' && !cateringMenuIsComplete) {
      setMessage(`Add at least one item before ${nextStatus === 'ready' ? 'marking ready' : 'approval'}.`);
      return;
    }
    if (nextStatus === 'approved' && !canApproveMenu) {
      setMessage('Only manager/admin can approve menus.');
      return;
    }
    setSaving(true);

    const now = new Date().toISOString();
    const menuId = existingCateringMenu?.id ?? booking.cateringMenuId ?? `catering-menu-${Date.now()}`;
    const menu: CateringEventMenu = {
      id: menuId,
      bookingId: booking.id,
      menuType: 'catering',
      selectedItems,
      notes: notes || undefined,
      approvalStatus: nextStatus,
      approvedAt: nextStatus === 'approved' ? now : undefined,
      approvedBy: nextStatus === 'approved' ? approverName : undefined,
      createdAt: existingCateringMenu?.createdAt ?? now,
      updatedAt: now,
    };

    const rawMenus = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
    const allMenus: CateringEventMenu[] = rawMenus ? JSON.parse(rawMenus) : [];
    const nextMenus = (existingCateringMenu || booking.cateringMenuId)
      ? allMenus.map((m) => (m.id === menuId ? menu : m))
      : [...allMenus, menu];
    localStorage.setItem(CATERING_EVENT_MENUS_KEY, JSON.stringify(nextMenus));

    const subtotalOverride = selectedItems.reduce(
      (sum, item) => sum + item.servings * item.pricePerServing,
      0
    );
    const foodCostOverride = selectedItems.reduce(
      (sum, item) => sum + item.servings * item.costPerServing,
      0
    );
    const snapshot = { menuId, subtotalOverride, foodCostOverride, calculatedAt: now };
    const updatedFinancials = calculateEventFinancials(
      {
        adults: booking.adults,
        children: booking.children,
        eventType: booking.eventType,
        eventDate: parseLocalDate(booking.eventDate),
        distanceMiles: booking.distanceMiles,
        premiumAddOn: booking.premiumAddOn,
        staffingProfileId: booking.staffingProfileId,
        subtotalOverride,
        foodCostOverride,
      },
      rules
    );

    const bookings = loadBookings();
    saveBookings(
      bookings.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              cateringMenuId: menuId,
              menuPricingSnapshot: snapshot,
              subtotal: updatedFinancials.subtotal,
              gratuity: updatedFinancials.gratuity,
              distanceFee: updatedFinancials.distanceFee,
              total: updatedFinancials.totalCharged,
              updatedAt: now,
            }
          : b
      )
    );

    setSaving(false);
    setApprovalStatus(nextStatus);
    setExistingCateringMenu(menu);
    setMessage(nextStatus === 'approved' ? 'Menu approved.' : nextStatus === 'ready' ? 'Menu marked ready.' : 'Menu draft saved.');
  };

  if (isPrivateDinner) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text-primary">Private Dinner Guest Menu</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-card-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
              Status: {approvalStatus}
            </span>
            <button
              type="button"
              onClick={() => setGuestSelections(initializeGuestRows(booking))}
              className="rounded-md border border-border bg-card-elevated px-3 py-1.5 text-xs text-text-secondary hover:bg-card"
            >
              Reset Guest Rows
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-card-elevated">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Guest</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Adult</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Protein 1</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Protein 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {guestSelections.map((guest, index) => (
                <tr key={guest.id}>
                  <td className="px-3 py-2">
                    <input
                      value={guest.guestName}
                      onChange={(e) =>
                        setGuestSelections((prev) =>
                          prev.map((g, i) => (i === index ? { ...g, guestName: e.target.value } : g))
                        )
                      }
                      className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm text-text-primary"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={guest.isAdult}
                      onChange={(e) =>
                        setGuestSelections((prev) =>
                          prev.map((g, i) => (i === index ? { ...g, isAdult: e.target.checked } : g))
                        )
                      }
                      className="h-4 w-4 accent-accent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={guest.protein1}
                      onChange={(e) =>
                        setGuestSelections((prev) =>
                          prev.map((g, i) => (i === index ? { ...g, protein1: e.target.value } : g))
                        )
                      }
                      className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm text-text-primary"
                    >
                      {proteinOptions.map((protein) => (
                        <option key={protein} value={protein}>
                          {protein}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={guest.protein2}
                      onChange={(e) =>
                        setGuestSelections((prev) =>
                          prev.map((g, i) => (i === index ? { ...g, protein2: e.target.value } : g))
                        )
                      }
                      className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm text-text-primary"
                    >
                      {proteinOptions.map((protein) => (
                        <option key={protein} value={protein}>
                          {protein}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {guestSelections.length} guest rows · {privateMenuIsComplete ? 'Complete' : 'Incomplete'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => savePrivateDinnerMenu('draft')}
              disabled={saving}
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-xs font-medium text-text-secondary hover:bg-card disabled:opacity-60"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => savePrivateDinnerMenu('ready')}
              disabled={saving || !privateMenuIsComplete}
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-xs font-medium text-text-secondary hover:bg-card disabled:opacity-60"
            >
              Mark Ready
            </button>
            <button
              type="button"
              onClick={() => savePrivateDinnerMenu('approved')}
              disabled={saving || !privateMenuIsComplete || !canApproveMenu}
              title={canApproveMenu ? 'Approve menu' : 'Manager/admin only'}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Approve Menu'}
            </button>
          </div>
        </div>
        {message && <p className="text-xs text-text-secondary">{message}</p>}
      </div>
    );
  }

  const subtotal = selectedItems.reduce((sum, item) => sum + item.servings * item.pricePerServing, 0);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">Catering Menu Items</p>
        <span className="rounded-full bg-card-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
          Status: {approvalStatus}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          defaultValue=""
          onChange={(e) => {
            addCateringItem(e.target.value);
            e.currentTarget.value = '';
          }}
          className="min-w-[220px] rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
        >
          <option value="">Add item…</option>
          {menuItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({formatCurrency(item.pricePerServing)})
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-card-elevated">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Item</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Servings</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Unit Price</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Line Total</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-text-muted">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {selectedItems.map((item) => (
              <tr key={item.menuItemId}>
                <td className="px-3 py-2 text-text-primary">{item.name}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={item.servings}
                    onChange={(e) =>
                      setSelectedItems((prev) =>
                        prev.map((s) =>
                          s.menuItemId === item.menuItemId
                            ? { ...s, servings: Math.max(1, parseInt(e.target.value) || 1) }
                            : s
                        )
                      )
                    }
                    className="w-20 rounded-md border border-border bg-card px-2 py-1 text-sm text-text-primary"
                  />
                </td>
                <td className="px-3 py-2 text-text-secondary">{formatCurrency(item.pricePerServing)}</td>
                <td className="px-3 py-2 text-text-primary">{formatCurrency(item.servings * item.pricePerServing)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItems((prev) => prev.filter((s) => s.menuItemId !== item.menuItemId))}
                    className="rounded-md border border-border bg-card-elevated px-2 py-1 text-xs text-text-secondary hover:bg-card"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {selectedItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-xs text-text-muted">
                  No items selected yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Subtotal: {formatCurrency(subtotal)} · {cateringMenuIsComplete ? 'Complete' : 'Incomplete'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => saveCateringMenu('draft')}
            disabled={saving}
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-xs font-medium text-text-secondary hover:bg-card disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => saveCateringMenu('ready')}
            disabled={saving || !cateringMenuIsComplete}
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-xs font-medium text-text-secondary hover:bg-card disabled:opacity-60"
          >
            Mark Ready
          </button>
          <button
            type="button"
            onClick={() => saveCateringMenu('approved')}
            disabled={saving || !cateringMenuIsComplete || !canApproveMenu}
            title={canApproveMenu ? 'Approve menu' : 'Manager/admin only'}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Approve Menu'}
          </button>
        </div>
      </div>
      {message && <p className="text-xs text-text-secondary">{message}</p>}
    </div>
  );
}
