'use client';

import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import type { BookingFormData } from './bookingFormTypes';

interface ContactTabProps {
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  saveError: string | null;
  onSave: (e: React.FormEvent) => void;
}

export function ContactTab({ formData, setFormData, saveError, onSave }: ContactTabProps) {
  return (
    <form onSubmit={onSave} className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <h2 className="text-lg font-semibold text-text-primary">Customer information</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary">Customer name *</label>
          <input
            type="text"
            required
            value={formData.customerName}
            onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Email *</label>
          <input
            type="email"
            required
            value={formData.customerEmail}
            onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Phone *</label>
          <input
            type="tel"
            value={formData.customerPhone}
            onChange={(e) => setFormData((p) => ({ ...p, customerPhone: formatPhone(e.target.value) }))}
            placeholder="(xxx)-xxx-xxxx"
            className={`mt-1 w-full rounded-md border px-3 py-2 text-text-primary ${
              formData.customerPhone && !isValidPhone(formData.customerPhone)
                ? 'border-danger'
                : 'border-border bg-card'
            }`}
          />
          {formData.customerPhone && !isValidPhone(formData.customerPhone) && (
            <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text-secondary">Event address *</label>
          <input
            type="text"
            required
            value={formData.location}
            onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
      </div>
      {saveError && <p className="text-sm text-danger">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onSave(e as unknown as React.FormEvent);
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Save Contact
        </button>
      </div>
    </form>
  );
}
