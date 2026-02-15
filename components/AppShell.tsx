'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Bars3Icon } from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onEscape);
    };
  }, [isSidebarOpen]);

  return (
    <div className="flex h-screen bg-[#f5f5f7] dark:bg-slate-950">
      <div className="hidden h-screen shrink-0 md:flex">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 md:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open navigation menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <Image
            src="/hibachisun.png"
            alt="Hibachi A Go Go"
            width={110}
            height={30}
            className="object-contain"
            priority
          />

          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto bg-[#f5f5f7] dark:bg-slate-950">
          {children}
        </main>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            aria-label="Close navigation menu"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative z-10 h-full w-64">
            <Sidebar
              isMobile
              onClose={() => setIsSidebarOpen(false)}
              onNavigate={() => setIsSidebarOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
