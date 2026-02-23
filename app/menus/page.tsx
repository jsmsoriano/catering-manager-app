'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/moneyRules';
import type { MenuItem, MenuCategory, MenuCategoryNode, PrivateDinnerTemplate } from '@/lib/menuTypes';
import { DEFAULT_MENU_ITEMS } from '@/lib/defaultMenuItems';
import { DEFAULT_PRIVATE_DINNER_TEMPLATE } from '@/lib/menuTypes';
import {
  loadMenuCategories,
  saveMenuCategories,
  getChildren,
  getRoots,
  getDescendantIds,
  getCategoryName,
  LEGACY_CATEGORY_MAP,
} from '@/lib/menuCategories';

const categoryLabels: Record<MenuCategory, string> = {
  protein: 'Proteins',
  side: 'Sides',
  appetizer: 'Appetizers',
  dessert: 'Desserts',
  beverage: 'Beverages',
};


// ─── Menu Template Tab ──────────────────────────────────────────────────────

function MenuTemplateTab() {
  const [template, setTemplate] = useState<PrivateDinnerTemplate>(DEFAULT_PRIVATE_DINNER_TEMPLATE);
  const [saved, setSaved] = useState(false);

  // Inclusions
  const [newInclusion, setNewInclusion] = useState('');
  const [editingInclusionIdx, setEditingInclusionIdx] = useState<number | null>(null);
  const [editingInclusionVal, setEditingInclusionVal] = useState('');

  // Base proteins add form
  const [newProteinLabel, setNewProteinLabel] = useState('');

  // Upgrade add-ons add form
  const [newUpgradeLabel, setNewUpgradeLabel] = useState('');
  const [newUpgradePrice, setNewUpgradePrice] = useState('5');
  const [newUpgradeCost, setNewUpgradeCost] = useState('3');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('privateDinnerTemplate');
      if (raw) setTemplate(JSON.parse(raw));
    } catch { /* use default */ }
  }, []);

  const handleSave = () => {
    const updated = { ...template, updatedAt: new Date().toISOString() };
    localStorage.setItem('privateDinnerTemplate', JSON.stringify(updated));
    setTemplate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Inclusions helpers ──────────────────────────────────────────────────────
  const addInclusion = () => {
    const val = newInclusion.trim();
    if (!val) return;
    setTemplate((t) => ({ ...t, inclusions: [...t.inclusions, val] }));
    setNewInclusion('');
  };

  const startEditInclusion = (i: number) => {
    setEditingInclusionIdx(i);
    setEditingInclusionVal(template.inclusions[i]);
  };

  const commitEditInclusion = () => {
    if (editingInclusionIdx === null) return;
    const val = editingInclusionVal.trim();
    if (val) {
      setTemplate((t) => {
        const inc = [...t.inclusions];
        inc[editingInclusionIdx] = val;
        return { ...t, inclusions: inc };
      });
    }
    setEditingInclusionIdx(null);
  };

  // ── Base proteins helpers ───────────────────────────────────────────────────
  const addBaseProtein = () => {
    const label = newProteinLabel.trim();
    if (!label) return;
    const protein = `protein-${Date.now()}`;
    setTemplate((t) => ({ ...t, baseProteins: [...t.baseProteins, { protein, label, enabled: true }] }));
    setNewProteinLabel('');
  };

  const deleteBaseProtein = (protein: string) =>
    setTemplate((t) => ({ ...t, baseProteins: t.baseProteins.filter((p) => p.protein !== protein) }));

  // ── Upgrades helpers ────────────────────────────────────────────────────────
  const addUpgrade = () => {
    const label = newUpgradeLabel.trim();
    if (!label) return;
    const protein = `upgrade-${Date.now()}`;
    const pricePerPerson = parseFloat(newUpgradePrice) || 0;
    const costPerPerson = parseFloat(newUpgradeCost) || 0;
    setTemplate((t) => ({ ...t, upgrades: [...t.upgrades, { protein, label, pricePerPerson, costPerPerson, enabled: true }] }));
    setNewUpgradeLabel('');
    setNewUpgradePrice('5');
    setNewUpgradeCost('3');
  };

  const deleteUpgrade = (protein: string) =>
    setTemplate((t) => ({ ...t, upgrades: t.upgrades.filter((u) => u.protein !== protein) }));

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Configure your standard private dinner menu. This template is used when assigning menus to bookings.
        </p>
        <button
          onClick={handleSave}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          {saved ? '✓ Saved' : 'Save Template'}
        </button>
      </div>

      {/* Standard Inclusions */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Standard Inclusions</h2>
        <p className="mb-4 text-xs text-text-muted">What every guest receives as part of the base price.</p>
        <ul className="mb-4 space-y-2">
          {template.inclusions.map((item, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm">
              {editingInclusionIdx === i ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editingInclusionVal}
                    onChange={(e) => setEditingInclusionVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEditInclusion(); if (e.key === 'Escape') setEditingInclusionIdx(null); }}
                    className="flex-1 rounded border border-border bg-card px-2 py-0.5 text-sm text-text-primary"
                  />
                  <button onClick={commitEditInclusion} className="text-xs font-medium text-accent hover:underline">Save</button>
                  <button onClick={() => setEditingInclusionIdx(null)} className="text-xs text-text-muted hover:text-text-secondary">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-text-primary">{item}</span>
                  <button onClick={() => startEditInclusion(i)} className="text-xs text-text-muted hover:text-accent" title="Edit">✎</button>
                  <button onClick={() => setTemplate((t) => ({ ...t, inclusions: t.inclusions.filter((_, idx) => idx !== i) }))} className="text-text-muted hover:text-danger" title="Remove">✕</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={newInclusion}
            onChange={(e) => setNewInclusion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInclusion())}
            placeholder="e.g. Miso Soup"
            className="flex-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
          />
          <button
            onClick={addInclusion}
            disabled={!newInclusion.trim()}
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-secondary hover:bg-card hover:text-text-primary disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Base Proteins */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Base Proteins</h2>
        <p className="mb-4 text-xs text-text-muted">Guests choose 2. Included in the base per-guest price.</p>
        <div className="mb-3 space-y-2">
          {template.baseProteins.map((p, i) => (
            <div key={p.protein} className="flex items-center gap-3 rounded-md border border-border bg-card-elevated px-3 py-2">
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) =>
                  setTemplate((t) => {
                    const bp = [...t.baseProteins];
                    bp[i] = { ...bp[i], enabled: e.target.checked };
                    return { ...t, baseProteins: bp };
                  })
                }
                className="h-4 w-4 accent-accent"
              />
              <input
                type="text"
                value={p.label}
                onChange={(e) =>
                  setTemplate((t) => {
                    const bp = [...t.baseProteins];
                    bp[i] = { ...bp[i], label: e.target.value };
                    return { ...t, baseProteins: bp };
                  })
                }
                className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm text-text-primary"
              />
              <span className="text-xs text-text-muted">{p.enabled ? 'Enabled' : 'Disabled'}</span>
              <button onClick={() => deleteBaseProtein(p.protein)} className="text-text-muted hover:text-danger" title="Remove">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newProteinLabel}
            onChange={(e) => setNewProteinLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBaseProtein())}
            placeholder="e.g. Salmon"
            className="flex-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
          />
          <button
            onClick={addBaseProtein}
            disabled={!newProteinLabel.trim()}
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-secondary hover:bg-card hover:text-text-primary disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Upgrade Add-ons */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Upgrade Add-ons</h2>
        <p className="mb-4 text-xs text-text-muted">Optional per-person upgrades guests can select on top of their 2 base proteins.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left font-medium text-text-secondary">Label</th>
                <th className="pb-2 text-right font-medium text-text-secondary">Price / person</th>
                <th className="pb-2 text-right font-medium text-text-secondary">Cost / person</th>
                <th className="pb-2 text-center font-medium text-text-secondary">Enabled</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {template.upgrades.map((u, i) => (
                <tr key={u.protein}>
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={u.label}
                      onChange={(e) =>
                        setTemplate((t) => {
                          const up = [...t.upgrades];
                          up[i] = { ...up[i], label: e.target.value };
                          return { ...t, upgrades: up };
                        })
                      }
                      className="w-full rounded border border-border bg-card-elevated px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-text-muted">$</span>
                      <input
                        type="number" min="0" step="0.50"
                        value={u.pricePerPerson}
                        onChange={(e) =>
                          setTemplate((t) => {
                            const up = [...t.upgrades];
                            up[i] = { ...up[i], pricePerPerson: parseFloat(e.target.value) || 0 };
                            return { ...t, upgrades: up };
                          })
                        }
                        className="w-20 rounded border border-border bg-card-elevated px-2 py-1 text-right text-text-primary"
                      />
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-text-muted">$</span>
                      <input
                        type="number" min="0" step="0.50"
                        value={u.costPerPerson}
                        onChange={(e) =>
                          setTemplate((t) => {
                            const up = [...t.upgrades];
                            up[i] = { ...up[i], costPerPerson: parseFloat(e.target.value) || 0 };
                            return { ...t, upgrades: up };
                          })
                        }
                        className="w-20 rounded border border-border bg-card-elevated px-2 py-1 text-right text-text-primary"
                      />
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-center">
                    <input
                      type="checkbox"
                      checked={u.enabled}
                      onChange={(e) =>
                        setTemplate((t) => {
                          const up = [...t.upgrades];
                          up[i] = { ...up[i], enabled: e.target.checked };
                          return { ...t, upgrades: up };
                        })
                      }
                      className="h-4 w-4 accent-accent"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => deleteUpgrade(u.protein)} className="text-text-muted hover:text-danger" title="Remove">✕</button>
                  </td>
                </tr>
              ))}
              {/* Add row */}
              <tr className="border-t border-border bg-card-elevated/50">
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={newUpgradeLabel}
                    onChange={(e) => setNewUpgradeLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUpgrade())}
                    placeholder="e.g. Lobster"
                    className="w-full rounded border border-border bg-card px-2 py-1 text-text-primary placeholder:text-text-muted"
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-text-muted">$</span>
                    <input
                      type="number" min="0" step="0.50"
                      value={newUpgradePrice}
                      onChange={(e) => setNewUpgradePrice(e.target.value)}
                      className="w-20 rounded border border-border bg-card px-2 py-1 text-right text-text-primary"
                    />
                  </div>
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-text-muted">$</span>
                    <input
                      type="number" min="0" step="0.50"
                      value={newUpgradeCost}
                      onChange={(e) => setNewUpgradeCost(e.target.value)}
                      className="w-20 rounded border border-border bg-card px-2 py-1 text-right text-text-primary"
                    />
                  </div>
                </td>
                <td className="py-2 pr-3 text-center text-xs text-text-muted">enabled</td>
                <td className="py-2 text-center">
                  <button
                    onClick={addUpgrade}
                    disabled={!newUpgradeLabel.trim()}
                    className="rounded border border-border bg-card-elevated px-2 py-1 text-xs text-text-secondary hover:bg-card hover:text-text-primary disabled:opacity-40"
                  >
                    + Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Item Catalog Tab — two-panel (category tree + item list + detail) ───────

function ItemCatalogTab() {
  // ── Menu items ────────────────────────────────────────────────────────────
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // ── Category tree ─────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<MenuCategoryNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(['cat-proteins', 'cat-sides', 'cat-appetizers'])
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ── Item detail panel ─────────────────────────────────────────────────────
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null); // '__new__' for unsaved
  const [editDraft, setEditDraft] = useState<MenuItem | null>(null);
  const [detailTab, setDetailTab] = useState<'description' | 'instructions' | 'notes' | 'label'>('description');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setCategories(loadMenuCategories());

    const defaultById = new Map(DEFAULT_MENU_ITEMS.map((i) => [i.id, i]));
    const raw = localStorage.getItem('menuItems');
    let items: MenuItem[];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MenuItem[];
        items = parsed.map((item) => {
          const fallback = defaultById.get(item.id);
          return {
            ...item,
            costPerServing: Number.isFinite(item.costPerServing) ? item.costPerServing : 0,
            pricePerServing: Number.isFinite(item.pricePerServing)
              ? item.pricePerServing
              : fallback?.pricePerServing ?? 0,
            // One-time legacy migration: assign categoryId from flat category if missing
            categoryId: item.categoryId ?? LEGACY_CATEGORY_MAP[item.category] ?? undefined,
          };
        });
      } catch {
        items = DEFAULT_MENU_ITEMS.map((i) => ({ ...i, categoryId: LEGACY_CATEGORY_MAP[i.category] }));
      }
    } else {
      items = DEFAULT_MENU_ITEMS.map((i) => ({ ...i, categoryId: LEGACY_CATEGORY_MAP[i.category] }));
    }
    setMenuItems(items);
    localStorage.setItem('menuItems', JSON.stringify(items));
  }, []);

  // Listen for external "open new item" event (shell header button)
  useEffect(() => {
    const handler = () => openNewItem();
    window.addEventListener('openNewMenuItemModal', handler);
    return () => window.removeEventListener('openNewMenuItemModal', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const saveMenuItems = (items: MenuItem[]) => {
    setMenuItems(items);
    localStorage.setItem('menuItems', JSON.stringify(items));
    window.dispatchEvent(new Event('menuItemsUpdated'));
  };

  const filteredItems = useMemo(() => {
    let result = menuItems;
    if (selectedCategoryId) {
      const descendants = new Set(getDescendantIds(categories, selectedCategoryId));
      result = result.filter(
        (i) => i.categoryId === selectedCategoryId || descendants.has(i.categoryId ?? '')
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [menuItems, selectedCategoryId, categories, searchQuery]);

  function countInCategory(catId: string): number {
    const descendants = new Set(getDescendantIds(categories, catId));
    return menuItems.filter(
      (i) => i.categoryId === catId || descendants.has(i.categoryId ?? '')
    ).length;
  }

  // ── Item detail actions ───────────────────────────────────────────────────
  function openNewItem() {
    const blank: MenuItem = {
      id: `menu-${Date.now()}`,
      name: '',
      category: 'protein',
      categoryId: selectedCategoryId ?? undefined,
      description: '',
      pricePerServing: 0,
      costPerServing: 0,
      isAvailable: true,
    };
    setEditDraft(blank);
    setSelectedItemId('__new__');
    setDetailTab('description');
  }

  function selectItem(item: MenuItem) {
    setEditDraft({ ...item });
    setSelectedItemId(item.id);
    setDetailTab('description');
  }

  function handleSaveItem() {
    if (!editDraft || !editDraft.name.trim()) return;
    if (selectedItemId === '__new__') {
      saveMenuItems([...menuItems, editDraft]);
      setSelectedItemId(editDraft.id);
    } else {
      saveMenuItems(menuItems.map((i) => (i.id === editDraft.id ? editDraft : i)));
    }
  }

  function handleDeleteItem() {
    if (!editDraft || selectedItemId === '__new__') return;
    if (!confirm(`Delete "${editDraft.name}"?`)) return;
    saveMenuItems(menuItems.filter((i) => i.id !== editDraft.id));
    setSelectedItemId(null);
    setEditDraft(null);
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editDraft) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditDraft((d) => (d ? { ...d, photoBase64: reader.result as string } : d));
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }

  // ── Category tree actions ─────────────────────────────────────────────────
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const roots = getRoots(categories);
    const node: MenuCategoryNode = {
      id: `cat-${Date.now()}`,
      name,
      parentId: undefined,
      sortOrder: roots.length,
    };
    const next = [...categories, node];
    setCategories(next);
    saveMenuCategories(next);
    setNewCategoryName('');
    setAddingCategory(false);
  }

  function handleDeleteCategory(id: string) {
    const count = countInCategory(id);
    if (count > 0) {
      alert(`Cannot delete: ${count} item(s) are in this category. Reassign them first.`);
      return;
    }
    const descendants = getDescendantIds(categories, id);
    const toRemove = new Set([id, ...descendants]);
    const next = categories.filter((c) => !toRemove.has(c.id));
    setCategories(next);
    saveMenuCategories(next);
    if (selectedCategoryId && toRemove.has(selectedCategoryId)) setSelectedCategoryId(null);
  }

  // ── Category tree renderer ────────────────────────────────────────────────
  function renderNode(node: MenuCategoryNode, depth: number): React.ReactNode {
    const children = getChildren(categories, node.id);
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedCategoryId === node.id;
    const count = countInCategory(node.id);

    return (
      <div key={node.id}>
        <div
          className={`group flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-sm transition-colors ${
            isSelected
              ? 'bg-accent/10 text-accent font-medium'
              : 'text-text-secondary hover:bg-card-elevated hover:text-text-primary'
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => setSelectedCategoryId(node.id)}
        >
          <button
            className={`flex h-4 w-4 shrink-0 items-center justify-center text-[10px] ${
              children.length > 0 ? 'text-text-muted hover:text-text-primary' : 'invisible'
            }`}
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
          <span className="flex-1 truncate">{node.name}</span>
          {count > 0 && <span className="text-xs text-text-muted">{count}</span>}
          <button
            className="invisible ml-1 shrink-0 text-[10px] text-text-muted hover:text-danger group-hover:visible"
            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(node.id); }}
            title="Delete category"
          >
            ✕
          </button>
        </div>
        {isExpanded && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[640px] overflow-hidden rounded-xl border border-border bg-card">
      {/* LEFT: Category Tree */}
      <div className="flex w-52 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Categories</p>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {/* All Items */}
          <div
            className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              !selectedCategoryId
                ? 'bg-accent/10 font-medium text-accent'
                : 'text-text-secondary hover:bg-card-elevated'
            }`}
            onClick={() => setSelectedCategoryId(null)}
          >
            <span className="flex-1">All Items</span>
            <span className="text-xs text-text-muted">{menuItems.length}</span>
          </div>
          {getRoots(categories).map((n) => renderNode(n, 0))}
        </div>
        {/* Add category */}
        <div className="border-t border-border p-2">
          {addingCategory ? (
            <div className="flex gap-1">
              <input
                autoFocus
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategory();
                  if (e.key === 'Escape') setAddingCategory(false);
                }}
                placeholder="Category name"
                className="flex-1 rounded border border-border bg-card-elevated px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
              />
              <button onClick={handleAddCategory} className="text-xs text-accent hover:underline">
                Add
              </button>
              <button onClick={() => setAddingCategory(false)} className="text-xs text-text-muted">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAddingCategory(true); setNewCategoryName(''); }}
              className="w-full rounded-md bg-card-elevated px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-border hover:text-text-primary"
            >
              + Add Category
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Item list + detail */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border p-3">
          <input
            type="text"
            placeholder="Search items…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-card-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            onClick={openNewItem}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            + New Item
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
              <p className="text-sm">
                {searchQuery ? 'No items match your search.' : 'No items in this category.'}
              </p>
              <button onClick={openNewItem} className="text-sm text-accent hover:underline">
                + Add an item
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card-elevated">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Name
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted sm:table-cell">
                    Category
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Price
                  </th>
                  <th className="hidden px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted sm:table-cell">
                    Cost
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Avail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent/5' : 'hover:bg-card-elevated/50'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {item.photoBase64 && (
                            <img
                              src={item.photoBase64}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded object-cover"
                            />
                          )}
                          <div>
                            <span
                              className={`font-medium ${
                                isSelected ? 'text-accent' : 'text-text-primary'
                              }`}
                            >
                              {item.name || '(unnamed)'}
                            </span>
                            {item.tags && item.tags.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className={`rounded-full px-1.5 py-0 text-[10px] font-medium ${
                                      tag === 'hibachi'
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                        : tag === 'standard'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 text-text-muted sm:table-cell">
                        {item.categoryId
                          ? getCategoryName(categories, item.categoryId)
                          : categoryLabels[item.category]}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-text-primary">
                        {formatCurrency(item.pricePerServing)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right text-text-muted sm:table-cell">
                        {formatCurrency(item.costPerServing)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.isAvailable
                              ? 'bg-success/10 text-success'
                              : 'bg-card-elevated text-text-muted'
                          }`}
                        >
                          {item.isAvailable ? '✓' : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Item detail panel */}
        {editDraft && (
          <div className="flex flex-col border-t-2 border-accent/30 bg-card-elevated" style={{ minHeight: '300px' }}>
            {/* Detail header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <p className="flex-1 truncate text-sm font-semibold text-text-primary">
                {selectedItemId === '__new__' ? 'New Item' : editDraft.name || 'Item Detail'}
              </p>
              <button
                onClick={() => { setSelectedItemId(null); setEditDraft(null); }}
                className="text-lg leading-none text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Form fields */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Name + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Name *</label>
                    <input
                      type="text"
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, name: e.target.value } : d)}
                      placeholder="Item name"
                      className="w-full rounded border border-border bg-card px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Category</label>
                    <select
                      value={editDraft.categoryId ?? ''}
                      onChange={(e) =>
                        setEditDraft((d) => d ? { ...d, categoryId: e.target.value || undefined } : d)
                      }
                      className="w-full rounded border border-border bg-card px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                    >
                      <option value="">— Select —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parentId ? `  ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price + Cost + Unit */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Price / serving</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-text-muted">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editDraft.pricePerServing}
                        onChange={(e) =>
                          setEditDraft((d) => d ? { ...d, pricePerServing: parseFloat(e.target.value) || 0 } : d)
                        }
                        className="w-full rounded border border-border bg-card py-1.5 pl-6 pr-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Cost / serving</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-text-muted">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editDraft.costPerServing}
                        onChange={(e) =>
                          setEditDraft((d) => d ? { ...d, costPerServing: parseFloat(e.target.value) || 0 } : d)
                        }
                        className="w-full rounded border border-border bg-card py-1.5 pl-6 pr-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Unit</label>
                    <select
                      value={editDraft.unit ?? 'per person'}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, unit: e.target.value } : d)}
                      className="w-full rounded border border-border bg-card px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                    >
                      <option>per person</option>
                      <option>per tray</option>
                      <option>per piece</option>
                      <option>per dozen</option>
                      <option>per gallon</option>
                      <option>other</option>
                    </select>
                  </div>
                </div>

                {/* Description / Instructions / Notes / Label tabs */}
                <div>
                  <div className="flex gap-0 border-b border-border">
                    {(['description', 'instructions', 'notes', 'label'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                          detailTab === tab
                            ? 'border-accent text-accent'
                            : 'border-transparent text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={
                      detailTab === 'description' ? (editDraft.description ?? '') :
                      detailTab === 'instructions' ? (editDraft.instructions ?? '') :
                      detailTab === 'notes' ? (editDraft.notes ?? '') :
                      (editDraft.label ?? '')
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditDraft((d) =>
                        d ? {
                          ...d,
                          ...(detailTab === 'description' ? { description: val } :
                              detailTab === 'instructions' ? { instructions: val } :
                              detailTab === 'notes' ? { notes: val } :
                              { label: val }),
                        } : d
                      );
                    }}
                    rows={3}
                    placeholder={
                      detailTab === 'description' ? 'Item description for menus and proposals…' :
                      detailTab === 'instructions' ? 'Kitchen prep instructions…' :
                      detailTab === 'notes' ? 'Internal notes (not shown to customers)…' :
                      'Short label for display (e.g. menus, order tickets)…'
                    }
                    className="mt-2 w-full resize-none rounded border border-border bg-card px-2.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>

                {/* Dietary + Allergens */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Dietary tags</label>
                    <input
                      type="text"
                      value={editDraft.dietaryTags?.join(', ') ?? ''}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d ? { ...d, dietaryTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : d
                        )
                      }
                      placeholder="vegetarian, gluten-free"
                      className="w-full rounded border border-border bg-card px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Allergens</label>
                    <input
                      type="text"
                      value={editDraft.allergens?.join(', ') ?? ''}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d ? { ...d, allergens: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : d
                        )
                      }
                      placeholder="shellfish, nuts"
                      className="w-full rounded border border-border bg-card px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-text-muted">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['hibachi', 'standard', 'custom'] as const).map((tag) => {
                      const active = editDraft.tags?.includes(tag) ?? false;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setEditDraft((d) => {
                              if (!d) return d;
                              const current = d.tags ?? [];
                              return {
                                ...d,
                                tags: active
                                  ? current.filter((t) => t !== tag)
                                  : [...current, tag],
                              };
                            })
                          }
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            active
                              ? tag === 'hibachi'
                                ? 'bg-orange-500/15 text-orange-700 ring-1 ring-orange-300 dark:text-orange-400 dark:ring-orange-700'
                                : tag === 'standard'
                                ? 'bg-blue-500/15 text-blue-700 ring-1 ring-blue-300 dark:text-blue-400 dark:ring-blue-700'
                                : 'bg-purple-500/15 text-purple-700 ring-1 ring-purple-300 dark:text-purple-400 dark:ring-purple-700'
                              : 'bg-card-elevated text-text-muted hover:bg-border hover:text-text-secondary'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Available */}
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editDraft.isAvailable}
                    onChange={(e) => setEditDraft((d) => d ? { ...d, isAvailable: e.target.checked } : d)}
                    className="h-4 w-4 rounded border-border text-accent"
                  />
                  <span className="text-sm text-text-secondary">Available for selection</span>
                </label>
              </div>

              {/* Photo + actions sidebar */}
              <div className="flex w-44 shrink-0 flex-col gap-3 border-l border-border p-4">
                <p className="text-xs font-medium text-text-muted">Photo</p>
                {editDraft.photoBase64 ? (
                  <div className="space-y-2">
                    <img
                      src={editDraft.photoBase64}
                      alt="Item"
                      className="h-28 w-full rounded-lg object-cover"
                    />
                    <button
                      onClick={() => setEditDraft((d) => d ? { ...d, photoBase64: undefined } : d)}
                      className="w-full text-xs text-danger hover:underline"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-center">
                    <p className="text-xs text-text-muted">No photo</p>
                    <label className="cursor-pointer rounded-md bg-card px-2 py-1 text-xs font-medium text-text-secondary hover:bg-border">
                      Upload
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>
                )}

                <div className="mt-auto space-y-2">
                  <button
                    onClick={handleSaveItem}
                    disabled={!editDraft.name.trim()}
                    className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
                  >
                    Save
                  </button>
                  {selectedItemId !== '__new__' && (
                    <button
                      onClick={handleDeleteItem}
                      className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/5"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Page Shell (exported for use in Settings) ─────────────────────────────────

export function MenuSettingsContent() {
  const searchParams = useSearchParams();
  const subtabFromUrl = searchParams.get('subtab') === 'catalog' ? 'catalog' : 'template';
  const [activeTab, setActiveTab] = useState<'template' | 'catalog'>(subtabFromUrl);
  const router = useRouter();

  useEffect(() => {
    setActiveTab(subtabFromUrl);
  }, [subtabFromUrl]);

  const setTab = (tab: 'template' | 'catalog') => {
    setActiveTab(tab);
    router.replace(`/menus?subtab=${tab}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          Configure your private dinner menu template, item catalog, and shopping list presets.
        </p>
        {activeTab === 'catalog' && (
          <button
            onClick={() => window.dispatchEvent(new Event('openNewMenuItemModal'))}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            + New Menu Item
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card-elevated p-1 w-fit">
        <button
          onClick={() => setTab('template')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'template' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Menu Template
        </button>
        <button
          onClick={() => setTab('catalog')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'catalog' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Item Catalog
        </button>
      </div>

      {activeTab === 'template' ? <MenuTemplateTab /> : <ItemCatalogTab />}
    </div>
  );
}

function MenusContent() {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Menu Settings</h1>
          <Link
            href="/"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            ← Dashboard
          </Link>
        </div>
        <MenuSettingsContent />
      </div>
    </div>
  );
}


export default function MenusPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-muted">Loading…</p></div>}>
      <MenusContent />
    </Suspense>
  );
}
