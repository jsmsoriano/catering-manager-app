'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bars3Icon } from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';
import { useTemplateConfig } from '@/lib/useTemplateConfig';

const AUTH_PATHS = ['/login', '/signup', '/auth'];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { config } = useTemplateConfig();

  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      {/* Mobile top bar — hidden on md+ */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-md p-1.5 text-text-secondary hover:bg-card-elevated"
          aria-label="Open menu"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <span className="text-sm font-semibold text-text-primary">{config.businessName || 'Catering Manager'}</span>
      </div>

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

      {/* Main content — top padding on mobile to clear the fixed header */}
      <main className="flex-1 overflow-y-auto bg-background pt-14 md:pt-0">{children}</main>
    </div>
  );
}
