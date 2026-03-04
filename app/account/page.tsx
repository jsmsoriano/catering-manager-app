'use client';

import Link from 'next/link';
import AccountSetupForm from '@/components/AccountSetupForm';

export default function AccountPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Account</h1>
          <Link
            href="/"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            ← Dashboard
          </Link>
        </div>
        <AccountSetupForm />
      </div>
    </div>
  );
}
