'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Booking } from '@/lib/bookingTypes';
import type {
  EventMenu,
  GuestMenuSelection,
  MenuItem,
  MenuCategoryNode,
  CateringEventMenu,
  CateringSelectedItem,
  PrivateDinnerTemplate,
} from '@/lib/menuTypes';
import { DEFAULT_PRIVATE_DINNER_TEMPLATE } from '@/lib/menuTypes';
import {
  loadMenuCategories,
  getChildren,
  getRoots,
  getDescendantIds,
  getCategoryName,
  LEGACY_CATEGORY_MAP,
  CATERING_EVENT_MENUS_KEY,
} from '@/lib/menuCategories';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { formatCurrency, calculateEventFinancials } from '@/lib/moneyRules';
import { DEFAULT_MENU_ITEMS } from '@/lib/defaultMenuItems';
import { buildMenuPricingSnapshot, calculateMenuPricingBreakdown } from '@/lib/menuPricing';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizeMenuItems(items: MenuItem[]): MenuItem[] {
  const defaultById = new Map(DEFAULT_MENU_ITEMS.map((item) => [item.id, item]));
  return items.map((item) => {
    const fallback = defaultById.get(item.id);
    const normalizedCost = Number.isFinite(item.costPerServing) ? item.costPerServing : 0;
    const normalizedPrice = Number.isFinite(item.pricePerServing)
      ? (item.pricePerServing as number)
      : fallback?.pricePerServing ?? Math.max(0, normalizedCost * 3);

    return {
      ...item,
      costPerServing: normalizedCost,
      pricePerServing: normalizedPrice,
    };
  });
}

// ─── Catering Menu Builder ────────────────────────────────────────────────────
// Used for any event type that is NOT 'private-dinner' (e.g. buffet, corporate, etc.)

function CateringMenuBuilder({
  booking,
  router,
}: {
  booking: Booking;
  router: ReturnType<typeof useRouter>;
}) {
  const rules = useMoneyRules();
  const totalGuests = booking.adults + (booking.children ?? 0);

  const [categories, setCategories] = useState<MenuCategoryNode[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<CateringSelectedItem[]>([]);
  const [notes, setNotes] = useState('');
  const [existingMenu, setExistingMenu] = useState<CateringEventMenu | null>(null);
  const [saving, setSaving] = useState(false);

  // Load data on mount
  useEffect(() => {
    setCategories(loadMenuCategories());

    const raw = localStorage.getItem('menuItems');
    const items: MenuItem[] = raw ? JSON.parse(raw) : DEFAULT_MENU_ITEMS;
    // Apply legacy categoryId migration
    const migrated = items.map((item) => ({
      ...item,
      categoryId: item.categoryId ?? LEGACY_CATEGORY_MAP[item.category] ?? undefined,
    }));
    setMenuItems(migrated);

    // Load existing catering menu if booking has one
    if (booking.cateringMenuId) {
      const menusRaw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
      if (menusRaw) {
        const menus: CateringEventMenu[] = JSON.parse(menusRaw);
        const found = menus.find((m) => m.id === booking.cateringMenuId);
        if (found) {
          setExistingMenu(found);
          setSelectedItems(found.selectedItems);
          setNotes(found.notes ?? '');
        }
      }
    }
  }, [booking.cateringMenuId]);

  // Items filtered by selected category (and its descendants)
  const filteredItems = useMemo(() => {
    const available = menuItems.filter((i) => i.isAvailable);
    if (!selectedCategoryId) return available;
    const descendantIds = getDescendantIds(categories, selectedCategoryId);
    const validIds = new Set([selectedCategoryId, ...descendantIds]);
    return available.filter((i) => i.categoryId && validIds.has(i.categoryId));
  }, [menuItems, categories, selectedCategoryId]);

  const isItemSelected = (itemId: string) =>
    selectedItems.some((s) => s.menuItemId === itemId);

  const addItem = (item: MenuItem) => {
    if (isItemSelected(item.id)) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        menuItemId: item.id,
        name: item.name,
        servings: totalGuests,
        pricePerServing: item.pricePerServing,
        costPerServing: item.costPerServing,
        unit: item.unit,
      },
    ]);
  };

  const removeItem = (menuItemId: string) =>
    setSelectedItems((prev) => prev.filter((s) => s.menuItemId !== menuItemId));

  const updateServings = (menuItemId: string, servings: number) =>
    setSelectedItems((prev) =>
      prev.map((s) => (s.menuItemId === menuItemId ? { ...s, servings } : s))
    );

  const totals = useMemo(() => {
    const revenue = selectedItems.reduce(
      (sum, item) => sum + item.servings * item.pricePerServing,
      0
    );
    const cost = selectedItems.reduce(
      (sum, item) => sum + item.servings * item.costPerServing,
      0
    );
    return {
      revenue,
      cost,
      profit: revenue - cost,
      perPerson: totalGuests > 0 ? revenue / totalGuests : 0,
    };
  }, [selectedItems, totalGuests]);

  // ── Category tree helpers ──────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getItemCount = (catId: string): number => {
    const descendants = getDescendantIds(categories, catId);
    const allIds = new Set([catId, ...descendants]);
    return menuItems.filter(
      (i) => i.isAvailable && i.categoryId && allIds.has(i.categoryId)
    ).length;
  };

  const renderCategoryNode = (cat: MenuCategoryNode, depth: number): React.ReactNode => {
    const children = getChildren(categories, cat.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(cat.id);
    const isSelected = selectedCategoryId === cat.id;
    const count = getItemCount(cat.id);

    return (
      <div key={cat.id}>
        <button
          type="button"
          onClick={() => {
            setSelectedCategoryId(cat.id);
            if (hasChildren) toggleExpand(cat.id);
          }}
          className={`flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm transition-colors ${
            isSelected
              ? 'bg-accent/15 font-medium text-accent'
              : 'text-text-secondary hover:bg-card-elevated hover:text-text-primary'
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {hasChildren ? (
            <span className="shrink-0 text-text-muted">{isExpanded ? '▾' : '▸'}</span>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className="flex-1 truncate">{cat.name}</span>
          {count > 0 && <span className="ml-1 text-xs text-text-muted">({count})</span>}
        </button>
        {hasChildren && isExpanded && (
          <div>{children.map((child) => renderCategoryNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (selectedItems.length === 0) {
      alert('Please add at least one menu item before saving.');
      return;
    }
    setSaving(true);

    const menuId = existingMenu?.id ?? `catering-menu-${Date.now()}`;
    const now = new Date().toISOString();
    const menu: CateringEventMenu = {
      id: menuId,
      bookingId: booking.id,
      menuType: 'catering',
      selectedItems,
      notes: notes || undefined,
      createdAt: existingMenu?.createdAt ?? now,
      updatedAt: now,
    };

    // Save to cateringEventMenus
    const menusRaw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
    const menus: CateringEventMenu[] = menusRaw ? JSON.parse(menusRaw) : [];
    const updatedMenus = existingMenu
      ? menus.map((m) => (m.id === menuId ? menu : m))
      : [...menus, menu];
    localStorage.setItem(CATERING_EVENT_MENUS_KEY, JSON.stringify(updatedMenus));

    // Build pricing snapshot
    const subtotalOverride = selectedItems.reduce(
      (sum, item) => sum + item.servings * item.pricePerServing,
      0
    );
    const foodCostOverride = selectedItems.reduce(
      (sum, item) => sum + item.servings * item.costPerServing,
      0
    );
    const snapshot = { menuId, subtotalOverride, foodCostOverride, calculatedAt: now };

    // Recalculate booking financials
    const financials = calculateEventFinancials(
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

    // Update booking
    const bookingsRaw = localStorage.getItem('bookings');
    if (bookingsRaw) {
      const bookings: Booking[] = JSON.parse(bookingsRaw);
      const updatedBookings = bookings.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              cateringMenuId: menuId,
              menuPricingSnapshot: snapshot,
              subtotal: financials.subtotal,
              gratuity: financials.gratuity,
              distanceFee: financials.distanceFee,
              total: financials.totalCharged,
              updatedAt: now,
            }
          : b
      );
      localStorage.setItem('bookings', JSON.stringify(updatedBookings));
      window.dispatchEvent(new Event('bookingsUpdated'));
    }

    setSaving(false);
    router.push(`/bookings?bookingId=${booking.id}`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Catering Menu</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {booking.customerName} · {booking.eventDate} ·{' '}
            {totalGuests} guest{totalGuests !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/bookings?bookingId=${booking.id}`)}
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-secondary hover:bg-card"
          >
            ← Back
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Menu'}
          </button>
        </div>
      </div>

      {/* Main: category tree (left) + item list (right) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT: Category tree */}
        <div className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
          <div className="shrink-0 border-b border-border px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Categories
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {/* All Items */}
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={`mb-1 flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                !selectedCategoryId
                  ? 'bg-accent/15 font-medium text-accent'
                  : 'text-text-secondary hover:bg-card-elevated hover:text-text-primary'
              }`}
            >
              <span className="w-3 shrink-0" />
              <span className="flex-1">All Items</span>
              <span className="text-xs text-text-muted">
                ({menuItems.filter((i) => i.isAvailable).length})
              </span>
            </button>
            {getRoots(categories).map((cat) => renderCategoryNode(cat, 0))}
          </div>
        </div>

        {/* RIGHT: Item list */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border px-4 py-2">
            <p className="text-xs text-text-muted">
              {selectedCategoryId
                ? getCategoryName(categories, selectedCategoryId)
                : 'All Items'}{' '}
              · {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-text-muted">
                No items in this category
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-card-elevated">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted">
                      Unit
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted">
                      Price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted">
                      Cost
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-text-muted">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => {
                    const added = isItemSelected(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-card-elevated ${added ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {item.photoBase64 && (
                              <img
                                src={item.photoBase64}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium text-text-primary">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-text-muted">
                                  {item.description.slice(0, 60)}
                                  {item.description.length > 60 ? '…' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-text-muted">
                          {item.unit ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-primary">
                          {formatCurrency(item.pricePerServing)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-muted">
                          {formatCurrency(item.costPerServing)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => addItem(item)}
                            disabled={added}
                            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                              added
                                ? 'cursor-not-allowed bg-success/10 text-success'
                                : 'bg-accent/10 text-accent hover:bg-accent/20'
                            }`}
                          >
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Selected items panel */}
      <div
        className="shrink-0 overflow-y-auto border-t border-border bg-card"
        style={{ maxHeight: '40vh', minHeight: selectedItems.length > 0 ? '180px' : '52px' }}
      >
        {selectedItems.length === 0 ? (
          <div className="flex items-center justify-center py-3 text-sm text-text-muted">
            No items selected — browse the catalog above and click &quot;+ Add&quot;
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-card-elevated">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted">
                    Item
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-text-muted">
                    Servings
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted">
                    $/srv
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted">
                    Revenue
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted">
                    Food Cost
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedItems.map((item) => (
                  <tr key={item.menuItemId} className="hover:bg-card-elevated">
                    <td className="px-4 py-2 font-medium text-text-primary">
                      {item.name}
                      {item.unit && (
                        <span className="ml-1 text-xs text-text-muted">({item.unit})</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.servings}
                        onChange={(e) =>
                          updateServings(
                            item.menuItemId,
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-16 rounded border border-border bg-card-elevated px-2 py-1 text-center text-sm text-text-primary"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-text-muted">
                      {formatCurrency(item.pricePerServing)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-text-primary">
                      {formatCurrency(item.servings * item.pricePerServing)}
                    </td>
                    <td className="px-4 py-2 text-right text-text-muted">
                      {formatCurrency(item.servings * item.costPerServing)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.menuItemId)}
                        className="text-text-muted hover:text-danger"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals + notes + save */}
            <div className="flex flex-wrap items-start gap-4 border-t border-border bg-card-elevated px-4 py-3">
              <div className="flex flex-1 flex-wrap gap-6">
                <div>
                  <p className="text-xs text-text-muted">Revenue</p>
                  <p className="text-sm font-bold text-text-primary">
                    {formatCurrency(totals.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Food Cost</p>
                  <p className="text-sm font-bold text-danger">{formatCurrency(totals.cost)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Gross Profit</p>
                  <p className="text-sm font-bold text-success">
                    {formatCurrency(totals.profit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Per Person</p>
                  <p className="text-sm font-bold text-text-primary">
                    {formatCurrency(totals.perPerson)}
                  </p>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Menu notes (optional)…"
                rows={2}
                className="w-48 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="self-end rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Menu'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BookingMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg text-text-secondary">Loading menu...</div>
        </div>
      }
    >
      <BookingMenuContent />
    </Suspense>
  );
}

function BookingMenuContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rules = useMoneyRules();
  const bookingId = searchParams.get('bookingId');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [existingMenu, setExistingMenu] = useState<EventMenu | null>(null);
  const [guestSelections, setGuestSelections] = useState<GuestMenuSelection[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Load private dinner template from localStorage
  const template = useMemo<PrivateDinnerTemplate>(() => {
    try {
      const raw = localStorage.getItem('privateDinnerTemplate');
      return raw ? { ...DEFAULT_PRIVATE_DINNER_TEMPLATE, ...JSON.parse(raw) } : DEFAULT_PRIVATE_DINNER_TEMPLATE;
    } catch {
      return DEFAULT_PRIVATE_DINNER_TEMPLATE;
    }
  }, []);

  const enabledUpgrades = useMemo(() => template.upgrades.filter((u) => u.enabled), [template]);

  // Upgrade options: prefer Business Rules protein add-ons when set, else menu template
  const effectiveUpgrades = useMemo(() => {
    const fromRules = rules?.pricing?.proteinAddOns ?? [];
    if (fromRules.length > 0) {
      return fromRules.filter((x) => x.protein && x.label);
    }
    return enabledUpgrades.map((u) => ({ protein: u.protein, label: u.label, pricePerPerson: u.pricePerPerson }));
  }, [rules?.pricing?.proteinAddOns, enabledUpgrades]);

  // Protein dropdown: base proteins + upgrades as options (upgrades show +$ in label)
  const proteinOptions = useMemo(() => {
    const base: { value: string; label: string; isUpgrade?: boolean }[] = [];
    const hibachiItems = menuItems.filter(
      (item) => item.tags?.includes('hibachi') && item.isAvailable
    );
    if (hibachiItems.length > 0) {
      base.push(...hibachiItems.map((item) => ({ value: item.name, label: item.name })));
    } else {
      base.push(
        ...template.baseProteins
          .filter((p) => p.enabled)
          .map((p) => ({ value: p.protein, label: p.label }))
      );
    }
    const upgradeOptions = effectiveUpgrades.map((u) => ({
      value: u.protein,
      label: `${u.label} (+$${Number(u.pricePerPerson).toFixed(0)})`,
      isUpgrade: true as const,
    }));
    return [...base, ...upgradeOptions];
  }, [menuItems, template, effectiveUpgrades]);

  // Load menu items so we can calculate menu-based pricing
  useEffect(() => {
    const loadMenuItems = () => {
      const savedMenuItems = localStorage.getItem('menuItems');
      if (savedMenuItems) {
        try {
          const parsed = JSON.parse(savedMenuItems) as MenuItem[];
          const normalized = normalizeMenuItems(parsed);
          setMenuItems(normalized);
          localStorage.setItem('menuItems', JSON.stringify(normalized));
          return;
        } catch (e) {
          console.error('Failed to load menu items:', e);
        }
      }

      setMenuItems(DEFAULT_MENU_ITEMS);
      localStorage.setItem('menuItems', JSON.stringify(DEFAULT_MENU_ITEMS));
    };

    loadMenuItems();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'menuItems') loadMenuItems();
    };
    const handleCustom = () => loadMenuItems();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('menuItemsUpdated', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('menuItemsUpdated', handleCustom);
    };
  }, []);

  // Load booking and existing menu
  useEffect(() => {
    if (!bookingId) {
      alert('No booking ID provided');
      router.push('/bookings');
      return;
    }

    // Load booking
    const bookingsData = localStorage.getItem('bookings');
    if (bookingsData) {
      const bookings: Booking[] = JSON.parse(bookingsData);
      const foundBooking = bookings.find((b) => b.id === bookingId);

      if (!foundBooking) {
        alert('Booking not found');
        router.push('/bookings');
        return;
      }

      setBooking(foundBooking);

      // Load existing menu if it exists
      if (foundBooking.menuId) {
        const menusData = localStorage.getItem('eventMenus');
        if (menusData) {
          const menus: EventMenu[] = JSON.parse(menusData);
          const foundMenu = menus.find((m) => m.id === foundBooking.menuId);
          if (foundMenu) {
            setExistingMenu(foundMenu);
            setGuestSelections(foundMenu.guestSelections);
            return;
          }
        }
      }

      // Initialize empty guest selections based on guest count
      const totalGuests = foundBooking.adults + foundBooking.children;
      const initialSelections: GuestMenuSelection[] = [];

      // Determine default proteins: prefer hibachi-tagged catalog items, fall back to template keys
      let defaultP1 = 'chicken';
      let defaultP2 = 'steak';
      try {
        const rawItems = localStorage.getItem('menuItems');
        if (rawItems) {
          const allItems: MenuItem[] = JSON.parse(rawItems);
          const hibachi = allItems.filter((i) => i.tags?.includes('hibachi') && i.isAvailable);
          if (hibachi.length > 0) defaultP1 = hibachi[0].name;
          if (hibachi.length > 1) defaultP2 = hibachi[1].name;
          else if (hibachi.length === 1) defaultP2 = hibachi[0].name;
        }
      } catch { /* keep defaults */ }

      for (let i = 0; i < totalGuests; i++) {
        initialSelections.push({
          id: `guest-${i + 1}`,
          guestName: '',
          isAdult: i < foundBooking.adults, // First N guests are adults
          protein1: defaultP1,
          protein2: defaultP2,
          wantsFriedRice: true,
          wantsNoodles: true,
          wantsSalad: true,
          wantsVeggies: true,
          specialRequests: '',
          allergies: '',
        });
      }

      setGuestSelections(initialSelections);
    }
  }, [bookingId, router]);

  const updateGuestSelection = (
    index: number,
    field: keyof GuestMenuSelection,
    value: any
  ) => {
    const updated = [...guestSelections];
    const guest = updated[index];
    if (field === 'protein1') {
      if (value === guest.protein2) {
        updated[index] = { ...guest, protein1: value, protein2: guest.protein1 };
      } else {
        updated[index] = { ...guest, protein1: value };
      }
    } else if (field === 'protein2') {
      if (value === guest.protein1) {
        updated[index] = { ...guest, protein1: guest.protein2, protein2: value };
      } else {
        updated[index] = { ...guest, protein2: value };
      }
    } else {
      updated[index] = { ...guest, [field]: value };
    }
    setGuestSelections(updated);
  };

  const menuPricing = useMemo(() => {
    if (!booking || guestSelections.length === 0) return null;
    return calculateMenuPricingBreakdown(
      {
        id: existingMenu?.id || 'menu-preview',
        bookingId: booking.id,
        guestSelections,
        createdAt: existingMenu?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      menuItems,
      {
        childDiscountPercent: rules.pricing.childDiscountPercent,
        premiumAddOnPerGuest: booking.premiumAddOn,
      }
    );
  }, [booking, existingMenu, guestSelections, menuItems, rules]);

  // Upgrade totals: derived from protein1/protein2 when they are upgrade options (price from effectiveUpgrades)
  const upgradeTotals = useMemo(() => {
    let revenueAdd = 0;
    let costAdd = 0;
    guestSelections.forEach((g) => {
      const multiplier = g.isAdult ? 1 : (rules?.pricing?.childDiscountPercent != null ? 1 - rules.pricing.childDiscountPercent / 100 : 0.5);
      for (const protein of [g.protein1, g.protein2]) {
        const fromEffective = effectiveUpgrades.find((x) => x.protein === protein);
        if (fromEffective) {
          revenueAdd += fromEffective.pricePerPerson * multiplier;
        } else {
          const u = enabledUpgrades.find((x) => x.protein === protein);
          if (u) {
            revenueAdd += u.pricePerPerson * multiplier;
            costAdd += (u.costPerPerson ?? 0) * multiplier;
          }
        }
      }
    });
    return { revenueAdd, costAdd };
  }, [guestSelections, effectiveUpgrades, enabledUpgrades, rules?.pricing?.childDiscountPercent]);

  const finalMenuPricing = useMemo(() => {
    if (!menuPricing) return null;
    return {
      ...menuPricing,
      subtotalOverride: menuPricing.subtotalOverride + upgradeTotals.revenueAdd,
      foodCostOverride: menuPricing.foodCostOverride + upgradeTotals.costAdd,
    };
  }, [menuPricing, upgradeTotals]);

  const pricingPreview = useMemo(() => {
    if (!booking || !finalMenuPricing) return null;
    return calculateEventFinancials(
      {
        adults: booking.adults,
        children: booking.children,
        eventType: booking.eventType,
        eventDate: parseLocalDate(booking.eventDate),
        distanceMiles: booking.distanceMiles,
        premiumAddOn: booking.premiumAddOn,
        staffingProfileId: booking.staffingProfileId,
        subtotalOverride: finalMenuPricing.subtotalOverride,
        foodCostOverride: finalMenuPricing.foodCostOverride,
      },
      rules
    );
  }, [booking, finalMenuPricing, rules]);

  const handleSave = () => {
    if (!booking || !bookingId) return;

    // Validate that all guests have names
    const missingNames = guestSelections.filter((g) => !g.guestName.trim());
    if (missingNames.length > 0) {
      alert(`Please enter names for all ${missingNames.length} guest(s)`);
      return;
    }

    // Validate exactly 2 different proteins per guest
    const invalidProteins = guestSelections.filter((g) => !g.protein1 || !g.protein2 || g.protein1 === g.protein2);
    if (invalidProteins.length > 0) {
      alert('Each guest must select exactly 2 different proteins. Please fix the highlighted rows.');
      return;
    }

    // Create or update menu (derive upgradeProteins from protein1/protein2 for stored consistency)
    const menuId = existingMenu?.id || `menu-${Date.now()}`;
    const guestSelectionsToSave = guestSelections.map((g) => {
      const upgradeProteins = [g.protein1, g.protein2].filter((p) =>
        effectiveUpgrades.some((u) => u.protein === p)
      );
      return { ...g, upgradeProteins };
    });
    const menu: EventMenu = {
      id: menuId,
      bookingId: bookingId,
      guestSelections: guestSelectionsToSave,
      createdAt: existingMenu?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const baseSnapshot = buildMenuPricingSnapshot(menu, menuItems, {
      childDiscountPercent: rules.pricing.childDiscountPercent,
      premiumAddOnPerGuest: booking.premiumAddOn,
    });
    // Apply upgrade add-on pricing on top of the base menu snapshot
    const snapshot = {
      ...baseSnapshot,
      subtotalOverride: baseSnapshot.subtotalOverride + upgradeTotals.revenueAdd,
      foodCostOverride: baseSnapshot.foodCostOverride + upgradeTotals.costAdd,
    };
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

    // Save menu
    const menusData = localStorage.getItem('eventMenus');
    let menus: EventMenu[] = menusData ? JSON.parse(menusData) : [];

    if (existingMenu) {
      menus = menus.map((m) => (m.id === menuId ? menu : m));
    } else {
      menus.push(menu);
    }

    localStorage.setItem('eventMenus', JSON.stringify(menus));

    // Update booking with menuId and menu-derived pricing snapshot
    const bookingsData = localStorage.getItem('bookings');
    if (bookingsData) {
      const bookings: Booking[] = JSON.parse(bookingsData);
      const updatedBookings = bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              menuId,
              menuPricingSnapshot: snapshot,
              subtotal: updatedFinancials.subtotal,
              gratuity: updatedFinancials.gratuity,
              distanceFee: updatedFinancials.distanceFee,
              total: updatedFinancials.totalCharged,
              updatedAt: new Date().toISOString(),
            }
          : b
      );
      localStorage.setItem('bookings', JSON.stringify(updatedBookings));
      window.dispatchEvent(new Event('bookingsUpdated'));
    }

    alert('Menu saved successfully!');
    router.push('/bookings');
  };

  const summary = useMemo(() => {
    const proteinCounts: Record<string, number> = {};

    guestSelections.forEach((guest) => {
      proteinCounts[guest.protein1] = (proteinCounts[guest.protein1] ?? 0) + 1;
      proteinCounts[guest.protein2] = (proteinCounts[guest.protein2] ?? 0) + 1;
    });

    return {
      totalGuests: guestSelections.length,
      adults: guestSelections.filter((g) => g.isAdult).length,
      children: guestSelections.filter((g) => !g.isAdult).length,
      proteinCounts,
      friedRice: guestSelections.filter((g) => g.wantsFriedRice).length,
      noodles: guestSelections.filter((g) => g.wantsNoodles).length,
      salad: guestSelections.filter((g) => g.wantsSalad).length,
      veggies: guestSelections.filter((g) => g.wantsVeggies).length,
    };
  }, [guestSelections]);

  if (!booking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg text-text-secondary">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Dual-mode branch: non-private-dinner events use the catering menu builder
  if (booking.eventType !== 'private-dinner') {
    return <CateringMenuBuilder booking={booking} router={router} />;
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              Guest Menu Selection
            </h1>
            <p className="mt-2 text-text-secondary">
              {booking.customerName} - {booking.eventDate} at {booking.eventTime}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {booking.adults} Adults, {booking.children} Children
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/bookings')}
              className="rounded-md border border-border bg-card-elevated px-4 py-2 text-text-secondary hover:bg-card"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              Save Menu
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-lg border border-border bg-accent-soft-bg p-4 ">
            <h3 className="text-sm font-medium text-text-primary">
              Total Protein Selections
            </h3>
            <p className="mt-2 text-2xl font-bold text-accent">
              {summary.totalGuests * 2}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {summary.totalGuests} guests × 2 proteins
            </p>
          </div>

          {Object.entries(summary.proteinCounts)
            .filter(([, count]) => count > 0)
            .map(([protein, count]) => {
              const label = proteinOptions.find((o) => o.value === protein)?.label ?? protein;
              return (
                <div key={protein} className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
                  <h3 className="text-sm font-medium text-red-900 dark:text-red-200">{label}</h3>
                  <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{count}</p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">selections</p>
                </div>
              );
            })}

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/20">
            <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
              Sides Needed
            </h3>
            <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
              Rice: {summary.friedRice} | Noodles: {summary.noodles}
            </p>
            <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
              Salad: {summary.salad} | Veggies: {summary.veggies}
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              Menu Revenue Estimate
            </h3>
            <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(finalMenuPricing?.subtotalOverride ?? 0)}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Includes premium add-on (${booking.premiumAddOn.toFixed(2)}/guest)
            </p>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
            <h3 className="text-sm font-medium text-rose-900 dark:text-rose-200">
              Food Cost Estimate
            </h3>
            <p className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(finalMenuPricing?.foodCostOverride ?? 0)}
            </p>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
              Gross Profit: {formatCurrency(pricingPreview?.grossProfit ?? 0)}
            </p>
          </div>
        </div>

        {finalMenuPricing && finalMenuPricing.missingItemIds.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
            Missing menu items in catalog for: {finalMenuPricing.missingItemIds.join(', ')}. Their price/cost was treated as $0.00.
          </div>
        )}

        {/* Guest Selection Table */}
        <p className="mb-2 text-sm text-text-muted">
          Each guest must select exactly 2 different proteins.
        </p>
        <div className="rounded-lg border border-border bg-card  ">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-card-elevated  ">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    Guest Name *
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    Protein 1
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    Protein 2
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    Sides
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    Special Requests
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary">
                    Allergies
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {guestSelections.map((guest, index) => (
                  <tr
                    key={guest.id}
                    className={`hover:bg-card-elevated ${
                      !guest.protein1 || !guest.protein2 || guest.protein1 === guest.protein2
                        ? 'bg-rose-50/50 dark:bg-rose-950/20'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-4 text-sm font-medium text-text-primary">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="text"
                        value={guest.guestName}
                        onChange={(e) =>
                          updateGuestSelection(index, 'guestName', e.target.value)
                        }
                        placeholder="Enter name"
                        className="w-full rounded-md border border-border px-2 py-1 text-sm bg-card-elevated text-text-primary"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={guest.isAdult ? 'adult' : 'child'}
                        onChange={(e) =>
                          updateGuestSelection(index, 'isAdult', e.target.value === 'adult')
                        }
                        className="w-24 rounded-md border border-border px-2 py-1 text-sm bg-card-elevated text-text-primary"
                      >
                        <option value="adult">Adult</option>
                        <option value="child">Child</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={guest.protein1}
                        onChange={(e) =>
                          updateGuestSelection(index, 'protein1', e.target.value)
                        }
                        className="w-28 rounded-md border border-border px-2 py-1 text-sm bg-card-elevated text-text-primary"
                      >
                        {proteinOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={guest.protein2}
                        onChange={(e) =>
                          updateGuestSelection(index, 'protein2', e.target.value)
                        }
                        className="w-28 rounded-md border border-border px-2 py-1 text-sm bg-card-elevated text-text-primary"
                      >
                        {proteinOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 text-xs text-text-muted">
                        <label className="flex cursor-default items-center gap-1 opacity-70">
                          <input
                            type="checkbox"
                            checked={guest.wantsFriedRice}
                            disabled
                            readOnly
                            className="h-3 w-3 rounded border-border text-emerald-600"
                          />
                          <span>Fried Rice</span>
                          <span className="text-text-muted">(included)</span>
                        </label>
                        <label className="flex cursor-default items-center gap-1 opacity-70">
                          <input
                            type="checkbox"
                            checked={guest.wantsNoodles}
                            disabled
                            readOnly
                            className="h-3 w-3 rounded border-border text-emerald-600"
                          />
                          <span>Noodles</span>
                          <span className="text-text-muted">(included)</span>
                        </label>
                        <label className="flex cursor-default items-center gap-1 opacity-70">
                          <input
                            type="checkbox"
                            checked={guest.wantsSalad}
                            disabled
                            readOnly
                            className="h-3 w-3 rounded border-border text-emerald-600"
                          />
                          <span>Salad</span>
                          <span className="text-text-muted">(included)</span>
                        </label>
                        <label className="flex cursor-default items-center gap-1 opacity-70">
                          <input
                            type="checkbox"
                            checked={guest.wantsVeggies}
                            disabled
                            readOnly
                            className="h-3 w-3 rounded border-border text-emerald-600"
                          />
                          <span>Veggies</span>
                          <span className="text-text-muted">(included)</span>
                        </label>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <textarea
                        value={guest.specialRequests}
                        onChange={(e) =>
                          updateGuestSelection(index, 'specialRequests', e.target.value)
                        }
                        placeholder="Special requests..."
                        rows={2}
                        className="w-32 rounded-md border border-border bg-card-elevated px-2 py-1 text-xs text-text-primary"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <textarea
                        value={guest.allergies}
                        onChange={(e) =>
                          updateGuestSelection(index, 'allergies', e.target.value)
                        }
                        placeholder="Allergies..."
                        rows={2}
                        className="w-32 rounded-md border border-border bg-card-elevated px-2 py-1 text-xs text-text-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Button (Bottom) */}
        <div className="mt-8 flex justify-end gap-2">
          <button
            onClick={() => router.push('/bookings')}
            className="rounded-md border border-border bg-card-elevated px-6 py-3 text-text-secondary hover:bg-card"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-700"
          >
            Save Menu
          </button>
        </div>
      </div>
    </div>
  );
}
