'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/moneyRules';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import { getBookingServiceStatus } from '@/lib/bookingWorkflow';
import { useCustomers, normalizeCustomerId } from '@/lib/useCustomers';
import type { CustomerId, DerivedCustomer } from '@/lib/customerTypes';
import { CUSTOMER_TAGS, TAG_COLORS } from '@/lib/customerTypes';
import type { BookingPrefill } from '@/lib/customerTypes';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_COLORS[status] ?? 'bg-card-elevated text-text-secondary'
      }`}
    >
      {status}
    </span>
  );
}

// ─── Customer list row ────────────────────────────────────────────────────────

function CustomerRow({
  customer,
  selected,
  onClick,
}: {
  customer: DerivedCustomer;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-card-elevated ${
        selected ? 'border-l-2 border-l-accent bg-accent/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{customer.name}</p>
          <p className="truncate text-xs text-text-muted">
            {customer.phone || customer.email || 'No contact info'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-medium text-text-primary">
            {formatCurrency(customer.totalRevenue)}
          </span>
          <span className="text-xs text-text-muted">
            {customer.bookingCount} {customer.bookingCount === 1 ? 'event' : 'events'}
          </span>
        </div>
      </div>
      {customer.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {customer.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLORS[tag]}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();
  const { customers, updateProfileMeta } = useCustomers();

  const [selectedId, setSelectedId] = useState<CustomerId | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'revenue' | 'bookings' | 'name'>('recent');
  const [localNotes, setLocalNotes] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [localEmail, setLocalEmail] = useState('');
  const notesCustomerRef = useRef<CustomerId | null>(null);

  // New customer modal
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNameError, setNewNameError] = useState(false);

  // Auto-select first customer on initial load
  useEffect(() => {
    if (customers.length > 0 && selectedId === null) {
      setSelectedId(customers[0].id);
    }
  }, [customers, selectedId]);

  // Sync localNotes when selected customer changes
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedId) ?? null,
    [customers, selectedId]
  );

  useEffect(() => {
    if (selectedCustomer && notesCustomerRef.current !== selectedCustomer.id) {
      setLocalNotes(selectedCustomer.notes);
      setLocalPhone(selectedCustomer.phone);
      setLocalEmail(selectedCustomer.email);
      notesCustomerRef.current = selectedCustomer.id;
    }
  }, [selectedCustomer]);

  // Debounce search so the filter useMemo doesn't run on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  // Filtered + sorted customer list
  const displayedCustomers = useMemo(() => {
    let list = customers;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'name':
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'revenue':
        return [...list].sort((a, b) => b.totalRevenue - a.totalRevenue);
      case 'bookings':
        return [...list].sort((a, b) => b.bookingCount - a.bookingCount);
      case 'recent':
      default:
        return [...list].sort((a, b) =>
          (b.lastEventDate ?? '').localeCompare(a.lastEventDate ?? '')
        );
    }
  }, [customers, debouncedSearch, sortBy]);

  const handleTagToggle = (customerId: CustomerId, tag: (typeof CUSTOMER_TAGS)[number]) => {
    const current = customers.find((c) => c.id === customerId)?.tags ?? [];
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    updateProfileMeta(customerId, { tags: updated });
  };

  const handleNotesSave = () => {
    if (selectedId && localNotes !== (selectedCustomer?.notes ?? '')) {
      updateProfileMeta(selectedId, { notes: localNotes });
    }
  };

  const handleContactSave = () => {
    if (!selectedId || !selectedCustomer) return;
    const existingMeta = { phone: selectedCustomer.phone, email: selectedCustomer.email };
    const phoneChanged = localPhone !== existingMeta.phone;
    const emailChanged = localEmail !== existingMeta.email;
    if (phoneChanged || emailChanged) {
      updateProfileMeta(selectedId, {
        contactOverrides: { phone: localPhone || undefined, email: localEmail || undefined },
      });
    }
  };

  const openNewCustomerModal = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewNameError(false);
    setShowNewCustomerModal(true);
  };

  const handleCreateCustomer = () => {
    if (!newName.trim()) { setNewNameError(true); return; }
    const id = normalizeCustomerId(newPhone, newEmail);
    updateProfileMeta(id, {
      isStub: true,
      stubName: newName.trim(),
      contactOverrides: {
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
      },
    });
    setShowNewCustomerModal(false);
    setSelectedId(id);
  };

  const handleBookAgain = (customer: DerivedCustomer) => {
    const prefill: BookingPrefill = {
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
    };
    sessionStorage.setItem('bookingPrefill', JSON.stringify(prefill));
    router.push('/bookings');
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-6">
        <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {customers.length} {customers.length === 1 ? 'customer' : 'customers'} from booking history
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel ── */}
        <div className={`shrink-0 flex-col border-r border-border w-full md:w-72 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
          {/* Search + New Customer */}
          <div className="space-y-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <button
                type="button"
                onClick={openNewCustomerModal}
                title="New Customer"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-text-secondary transition-colors hover:bg-accent hover:text-white"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="recent">Sort: Most Recent</option>
              <option value="revenue">Sort: Most Revenue</option>
              <option value="bookings">Sort: Most Bookings</option>
              <option value="name">Sort: Name A–Z</option>
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {displayedCustomers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                {search ? 'No customers match your search.' : 'No customers yet. Create a booking to get started.'}
              </div>
            ) : (
              displayedCustomers.map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  selected={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className={`flex-1 overflow-y-auto ${selectedId ? 'flex flex-col' : 'hidden md:block'}`}>
          {!selectedCustomer ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <UserGroupIcon className="h-12 w-12 opacity-30" />
              <p className="text-sm">Select a customer to view details</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6 p-6">
              {/* Mobile back button */}
              <button
                onClick={() => setSelectedId(null)}
                className="mb-2 flex items-center gap-1 text-sm font-medium text-accent md:hidden"
              >
                ← Back to list
              </button>
              {/* Identity header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-base font-semibold text-accent">
                    {getInitials(selectedCustomer.name)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">{selectedCustomer.name}</h2>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-text-secondary">
                      {selectedCustomer.phone && (
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="h-3.5 w-3.5" />
                          {selectedCustomer.phone}
                        </span>
                      )}
                      {selectedCustomer.email && (
                        <span className="flex items-center gap-1">
                          <EnvelopeIcon className="h-3.5 w-3.5" />
                          {selectedCustomer.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleBookAgain(selectedCustomer)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
                >
                  <CalendarDaysIcon className="h-4 w-4" />
                  Book Again
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-text-muted">Total Revenue</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {formatCurrency(selectedCustomer.totalRevenue)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatCurrency(selectedCustomer.totalPaid)} paid
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-text-muted">Total Bookings</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {selectedCustomer.bookingCount}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(selectedCustomer.firstEventDate)} first
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-text-muted">Completed</p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {selectedCustomer.completedCount}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(selectedCustomer.lastEventDate)} last
                  </p>
                </div>
              </div>

              {/* Contact info */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="mb-3 text-sm font-medium text-text-secondary">Contact Info</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs text-text-muted">
                      <PhoneIcon className="h-3.5 w-3.5" />
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={localPhone}
                      onChange={(e) => setLocalPhone(formatPhone(e.target.value))}
                      onBlur={handleContactSave}
                      placeholder="(xxx)-xxx-xxxx"
                      className={`w-full rounded-md border bg-card-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent ${
                        localPhone && !isValidPhone(localPhone) ? 'border-danger' : 'border-border'
                      }`}
                    />
                    {localPhone && !isValidPhone(localPhone) && (
                      <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs text-text-muted">
                      <EnvelopeIcon className="h-3.5 w-3.5" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={localEmail}
                      onChange={(e) => setLocalEmail(e.target.value)}
                      onBlur={handleContactSave}
                      placeholder="Email address"
                      className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-text-muted">Overrides contact info from bookings. Saved when you click away.</p>
              </div>

              {/* Tags */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="mb-3 text-sm font-medium text-text-secondary">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOMER_TAGS.map((tag) => {
                    const active = selectedCustomer.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(selectedCustomer.id, tag)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                          active
                            ? `${TAG_COLORS[tag]} ring-2 ring-current ring-offset-1`
                            : 'bg-card-elevated text-text-secondary hover:bg-card-elevated/80'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="mb-2 text-sm font-medium text-text-secondary">Notes</p>
                <textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={handleNotesSave}
                  rows={3}
                  placeholder="Add notes about this customer…"
                  className="w-full resize-none rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="mt-1 text-xs text-text-muted">Saved automatically when you click away</p>
              </div>

              {/* Booking history */}
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-medium text-text-secondary">Booking History</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Type</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Guests</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Total</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.bookings.map((booking) => (
                        <tr
                          key={booking.id}
                          className="border-b border-border last:border-0 hover:bg-card-elevated"
                        >
                          <td className="px-4 py-3 text-text-primary">
                            {formatDate(booking.eventDate)}
                          </td>
                          <td className="px-4 py-3 capitalize text-text-secondary">
                            {booking.eventType.replace(/-/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {booking.adults + booking.children}
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {formatCurrency(booking.total)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={getBookingServiceStatus(booking)} />
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={`/bookings?bookingId=${booking.id}`}
                              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                            >
                              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                              View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New Customer Modal ── */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-text-primary">New Customer</h2>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="rounded-md p-1 text-text-muted hover:bg-card-elevated"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setNewNameError(false); }}
                  placeholder="Jane Smith"
                  autoFocus
                  className={`w-full rounded-md border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent ${
                    newNameError ? 'border-red-400 bg-red-50' : 'border-border bg-card-elevated'
                  }`}
                />
                {newNameError && (
                  <p className="mt-1 text-xs text-red-500">Name is required.</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Phone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(formatPhone(e.target.value))}
                  placeholder="(xxx)-xxx-xxxx"
                  className={`w-full rounded-md border bg-card-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent ${
                    newPhone && !isValidPhone(newPhone) ? 'border-danger' : 'border-border'
                  }`}
                />
                {newPhone && !isValidPhone(newPhone) && (
                  <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
