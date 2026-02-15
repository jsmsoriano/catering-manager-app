'use client';

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  CogIcon,
  DocumentChartBarIcon,
  CalendarDaysIcon,
  ReceiptPercentIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';
import ThemeToggle from './ThemeToggle';

type NavItem = {
  name: string;
  href?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children?: Array<{ name: string; href: string }>;
};

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { name: 'Menus', href: '/menus', icon: ClipboardDocumentListIcon },
  { name: 'Staff', href: '/staff', icon: UsersIcon },
  { name: 'Calculator', href: '/calculator', icon: CalculatorIcon },
  { name: 'Expenses', href: '/expenses', icon: ReceiptPercentIcon },
  { name: 'Business Rules', href: '/business-rules', icon: CogIcon },
  {
    name: 'Reports',
    icon: DocumentChartBarIcon,
    children: [
      { name: 'Dashboard', href: '/reports' },
      { name: 'Owner Distribution', href: '/reports/owner-monthly' },
      { name: 'Staff Payouts', href: '/reports/comparative' },
      { name: 'Business Summary', href: '/reports/business-summary' },
    ],
  },
];

const mobileTabs = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { name: 'Expenses', href: '/expenses', icon: ReceiptPercentIcon },
  { name: 'Reports', href: '/reports', icon: DocumentChartBarIcon },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {navigation.map((item) => {
        if (item.children) {
          const reportsActive = pathname.startsWith('/reports');
          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <item.icon className="mr-3 h-5 w-5 text-slate-500 dark:text-slate-400" />
                {item.name}
              </div>
              <div className="ml-8 space-y-0.5">
                {item.children.map((child) => {
                  const childActive = isActive(pathname, child.href);
                  return (
                    <Link
                      key={child.name}
                      href={child.href}
                      onClick={onNavigate}
                      className={classNames(
                        childActive || (reportsActive && child.href === '/reports')
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm dark:from-indigo-950/50 dark:to-purple-950/50 dark:text-indigo-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-50',
                        'group relative block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
                      )}
                    >
                      {(childActive || (reportsActive && child.href === '/reports')) && (
                        <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                      )}
                      <span className="relative">{child.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }

        const active = item.href ? isActive(pathname, item.href) : false;
        return (
          <Link
            key={item.name}
            href={item.href || '#'}
            onClick={onNavigate}
            className={classNames(
              active
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm dark:from-indigo-950/50 dark:to-purple-950/50 dark:text-indigo-300'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/50 dark:hover:text-slate-50',
              'group relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
            )}
          >
            {active && (
              <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
            )}
            <item.icon
              className={classNames(
                active
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300',
                'mr-3 h-5 w-5 transition-colors'
              )}
            />
            <span className="relative">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur lg:hidden dark:border-slate-800/80 dark:bg-slate-950/95">
        <Link href="/" className="flex items-center">
          <Image
            src="/hibachisun.png"
            alt="Hibachi A Go Go"
            width={112}
            height={30}
            className="object-contain"
            priority
          />
        </Link>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu backdrop"
          />
          <aside className="relative h-full w-72 max-w-[88vw] border-r border-slate-200/80 bg-white shadow-xl dark:border-slate-800/80 dark:bg-slate-950">
            <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80">
              <Image
                src="/hibachisun.png"
                alt="Hibachi A Go Go"
                width={112}
                height={30}
                className="object-contain"
                priority
              />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close navigation menu"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex h-[calc(100%-4rem)] flex-col">
              <NavContent pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} />
              <div className="border-t border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">v2.0.0</p>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white shadow-sm lg:flex dark:border-slate-800/80 dark:bg-slate-950">
        <div className="relative flex h-24 items-center justify-center border-b border-slate-200/80 px-6 py-4 dark:border-slate-800/80">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10"></div>
          <Image
            src="/hibachisun.png"
            alt="Hibachi A Go Go"
            width={130}
            height={36}
            className="relative object-contain"
            priority
          />
        </div>

        <NavContent pathname={pathname} />

        <div className="border-t border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">v2.0.0</p>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800/80 dark:bg-slate-950/95">
        <div className="grid h-16 grid-cols-4">
          {mobileTabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={classNames(
                  active
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400',
                  'flex flex-col items-center justify-center gap-1 text-xs font-medium'
                )}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
