'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  BellIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { loadFromStorage } from '@/lib/storage';
import type { Booking } from '@/lib/bookingTypes';
import { normalizeBookingWorkflowFields, getBookingServiceStatus, toLocalDateISO } from '@/lib/bookingWorkflow';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useAuth } from './AuthProvider';
import { useFeatureFlags } from '@/lib/useFeatureFlags';

function getNotificationCount(): number {
  const bookings = loadFromStorage<Booking[]>('bookings', []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toLocalDateISO(today);
  let count = 0;

  for (const raw of bookings) {
    if (raw.source === 'inquiry' && !raw.notes?.includes('[reviewed]')) {
      count++;
      continue;
    }
    if (raw.source === 'inquiry' || raw.locked) continue;
    const b = normalizeBookingWorkflowFields(raw);
    const svc = getBookingServiceStatus(b);
    if (svc === 'cancelled' || svc === 'completed') continue;
    if (b.paymentStatus === 'deposit-due' && b.depositDueDate && b.depositDueDate < todayISO) count++;
    else if (b.paymentStatus === 'balance-due' && b.balanceDueDate && b.balanceDueDate < todayISO) count++;
    else if (
      svc === 'confirmed' &&
      (!b.staffAssignments || b.staffAssignments.length === 0) &&
      differenceInCalendarDays(parseISO(b.eventDate), today) >= 0 &&
      differenceInCalendarDays(parseISO(b.eventDate), today) <= 3
    ) {
      count++;
    }
  }

  return count;
}

export default function TopNav({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const [q, setQ] = useState('');
  const [notifications, setNotifications] = useState(0);

  const navLinks = [
    { name: 'Dashboard', href: '/' },
    { name: 'Events', href: '/bookings', show: flags.events },
    { name: 'Calendar', href: '/staff/availability', show: flags.staff },
    { name: 'Customers', href: '/customers', show: flags.customers },
  ];

  function isNavActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  useEffect(() => {
    const refresh = () => setNotifications(getNotificationCount());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bookings') refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('bookingsUpdated', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bookingsUpdated', refresh);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const value = q.trim().toLowerCase();
    if (!value) return;
    if (value.includes('event') || value.includes('booking')) router.push('/bookings');
    else if (value.includes('order')) router.push('/orders');
    else if (value.includes('customer')) router.push('/customers');
    else if (value.includes('invoice')) router.push('/invoices');
    else if (value.includes('menu')) router.push('/menus/builder');
    else if (value.includes('report')) router.push('/reports');
    else if (value.includes('staff')) router.push('/staff');
    else if (value.includes('follow') || value.includes('task')) router.push('/follow-ups');
    else if (value.includes('rule') || value.includes('pricing') || value.includes('gratuity')) router.push('/business-rules');
    else if (value.includes('setting') || value.includes('admin')) router.push('/settings');
    else if (value.includes('inquir') || value.includes('alert') || value.includes('notif')) router.push('/inquiries');
    else router.push('/bookings');
  };

  const userName =
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ??
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name ??
    user?.email ??
    'Account';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-text-secondary hover:bg-card-elevated md:hidden"
          aria-label="Open menu"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.show === false ? null : (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isNavActive(link.href)
                    ? 'rounded-md px-2.5 py-1.5 text-sm font-semibold text-accent'
                    : 'rounded-md px-2.5 py-1.5 text-sm font-medium text-text-secondary hover:bg-card-elevated hover:text-text-primary'
                }
              >
                {link.name}
              </Link>
            )
          )}
        </nav>

        <form onSubmit={handleSearch} className="ml-auto hidden w-full max-w-md items-center md:flex">
          <div className="relative w-full">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages (events, orders, invoices, rules…)"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1.5 md:ml-3">
          <Link
            href="/inquiries"
            className="relative rounded-md p-2 text-text-secondary hover:bg-card-elevated hover:text-text-primary"
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            {notifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {notifications}
              </span>
            )}
          </Link>
          <Link href="/account" className="rounded-md p-1.5 text-text-secondary hover:bg-card-elevated">
            {(user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ? (
              <Image
                src={(user?.user_metadata as { avatar_url?: string }).avatar_url!}
                alt="Account"
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                {userName[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
