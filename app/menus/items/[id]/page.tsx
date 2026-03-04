'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type {
  CateringEventMenu,
  EventMenu,
  MenuItem,
  MenuItemPacklistLine,
  MenuItemPortionSegment,
  MenuItemRecipeLine,
} from '@/lib/menuTypes';
import type { Booking } from '@/lib/bookingTypes';
import { CATERING_EVENT_MENUS_KEY } from '@/lib/menuCategories';
import { appendMenuItemChangeLog, diffMenuItemFields, loadMenuItemChangeLog } from '@/lib/menuItemChangeLog';
import { loadProposalWriterConfig } from '@/lib/proposalWriter';

type TabId =
  | 'main'
  | 'tags'
  | 'recipe'
  | 'costing'
  | 'labor'
  | 'packlist'
  | 'packages'
  | 'history';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'main', label: 'Main' },
  { id: 'tags', label: 'Tags' },
  { id: 'recipe', label: 'Recipe' },
  { id: 'costing', label: 'Costing & Pricing' },
  { id: 'labor', label: 'Labor Cost' },
  { id: 'packlist', label: 'Packlist Items' },
  { id: 'packages', label: 'Package Associations' },
  { id: 'history', label: 'Event History' },
];

const PROTEIN_ITEM_ID: Record<string, string> = {
  chicken: 'protein-chicken',
  steak: 'protein-steak',
  shrimp: 'protein-shrimp',
  scallops: 'protein-scallops',
  'filet-mignon': 'protein-filet-mignon',
};

const SIDE_ITEM_ID: Record<string, string> = {
  wantsFriedRice: 'side-rice',
  wantsNoodles: 'side-noodles',
  wantsSalad: 'side-salad',
  wantsVeggies: 'side-veggies',
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function loadMenuItems(): MenuItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('menuItems');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MenuItem[];
  } catch {
    return [];
  }
}

function saveMenuItems(items: MenuItem[]) {
  localStorage.setItem('menuItems', JSON.stringify(items));
  window.dispatchEvent(new Event('menuItemsUpdated'));
}

type HistoryRow = {
  bookingId: string;
  customerName: string;
  eventDate: string;
  source: 'catering' | 'hibachi';
  quantity: number;
};

export default function MenuItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = params?.id;

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('main');
  const [item, setItem] = useState<MenuItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [availablePackages, setAvailablePackages] = useState<string[]>([]);
  const [selectedPackageToAdd, setSelectedPackageToAdd] = useState('');

  useEffect(() => {
    const all = loadMenuItems();
    const found = all.find((m) => m.id === itemId) ?? null;
    setItem(found);
    const packages = loadProposalWriterConfig().packageNames;
    setAvailablePackages(packages);
    setSelectedPackageToAdd(packages[0] ?? '');
    setLoading(false);
  }, [itemId]);

  const historyRows = useMemo(() => {
    if (!itemId || typeof window === 'undefined') return [] as HistoryRow[];
    const bookingsRaw = localStorage.getItem('bookings');
    const bookings: Booking[] = bookingsRaw ? (JSON.parse(bookingsRaw) as Booking[]) : [];
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));
    const rows: HistoryRow[] = [];

    const cateringRaw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
    const cateringMenus: CateringEventMenu[] = cateringRaw ? (JSON.parse(cateringRaw) as CateringEventMenu[]) : [];
    for (const menu of cateringMenus) {
      for (const sel of menu.selectedItems) {
        if (sel.menuItemId !== itemId) continue;
        const b = bookingMap.get(menu.bookingId);
        if (!b) continue;
        rows.push({
          bookingId: b.id,
          customerName: b.customerName,
          eventDate: b.eventDate,
          source: 'catering',
          quantity: sel.servings,
        });
      }
    }

    const eventRaw = localStorage.getItem('eventMenus');
    const eventMenus: EventMenu[] = eventRaw ? (JSON.parse(eventRaw) as EventMenu[]) : [];
    const itemIsProteinKey = Object.entries(PROTEIN_ITEM_ID).find(([, id]) => id === itemId)?.[0];
    const itemIsSideKey = Object.entries(SIDE_ITEM_ID).find(([, id]) => id === itemId)?.[0];
    if (itemIsProteinKey || itemIsSideKey) {
      for (const menu of eventMenus) {
        let qty = 0;
        for (const guest of menu.guestSelections) {
          if (itemIsProteinKey) {
            if (guest.protein1 === itemIsProteinKey) qty++;
            if (guest.protein2 === itemIsProteinKey) qty++;
          }
          if (itemIsSideKey && (guest as unknown as Record<string, boolean>)[itemIsSideKey]) qty++;
        }
        if (qty <= 0) continue;
        const b = bookingMap.get(menu.bookingId);
        if (!b) continue;
        rows.push({
          bookingId: b.id,
          customerName: b.customerName,
          eventDate: b.eventDate,
          source: 'hibachi',
          quantity: qty,
        });
      }
    }

    rows.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    return rows;
  }, [itemId]);

  const changeLogRows = useMemo(() => {
    if (!itemId) return [];
    return loadMenuItemChangeLog().filter((row) => row.menuItemId === itemId).slice(0, 50);
  }, [itemId, message]);

  const addRecipeLine = () => {
    if (!item) return;
    const next: MenuItemRecipeLine[] = [
      ...(item.recipe ?? []),
      { id: makeId('recipe'), ingredient: '', quantity: 1, unit: 'ea', unitCost: 0 },
    ];
    setItem({ ...item, recipe: next });
  };

  const addPacklistLine = () => {
    if (!item) return;
    const next: MenuItemPacklistLine[] = [
      ...(item.packlistItems ?? []),
      { id: makeId('pack'), itemName: '', quantity: 1, unit: 'ea', required: true },
    ];
    setItem({ ...item, packlistItems: next });
  };

  const addPortionSegment = () => {
    if (!item) return;
    const next: MenuItemPortionSegment[] = [
      ...(item.portionSegments ?? []),
      {
        id: makeId('segment'),
        label: 'Standard',
        portionSize: 1,
        portionUnit: item.unit ?? 'serving',
        yieldCount: 1,
        salePrice: item.pricePerServing ?? 0,
        cost: item.costPerServing ?? 0,
      },
    ];
    setItem({ ...item, portionSegments: next });
  };

  const persist = () => {
    if (!item) return;
    const all = loadMenuItems();
    const previous = all.find((m) => m.id === item.id);
    if (!previous) return;
    const fieldsChanged = diffMenuItemFields(previous, item);
    const next = all.map((m) =>
      m.id === item.id
        ? {
            ...item,
            status: item.status ?? 'active',
            lastCostUpdatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : m
    );
    if (fieldsChanged.length > 0) {
      const changedBy = 'Local user';
      appendMenuItemChangeLog({
        menuItemId: item.id,
        changedAt: new Date().toISOString(),
        changedBy,
        fields: fieldsChanged,
        summary: `${fieldsChanged.length} field${fieldsChanged.length > 1 ? 's' : ''} updated`,
      });
    }
    saveMenuItems(next);
    setMessage('Menu item saved.');
    setTimeout(() => setMessage(null), 2500);
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-text-muted">Loading item…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-8">
        <p className="text-text-muted">Menu item not found.</p>
        <Link href="/menus?subtab=catalog" className="mt-3 inline-block text-accent hover:underline">
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Menu Item: {item.name || '(unnamed)'}</h1>
            <p className="text-sm text-text-muted">Master editor scaffold for menu operations.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/menus?subtab=catalog"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-text-secondary hover:bg-card-elevated"
            >
              Back to Catalog
            </Link>
            <button
              type="button"
              onClick={() => router.push('/menus?subtab=catalog')}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-text-secondary hover:bg-card-elevated"
            >
              Close
            </button>
            <button
              type="button"
              onClick={persist}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                tab === t.id ? 'bg-accent text-white' : 'text-text-secondary hover:bg-card-elevated hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          {tab === 'main' && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Display name</label>
                <input
                  value={item.name}
                  onChange={(e) => setItem({ ...item, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Station</label>
                <input
                  value={item.station ?? ''}
                  onChange={(e) => setItem({ ...item, station: e.target.value })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  placeholder="Grill, Prep, Garde Manger"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Menu item status</label>
                <select
                  value={item.status ?? 'active'}
                  onChange={(e) => setItem({ ...item, status: e.target.value as MenuItem['status'] })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Price per serving</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.pricePerServing}
                  onChange={(e) => setItem({ ...item, pricePerServing: toNumber(e.target.value) })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Cost per serving</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.costPerServing}
                  onChange={(e) => setItem({ ...item, costPerServing: toNumber(e.target.value) })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Accounting code</label>
                <input
                  value={item.accountingCode ?? ''}
                  onChange={(e) => setItem({ ...item, accountingCode: e.target.value })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  placeholder="GL-FOOD-100"
                />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-sm text-text-secondary">Description</label>
                <textarea
                  value={item.description}
                  onChange={(e) => setItem({ ...item, description: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={item.isBeverage ?? false}
                  onChange={(e) => setItem({ ...item, isBeverage: e.target.checked })}
                />
                Mark as beverage
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={item.isAvailable}
                  onChange={(e) => setItem({ ...item, isAvailable: e.target.checked })}
                />
                Available for new menus
              </label>
            </div>
          )}

          {tab === 'tags' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Workflow tags (comma separated)</label>
                <input
                  value={(item.tags ?? []).join(', ')}
                  onChange={(e) => setItem({ ...item, tags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  placeholder="hibachi, standard"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Dietary tags</label>
                <input
                  value={(item.dietaryTags ?? []).join(', ')}
                  onChange={(e) =>
                    setItem({ ...item, dietaryTags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })
                  }
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  placeholder="vegan, gluten-free"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-text-secondary">Allergens</label>
                <input
                  value={(item.allergens ?? []).join(', ')}
                  onChange={(e) => setItem({ ...item, allergens: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  placeholder="shellfish, nuts, dairy"
                />
              </div>
            </div>
          )}

          {tab === 'recipe' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">Define ingredients and unit costs for this item.</p>
                <button
                  type="button"
                  onClick={addRecipeLine}
                  className="rounded-md border border-border bg-card-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card"
                >
                  + Add ingredient
                </button>
              </div>
              {(item.recipe ?? []).length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-text-muted">No ingredients yet.</p>
              ) : (
                <div className="space-y-2">
                  {(item.recipe ?? []).map((line) => (
                    <div key={line.id} className="grid gap-2 md:grid-cols-12">
                      <input
                        value={line.ingredient}
                        onChange={(e) =>
                          setItem({
                            ...item,
                            recipe: (item.recipe ?? []).map((r) => (r.id === line.id ? { ...r, ingredient: e.target.value } : r)),
                          })
                        }
                        placeholder="Ingredient"
                        className="md:col-span-5 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                      />
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          setItem({
                            ...item,
                            recipe: (item.recipe ?? []).map((r) => (r.id === line.id ? { ...r, quantity: toNumber(e.target.value) } : r)),
                          })
                        }
                        className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                      />
                      <input
                        value={line.unit}
                        onChange={(e) =>
                          setItem({
                            ...item,
                            recipe: (item.recipe ?? []).map((r) => (r.id === line.id ? { ...r, unit: e.target.value } : r)),
                          })
                        }
                        placeholder="unit"
                        className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitCost ?? 0}
                        onChange={(e) =>
                          setItem({
                            ...item,
                            recipe: (item.recipe ?? []).map((r) => (r.id === line.id ? { ...r, unitCost: toNumber(e.target.value) } : r)),
                          })
                        }
                        className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setItem({
                            ...item,
                            recipe: (item.recipe ?? []).filter((r) => r.id !== line.id),
                          })
                        }
                        className="md:col-span-1 rounded-md border border-border bg-card-elevated px-2 py-2 text-xs text-danger hover:bg-danger/10"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'costing' && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-border bg-card-elevated p-3">
                  <p className="text-xs text-text-muted">Current sale price</p>
                  <p className="text-lg font-semibold text-text-primary">${item.pricePerServing.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-card-elevated p-3">
                  <p className="text-xs text-text-muted">Current cost</p>
                  <p className="text-lg font-semibold text-text-primary">${item.costPerServing.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-card-elevated p-3">
                  <p className="text-xs text-text-muted">Gross margin</p>
                  <p className="text-lg font-semibold text-text-primary">
                    ${(item.pricePerServing - item.costPerServing).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-card-elevated p-3">
                  <p className="text-xs text-text-muted">Margin %</p>
                  <p className="text-lg font-semibold text-text-primary">
                    {item.pricePerServing > 0
                      ? `${(((item.pricePerServing - item.costPerServing) / item.pricePerServing) * 100).toFixed(1)}%`
                      : '0.0%'}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Effective from</label>
                  <input
                    type="date"
                    value={item.effectiveFrom ?? ''}
                    onChange={(e) => setItem({ ...item, effectiveFrom: e.target.value || undefined })}
                    className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Effective to</label>
                  <input
                    type="date"
                    value={item.effectiveTo ?? ''}
                    onChange={(e) => setItem({ ...item, effectiveTo: e.target.value || undefined })}
                    className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-muted">Portion segments</p>
                  <button
                    type="button"
                    onClick={addPortionSegment}
                    className="rounded-md border border-border bg-card-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card"
                  >
                    + Add portion segment
                  </button>
                </div>
                {(item.portionSegments ?? []).map((seg) => (
                  <div key={seg.id} className="grid gap-2 md:grid-cols-12">
                    <input
                      value={seg.label}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          portionSegments: (item.portionSegments ?? []).map((s) =>
                            s.id === seg.id ? { ...s, label: e.target.value } : s
                          ),
                        })
                      }
                      className="md:col-span-3 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      type="number"
                      value={seg.portionSize}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          portionSegments: (item.portionSegments ?? []).map((s) =>
                            s.id === seg.id ? { ...s, portionSize: toNumber(e.target.value) } : s
                          ),
                        })
                      }
                      className="md:col-span-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      value={seg.portionUnit}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          portionSegments: (item.portionSegments ?? []).map((s) =>
                            s.id === seg.id ? { ...s, portionUnit: e.target.value } : s
                          ),
                        })
                      }
                      className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      type="number"
                      value={seg.yieldCount}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          portionSegments: (item.portionSegments ?? []).map((s) =>
                            s.id === seg.id ? { ...s, yieldCount: toNumber(e.target.value) } : s
                          ),
                        })
                      }
                      className="md:col-span-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      type="number"
                      value={seg.salePrice}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          portionSegments: (item.portionSegments ?? []).map((s) =>
                            s.id === seg.id ? { ...s, salePrice: toNumber(e.target.value) } : s
                          ),
                        })
                      }
                      className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      type="number"
                      value={seg.cost}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          portionSegments: (item.portionSegments ?? []).map((s) =>
                            s.id === seg.id ? { ...s, cost: toNumber(e.target.value) } : s
                          ),
                        })
                      }
                      className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setItem({
                          ...item,
                          portionSegments: (item.portionSegments ?? []).filter((s) => s.id !== seg.id),
                        })
                      }
                      className="md:col-span-1 rounded-md border border-border bg-card-elevated px-2 py-2 text-xs text-danger hover:bg-danger/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'labor' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Labor minutes per batch</label>
                <input
                  type="number"
                  min="0"
                  value={item.laborMinutes ?? 0}
                  onChange={(e) => setItem({ ...item, laborMinutes: toNumber(e.target.value) })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Labor rate per hour</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.laborRatePerHour ?? 0}
                  onChange={(e) => setItem({ ...item, laborRatePerHour: toNumber(e.target.value) })}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
          )}

          {tab === 'packlist' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">Define what should be packed when this item is on an event menu.</p>
                <button
                  type="button"
                  onClick={addPacklistLine}
                  className="rounded-md border border-border bg-card-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card"
                >
                  + Add pack item
                </button>
              </div>
              {(item.packlistItems ?? []).map((line) => (
                <div key={line.id} className="grid gap-2 md:grid-cols-12">
                  <input
                    value={line.itemName}
                    onChange={(e) =>
                      setItem({
                        ...item,
                        packlistItems: (item.packlistItems ?? []).map((p) =>
                          p.id === line.id ? { ...p, itemName: e.target.value } : p
                        ),
                      })
                    }
                    className="md:col-span-5 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  />
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) =>
                      setItem({
                        ...item,
                        packlistItems: (item.packlistItems ?? []).map((p) =>
                          p.id === line.id ? { ...p, quantity: toNumber(e.target.value) } : p
                        ),
                      })
                    }
                    className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  />
                  <input
                    value={line.unit}
                    onChange={(e) =>
                      setItem({
                        ...item,
                        packlistItems: (item.packlistItems ?? []).map((p) =>
                          p.id === line.id ? { ...p, unit: e.target.value } : p
                        ),
                      })
                    }
                    className="md:col-span-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  />
                  <label className="md:col-span-2 flex items-center gap-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={line.required ?? true}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          packlistItems: (item.packlistItems ?? []).map((p) =>
                            p.id === line.id ? { ...p, required: e.target.checked } : p
                          ),
                        })
                      }
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setItem({
                        ...item,
                        packlistItems: (item.packlistItems ?? []).filter((p) => p.id !== line.id),
                      })
                    }
                    className="md:col-span-1 rounded-md border border-border bg-card-elevated px-2 py-2 text-xs text-danger hover:bg-danger/10"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'packages' && (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">Link this item to proposal/menu packages (one per line).</p>
              {availablePackages.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPackageToAdd}
                    onChange={(e) => setSelectedPackageToAdd(e.target.value)}
                    className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                  >
                    {availablePackages.map((pkg) => (
                      <option key={pkg} value={pkg}>
                        {pkg}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPackageToAdd.trim()) return;
                      const set = new Set(item.packageAssociations ?? []);
                      set.add(selectedPackageToAdd.trim());
                      setItem({ ...item, packageAssociations: Array.from(set) });
                    }}
                    className="rounded-md border border-border bg-card-elevated px-3 py-2 text-xs font-medium text-text-primary hover:bg-card"
                  >
                    + Add package
                  </button>
                  <Link href="/proposal-writer" className="text-xs text-accent hover:underline">
                    Manage packages
                  </Link>
                </div>
              )}
              <textarea
                value={(item.packageAssociations ?? []).join('\n')}
                onChange={(e) =>
                  setItem({
                    ...item,
                    packageAssociations: e.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
                rows={8}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                placeholder="Wedding Silver Package&#10;Corporate Lunch Package"
              />
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Usage history from event menus. Includes catering selected items and mapped hibachi proteins/sides.
              </p>
              {historyRows.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-text-muted">
                  No matching event usage found yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-card-elevated">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Event</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Type</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((row) => (
                        <tr key={`${row.bookingId}-${row.source}-${row.eventDate}`} className="border-t border-border">
                          <td className="px-3 py-2 text-text-secondary">{row.eventDate}</td>
                          <td className="px-3 py-2 text-text-primary">{row.customerName}</td>
                          <td className="px-3 py-2 text-text-secondary">{row.source}</td>
                          <td className="px-3 py-2 text-right text-text-primary">{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text-primary">Change Log</h3>
                {changeLogRows.length === 0 ? (
                  <p className="mt-2 rounded-md border border-dashed border-border p-4 text-sm text-text-muted">
                    No change log entries yet.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {changeLogRows.map((row) => (
                      <div key={row.id} className="rounded-md border border-border bg-card-elevated p-3">
                        <p className="text-sm text-text-primary">{row.summary}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {new Date(row.changedAt).toLocaleString()} · {row.changedBy}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">Fields: {row.fields.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {message && <p className="mt-3 text-sm text-green-600">{message}</p>}
      </div>
    </div>
  );
}
