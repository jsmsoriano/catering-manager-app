'use client';

import { useEffect, useMemo, useState } from 'react';
import { getQuoteRevisionsByBooking, QUOTE_REVISION_UPDATED_EVENT } from '@/lib/quoteRevisionLog';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function QuoteVersionHistory({ bookingId }: { bookingId: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(QUOTE_REVISION_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(QUOTE_REVISION_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const revisions = useMemo(() => getQuoteRevisionsByBooking(bookingId), [bookingId, tick]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-text-secondary">Quote Version History</p>
      {revisions.length === 0 ? (
        <p className="text-xs text-text-muted">No quote versions logged yet.</p>
      ) : (
        <div className="space-y-2">
          {revisions.map((rev) => (
            <div key={rev.id} className="rounded-md border border-border bg-card-elevated p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-text-primary">
                  v{rev.quoteVersion} {rev.mode === 'revision' ? '(revision)' : '(initial)'}
                </p>
                <p className="text-[11px] text-text-muted">{formatDateTime(rev.sentAt)}</p>
              </div>
              {rev.sentTo && <p className="mt-0.5 text-xs text-text-secondary">Sent to: {rev.sentTo}</p>}
              {rev.reason && <p className="mt-1 text-xs text-text-secondary">Reason: {rev.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
