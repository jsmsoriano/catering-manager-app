'use client';

import { useState } from 'react';
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
  CalculatorIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import ThemeToggle from './ThemeToggle';
import { useAuth } from './AuthProvider';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { name: 'Menus', href: '/menus', icon: ClipboardDocumentListIcon },
  {
    name: 'Staff',
    icon: UsersIcon,
    children: [
      { name: 'Team', href: '/staff' },
      { name: 'Availability', href: '/staff/availability' },
    ],
  },
  { name: 'Calculator', href: '/calculator', icon: CalculatorIcon },
  { name: 'Expenses', href: '/expenses', icon: ReceiptPercentIcon },
  { name: 'Business Rules', href: '/business-rules', icon: CogIcon },
  {
    name: 'Reports',
    icon: DocumentChartBarIcon,
    children: [
      { name: 'Dashboard', href: '/reports' },
      { name: 'Business Summary', href: '/reports/business-summary' },
      { name: 'Owner Profit Distribution', href: '/reports/owner-monthly' },
      { name: 'Staff Payouts', href: '/reports/comparative' },
    ],
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-sidebar shadow-sm">
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-border bg-sidebar px-8 py-6">
        <Image
          src="/hibachisun.png"
          alt="Hibachi A Go Go"
          width={108}
          height={30}
          className="relative object-contain"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {navigation.map((item) => {
          if (item.children) {
            const parentActive = item.children.some(
              (c) => 'href' in c && (pathname === c.href || pathname.startsWith(c.href + '/'))
            );
            const isExpanded = expandedSections[item.name] ?? parentActive;
            const parentHighlight = parentActive || isExpanded;
            return (
              <div key={item.name} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleSection(item.name)}
                  className={classNames(
                    'group relative flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors',
                    parentHighlight
                      ? 'bg-accent-soft-bg text-accent'
                      : 'text-text-secondary hover:bg-card hover:text-text-primary'
                  )}
                >
                  {parentHighlight && (
                    <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent" />
                  )}
                  <item.icon className={classNames('relative mr-3 h-5 w-5 shrink-0', parentHighlight ? 'text-accent' : 'text-text-muted')} />
                  <span className="relative flex-1">{item.name}</span>
                  {isExpanded ? (
                    <ChevronDownIcon className="relative h-4 w-4 shrink-0 text-text-muted" />
                  ) : (
                    <ChevronRightIcon className="relative h-4 w-4 shrink-0 text-text-muted" />
                  )}
                </button>
                {isExpanded && (
                  <div className="ml-8 space-y-0.5">
                    {item.children.map((child) => {
                      const isActive = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={classNames(
                            isActive
                              ? 'bg-accent-soft-bg text-accent'
                              : 'text-text-secondary hover:bg-card hover:text-text-primary',
                            'group relative block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
                          )}
                        >
                          {isActive && (
                            <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent"></div>
                          )}
                          <span className="relative">{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
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
                  ? 'bg-accent-soft-bg text-accent'
                  : 'text-text-secondary hover:bg-card hover:text-text-primary',
                'group relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
              )}
            >
              {isActive && (
                <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent"></div>
              )}
              <item.icon className={classNames(
                isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-primary',
                'mr-3 h-5 w-5 transition-colors'
              )} />
              <span className="relative">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border bg-card p-4">
        <div className="flex flex-col gap-2">
          {user?.email && (
            <p className="truncate text-xs text-text-muted" title={user.email}>
              {user.email}
            </p>
          )}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-elevated hover:text-text-primary"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
