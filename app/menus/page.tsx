'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/moneyRules';
import type { MenuItem, MenuCategory } from '@/lib/menuTypes';
import { DEFAULT_MENU_ITEMS } from '@/lib/defaultMenuItems';

const categoryLabels: Record<MenuCategory, string> = {
  protein: 'Proteins',
  side: 'Sides',
  appetizer: 'Appetizers',
  dessert: 'Desserts',
  beverage: 'Beverages',
};

const categoryColors: Record<MenuCategory, string> = {
  protein: 'bg-red-100 text-red-800',
  side: 'bg-yellow-100 text-yellow-800',
  appetizer: 'bg-green-100 text-green-800',
  dessert: 'bg-pink-100 text-pink-800',
  beverage: 'bg-blue-100 text-blue-800',
};

export default function MenusPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | MenuCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: 'protein' as MenuCategory,
    description: '',
    pricePerServing: '',
    costPerServing: '',
    isAvailable: true,
    dietaryTags: '',
    allergens: '',
  });

  // Load menu items from localStorage
  useEffect(() => {
    const defaultById = new Map(DEFAULT_MENU_ITEMS.map((item) => [item.id, item]));
    const normalizeMenuItem = (item: MenuItem): MenuItem => {
      const fallback = defaultById.get(item.id);
      const normalizedCost = Number.isFinite(item.costPerServing) ? item.costPerServing : 0;
      const hasPrice = Number.isFinite(item.pricePerServing);
      const normalizedPrice = hasPrice
        ? (item.pricePerServing as number)
        : fallback?.pricePerServing ?? Math.max(0, normalizedCost * 3);

      return {
        ...item,
        costPerServing: normalizedCost,
        pricePerServing: normalizedPrice,
      };
    };

    const saved = localStorage.getItem('menuItems');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MenuItem[];
        const normalized = parsed.map(normalizeMenuItem);
        setMenuItems(normalized);
        localStorage.setItem('menuItems', JSON.stringify(normalized));
      } catch (e) {
        console.error('Failed to load menu items:', e);
      }
    } else {
      setMenuItems(DEFAULT_MENU_ITEMS);
      localStorage.setItem('menuItems', JSON.stringify(DEFAULT_MENU_ITEMS));
    }
  }, []);

  const saveMenuItems = (items: MenuItem[]) => {
    setMenuItems(items);
    localStorage.setItem('menuItems', JSON.stringify(items));
    window.dispatchEvent(new Event('menuItemsUpdated'));
  };

  const filteredItems = useMemo(() => {
    let result = menuItems;

    if (filterCategory !== 'all') {
      result = result.filter((item) => item.category === filterCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    return result;
  }, [menuItems, filterCategory, searchQuery]);

  const stats = useMemo(() => {
    const byCategory: Record<MenuCategory, number> = {
      protein: 0,
      side: 0,
      appetizer: 0,
      dessert: 0,
      beverage: 0,
    };

    menuItems.forEach((item) => {
      byCategory[item.category]++;
    });

    return {
      total: menuItems.length,
      available: menuItems.filter((i) => i.isAvailable).length,
      byCategory,
    };
  }, [menuItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const item: MenuItem = {
      id: editingItem?.id || `menu-${Date.now()}`,
      name: formData.name,
      category: formData.category,
      description: formData.description,
      pricePerServing: parseFloat(formData.pricePerServing) || 0,
      costPerServing: parseFloat(formData.costPerServing) || 0,
      isAvailable: formData.isAvailable,
      dietaryTags: formData.dietaryTags ? formData.dietaryTags.split(',').map((t) => t.trim()) : [],
      allergens: formData.allergens ? formData.allergens.split(',').map((a) => a.trim()) : [],
    };

    if (editingItem) {
      saveMenuItems(menuItems.map((i) => (i.id === editingItem.id ? item : i)));
    } else {
      saveMenuItems([...menuItems, item]);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'protein',
      description: '',
      pricePerServing: '',
      costPerServing: '',
      isAvailable: true,
      dietaryTags: '',
      allergens: '',
    });
    setEditingItem(null);
    setShowModal(false);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description,
      pricePerServing: item.pricePerServing.toString(),
      costPerServing: item.costPerServing.toString(),
      isAvailable: item.isAvailable,
      dietaryTags: item.dietaryTags?.join(', ') || '',
      allergens: item.allergens?.join(', ') || '',
    });
    setShowModal(true);
  };

  const handleDelete = () => {
    if (editingItem && confirm(`Delete menu item "${editingItem.name}"?`)) {
      saveMenuItems(menuItems.filter((i) => i.id !== editingItem.id));
      resetForm();
    }
  };

  const toggleAvailability = (item: MenuItem) => {
    saveMenuItems(
      menuItems.map((i) =>
        i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i
      )
    );
  };

  return (
    <div className="h-full p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            Menu Management
          </h1>
          <p className="mt-2 text-text-secondary">
            Manage menu items, pricing, and availability
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          + New Menu Item
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/20">
          <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            Total Items
          </h3>
          <p className="mt-2 text-3xl font-bold text-accent dark:text-indigo-400">
            {stats.total}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Available
          </h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.available}
          </p>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
          <h3 className="text-sm font-medium text-red-900 dark:text-red-200">
            Proteins
          </h3>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {stats.byCategory.protein}
          </p>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950/20">
          <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
            Sides
          </h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.byCategory.side}
          </p>
        </div>

        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20">
          <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200">
            Others
          </h3>
          <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
            {stats.byCategory.appetizer + stats.byCategory.dessert + stats.byCategory.beverage}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterCategory('all')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterCategory === 'all'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:bg-card'
            }`}
          >
            All
          </button>
          {(Object.keys(categoryLabels) as MenuCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => setFilterCategory(category)}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                filterCategory === category
                  ? 'bg-accent text-white'
                  : 'bg-card-elevated text-text-secondary hover:bg-card'
              }`}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search menu items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-primary"
        />
      </div>

      {/* Menu Items Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.length === 0 ? (
          <div className="col-span-full rounded-lg border border-border bg-card p-12 text-center  ">
            <p className="text-text-muted">
              {searchQuery || filterCategory !== 'all'
                ? 'No menu items match your filters'
                : 'No menu items yet. Click "+ New Menu Item" to get started!'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card p-6  "
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {item.name}
                  </h3>
                  <span className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-semibold ${categoryColors[item.category]}`}>
                    {categoryLabels[item.category]}
                  </span>
                </div>
                <button
                  onClick={() => toggleAvailability(item)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.isAvailable
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-card-elevated text-text-secondary'
                  }`}
                >
                  {item.isAvailable ? 'Available' : 'Unavailable'}
                </button>
              </div>

              <p className="mb-4 text-sm text-text-secondary">
                {item.description}
              </p>

              <div className="mb-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(item.pricePerServing)} price / serving
              </div>
              <div className="mb-4 text-xs text-text-muted">
                {formatCurrency(item.costPerServing)} cost / serving
              </div>

              {(item.dietaryTags && item.dietaryTags.length > 0) && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {item.dietaryTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {(item.allergens && item.allergens.length > 0) && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {item.allergens.map((allergen, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                    >
                      ⚠️ {allergen}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => handleEdit(item)}
                className="w-full rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                Edit
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6  ">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-text-primary">
                {editingItem ? 'Edit Menu Item' : 'New Menu Item'}
              </h2>
              <button
                onClick={resetForm}
                className="text-text-muted hover:text-text-secondary"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as MenuCategory })
                    }
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  >
                    {(Object.keys(categoryLabels) as MenuCategory[]).map((category) => (
                      <option key={category} value={category}>
                        {categoryLabels[category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Price per Serving *
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2 text-text-muted">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.pricePerServing}
                      onChange={(e) =>
                        setFormData({ ...formData, pricePerServing: e.target.value })
                      }
                      className="w-full rounded-md border border-border bg-card-elevated py-2 pl-7 pr-3 text-text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Cost per Serving *
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2 text-text-muted">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.costPerServing}
                      onChange={(e) =>
                        setFormData({ ...formData, costPerServing: e.target.value })
                      }
                      className="w-full rounded-md border border-border bg-card-elevated py-2 pl-7 pr-3 text-text-primary"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Dietary Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.dietaryTags}
                    onChange={(e) =>
                      setFormData({ ...formData, dietaryTags: e.target.value })
                    }
                    placeholder="vegetarian, vegan, gluten-free"
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Allergens (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.allergens}
                    onChange={(e) =>
                      setFormData({ ...formData, allergens: e.target.value })
                    }
                    placeholder="shellfish, nuts, dairy"
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isAvailable}
                      onChange={(e) =>
                        setFormData({ ...formData, isAvailable: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-text-secondary">
                      Available for selection
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-between">
                <div>
                  {editingItem && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-border bg-card-elevated px-4 py-2 text-text-secondary hover:bg-card"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                  >
                    {editingItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
