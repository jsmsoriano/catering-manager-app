'use client';

import { useEffect } from 'react';

export default function BookingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[BookingsError]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center p-12">
      <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Failed to load bookings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          There was a problem loading this section. Your data is safe.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
