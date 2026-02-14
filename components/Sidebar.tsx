'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  CogIcon,
  DocumentChartBarIcon,
  CalendarDaysIcon,
  ReceiptPercentIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import ThemeToggle from './ThemeToggle';

const navigation = [
  { name: 'Calculator', href: '/', icon: HomeIcon },
  { name: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { name: 'Menus', href: '/menus', icon: ClipboardDocumentListIcon },
  { name: 'Staff', href: '/staff', icon: UsersIcon },
  { name: 'Expenses', href: '/expenses', icon: ReceiptPercentIcon },
  { name: 'Money Rules', href: '/money-rules', icon: CogIcon },
  {
    name: 'Reports',
    icon: DocumentChartBarIcon,
    children: [
      { name: 'Dashboard', href: '/reports' },
      { name: 'Owner Monthly', href: '/reports/owner-monthly' },
      { name: 'Staff Payouts', href: '/reports/comparative' },
      { name: 'Business Summary', href: '/reports/business-summary' },
    ],
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-950">
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {navigation.map((item) => {
          if (item.children) {
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <item.icon className="mr-3 h-5 w-5 text-slate-500 dark:text-slate-400" />
                  {item.name}
                </div>
                <div className="ml-8 space-y-0.5">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={classNames(
                          isActive
                            ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm dark:from-indigo-950/50 dark:to-purple-950/50 dark:text-indigo-300'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-50',
                          'group relative block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
                        )}
                      >
                        {isActive && (
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

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={classNames(
                isActive
                  ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm dark:from-indigo-950/50 dark:to-purple-950/50 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/50 dark:hover:text-slate-50',
                'group relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
              )}
            >
              {isActive && (
                <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
              )}
              <item.icon className={classNames(
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300',
                'mr-3 h-5 w-5 transition-colors'
              )} />
              <span className="relative">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            v2.0.0
          </p>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
