'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { useAuth } from './AuthProvider';

const AUTH_PATHS = ['/login', '/signup', '/auth', '/proposal'];
const CALCULATOR_PATH = '/calculator';
const CHEF_PATH = '/chef';

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isCalculatorPath(pathname: string): boolean {
  return pathname === CALCULATOR_PATH || pathname.startsWith(CALCULATOR_PATH + '/');
}

function isChefPath(pathname: string): boolean {
  return pathname === CHEF_PATH || pathname.startsWith(CHEF_PATH + '/');
}

function CompactHeader({ title }: { title: string }) {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3 print:hidden">
      <span className="font-semibold text-text-primary">{title}</span>
      <button
        onClick={handleSignOut}
        className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-card-elevated hover:text-text-primary"
      >
        Sign out
      </button>
    </div>
  );
}

export default function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { syncErrors, dismissSyncErrors } = useAuth();

  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }

  if (isCalculatorPath(pathname)) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <CompactHeader title="Event Calculator" />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    );
  }

  if (isChefPath(pathname)) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <CompactHeader title="Chef Portal" />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, normal position on desktop */}
      <div
        className={`print:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:block md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onMobileClose={() => setMobileMenuOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        {syncErrors.length > 0 && (
          <div className="flex items-center gap-3 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <span className="flex-1">
              Could not sync data with the server ({syncErrors.join(', ')}). Your changes are saved locally and will sync when the connection is restored.
            </span>
            <button
              onClick={dismissSyncErrors}
              className="shrink-0 rounded p-0.5 hover:bg-yellow-200 dark:hover:bg-yellow-800"
              aria-label="Dismiss"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
