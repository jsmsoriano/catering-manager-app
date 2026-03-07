'use client';

import { useState, useEffect, useMemo, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  CogIcon,
  CalendarDaysIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  LinkIcon,
  ClipboardDocumentCheckIcon,
  FunnelIcon,
  UsersIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from './AuthProvider';
import { useFeatureFlags } from '@/lib/useFeatureFlags';
import type { FeatureFlags, ProductProfile } from '@/lib/featureFlags';
import { loadFromStorage } from '@/lib/storage';
import { normalizeBookingWorkflowFields, getBookingServiceStatus, toLocalDateISO } from '@/lib/bookingWorkflow';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Booking } from '@/lib/bookingTypes';
import { CRM_UPDATED_EVENT, loadCrmTasks } from '@/lib/crmStorage';

type NavFeatureKey = keyof FeatureFlags;
type NavChild = {
  name: string;
  href: string;
  featureKey?: NavFeatureKey;
  profiles?: ProductProfile[];
  adminOnly?: boolean;
};
type NavItem = {
  name: string;
  icon: ComponentType<{ className?: string }>;
  children: NavChild[];
  asDirect?: boolean;
};

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    icon: HomeIcon,
    children: [{ name: 'Dashboard', href: '/', featureKey: 'home' }],
    asDirect: true,
  },
  {
    // Lead → Quote → Follow-up funnel
    name: 'Sales',
    icon: FunnelIcon,
    children: [
      { name: 'Lead Pipeline', href: '/pipeline', featureKey: 'pipeline' },
      { name: 'New Inquiry', href: '/bookings/new', featureKey: 'events' },
      { name: 'Follow-Ups', href: '/follow-ups', featureKey: 'inbox' },
      { name: 'Inquiries', href: '/inquiries', featureKey: 'events' },
    ],
  },
  {
    // Confirmed & upcoming work
    name: 'Events',
    icon: CalendarDaysIcon,
    children: [
      { name: 'All Events', href: '/bookings', featureKey: 'events' },
      { name: 'Confirmed', href: '/bookings?filter=confirmed', featureKey: 'events' },
      { name: 'Past Events', href: '/bookings?filter=past', featureKey: 'events' },
      { name: 'Calendar', href: '/staff/availability', featureKey: 'staff' },
    ],
  },
  {
    name: 'Customers',
    icon: UsersIcon,
    children: [
      { name: 'All Customers', href: '/customers', featureKey: 'customers' },
    ],
  },
  {
    // Day-of execution tools
    name: 'Operations',
    icon: ClipboardDocumentCheckIcon,
    children: [
      { name: 'Shopping Lists', href: '/bookings/shopping', featureKey: 'events' },
      { name: 'Menu Builder', href: '/menus/builder' },
      { name: 'Staff Assignments', href: '/bookings/staff', featureKey: 'staff' },
      { name: 'Packing', href: '/bookings/packing', featureKey: 'events' },
    ],
  },
  {
    // Money in, money out, profitability
    name: 'Finance',
    icon: BanknotesIcon,
    children: [
      { name: 'Invoices & Payments', href: '/invoices', featureKey: 'invoices' },
      { name: 'Expenses', href: '/expenses', featureKey: 'expenses' },
      { name: 'Profit Calculator', href: '/calculator', featureKey: 'calculator' },
      { name: 'Reports', href: '/reports', featureKey: 'reports' },
    ],
  },
  {
    name: 'Settings',
    icon: CogIcon,
    children: [
      { name: 'Pricing Rules', href: '/business-rules', featureKey: 'settings' },
      { name: 'Business Profile', href: '/settings' },
      { name: 'Team', href: '/staff', featureKey: 'staff' },
      { name: 'Permissions', href: '/admin/permissions', featureKey: 'settings', adminOnly: true },
    ],
  },
];

const testingNavigation: NavItem[] = [
  {
    name: 'Testing',
    icon: LinkIcon,
    children: [
      { name: 'Chef Calculator', href: '/calculator', featureKey: 'settings' },
      { name: 'Inquiry form', href: '/inquiry', featureKey: 'settings' },
      { name: 'Inquiry form (Q&A)', href: '/inquiry-chat', featureKey: 'settings' },
      { name: 'Client Pages', href: '/testing/client-pages', featureKey: 'settings' },
    ],
  },
];

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-8 w-[108px] shrink-0 animate-pulse rounded bg-card" aria-hidden />;
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Image
        src="/logo-icon.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 object-contain"
        priority
      />
      <span className="truncate text-sm font-semibold text-text-primary">Hibachi A Go Go</span>
    </div>
  );
}

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter((c): c is string => typeof c === 'string').join(' ');
}

function getAccordionNames(nav: NavItem[]) {
  return nav.filter((i) => !i.asDirect).map((i) => i.name);
}

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

type FlyoutItem = NavItem;

function SidebarFlyout({
  flyoutItem,
  flyoutTop,
  pathname,
  onClose,
  classNames: cn,
}: {
  flyoutItem: FlyoutItem;
  flyoutTop: number;
  pathname: string;
  onClose: () => void;
  classNames: (...classes: (string | boolean | undefined)[]) => string;
}) {
  const withHref = flyoutItem.children.filter((c): c is typeof c & { href: string } => 'href' in c);
  const activeChildHref =
    withHref
      .slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
      ?.href ?? null;
  return (
    <div
      className="fixed z-50 w-44 rounded-lg border border-border bg-sidebar py-1.5 shadow-lg"
      style={{ top: flyoutTop, left: 80 }}
    >
      <div className="space-y-0.5 px-2">
        {flyoutItem.children.map((child) => {
          const isActive = 'href' in child && child.href === activeChildHref;
          return (
            <Link
              key={child.name}
              href={child.href}
              onClick={onClose}
              className={cn(
                isActive
                  ? 'bg-card text-text-primary'
                  : 'text-text-secondary hover:bg-card hover:text-text-primary',
                'relative block rounded-lg px-3 py-2 text-sm font-medium transition-colors'
              )}
            >
              {isActive && (
                <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent" />
              )}
              <span className="relative">{child.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { flags, productProfile } = useFeatureFlags();
  const role = String((user?.app_metadata as { role?: string } | undefined)?.role ?? '').toLowerCase();
  const isChef = role === 'chef';
  const isAdmin =
    role === 'admin' ||
    String(user?.email ?? '').toLowerCase() === 'djet.soriano@gmail.com';
  const filterByVisibility = (items: NavItem[]) =>
    items
      .map((item) => ({
        ...item,
        children: item.children
          .filter((child) => {
            if (child.adminOnly && !isAdmin) return false;
            if (child.profiles && !child.profiles.includes(productProfile)) return false;
            if (!child.featureKey || child.featureKey === 'settings') return true;
            return !!flags[child.featureKey];
          })
          .map((child) => {
            if (isChef && child.href === '/reports') {
              return { ...child, name: 'Event Summary', href: '/reports/event-summary' };
            }
            return child;
          }),
      }))
      .filter((item) => item.children.length > 0);

  const primaryVisibleNav = useMemo(() => filterByVisibility(navigation), [flags, productProfile, isChef, isAdmin]);
  const testingVisibleNav = useMemo(() => filterByVisibility(testingNavigation), [flags, productProfile]);
  const visibleNav = useMemo(() => [...primaryVisibleNav, ...testingVisibleNav], [primaryVisibleNav, testingVisibleNav]);
  const accordionNames = useMemo(() => getAccordionNames(visibleNav), [visibleNav]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [flyoutTop, setFlyoutTop] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [badgeTick, setBadgeTick] = useState(0);

  // Notifications badge: unreviewed inquiries + critical alerts (overdue deposits/balances)
  const notificationBadgeCount = useMemo(() => {
    const bookings = loadFromStorage<Booking[]>('bookings', []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = toLocalDateISO(today);
    let count = 0;
    for (const raw of bookings) {
      if (raw.source === 'inquiry' && !raw.notes?.includes('[reviewed]')) { count++; continue; }
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
      ) count++;
    }
    return count;
  }, [badgeTick]);

  // Read persisted collapsed state after hydration to avoid server/client mismatch
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) setCollapsed(saved === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const refresh = () => setBadgeTick((n) => n + 1);
    window.addEventListener('bookingsUpdated', refresh);
    window.addEventListener(CRM_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('bookingsUpdated', refresh);
      window.removeEventListener(CRM_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    setExpandedSections((prev) =>
      Object.fromEntries(accordionNames.map((name) => [name, prev[name] ?? true]))
    );
  }, [pathname, accordionNames]);

  const closeAllSections = () => {
    setExpandedSections(Object.fromEntries(accordionNames.map((name) => [name, false])));
  };

  const toggleSection = (name: string, buttonTop?: number) => {
    if (buttonTop !== undefined) setFlyoutTop(buttonTop);
    setExpandedSections((prev) => {
      const next: Record<string, boolean> = {};
      accordionNames.forEach((n) => {
        next[n] = n === name ? !prev[n] : false;
      });
      return next;
    });
  };

  const expandedSectionWhenCollapsed = collapsed
    ? (accordionNames.find((n) => expandedSections[n]) ?? null)
    : null;
  const expandedNavItem = expandedSectionWhenCollapsed
    ? visibleNav.find((i) => i.name === expandedSectionWhenCollapsed)
    : null;
  const flyoutItem =
    collapsed && expandedNavItem
      ? expandedNavItem
      : null;

  const crmTaskBadgeCount = useMemo(() => {
    const tasks = loadCrmTasks();
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter((t) => t.status === 'open' && (!t.dueDate || t.dueDate <= today)).length;
  }, [badgeTick]);

  const renderNavItems = (items: NavItem[]) => {
    return items.map((item) => {
      if (item.asDirect) {
        const target = item.children[0];
        const isActive = pathname === target.href || pathname.startsWith(target.href + '/');
        return (
          <Link
            key={item.name}
            href={target.href}
            title={collapsed ? item.name : undefined}
            onClick={() => {
              closeAllSections();
              onMobileClose?.();
            }}
            className={classNames(
              isActive
                ? 'bg-accent-soft-bg text-accent'
                : 'text-text-secondary hover:bg-card hover:text-text-primary',
              'group relative flex items-center rounded-lg py-2 text-sm font-medium transition-all duration-200',
              collapsed ? 'justify-center px-0' : 'px-3'
            )}
          >
            {isActive && (
              <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent" />
            )}
            <item.icon
              className={classNames(
                isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-primary',
                'h-5 w-5 transition-colors shrink-0',
                !collapsed ? 'mr-3' : ''
              )}
            />
            {!collapsed && (
              <span className="relative flex flex-1 items-center gap-1.5">
                {item.name}
                {item.name === 'Calendar' && notificationBadgeCount > 0 && (
                  <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {notificationBadgeCount}
                  </span>
                )}
              </span>
            )}
          </Link>
        );
      }

      const parentActive = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'));
      const isExpanded = !!expandedSections[item.name] || parentActive;
      const parentHighlight = parentActive || isExpanded;
      return (
        <div key={item.name} className="space-y-0.5">
          <button
            type="button"
            onClick={(e) => toggleSection(item.name, (e.currentTarget as HTMLElement).getBoundingClientRect().top)}
            title={collapsed ? item.name : undefined}
            className={classNames(
              'group relative flex w-full items-center rounded-lg text-sm font-semibold transition-colors',
              collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2 text-left',
              parentHighlight
                ? 'bg-accent-soft-bg text-accent'
                : 'text-text-secondary hover:bg-card hover:text-text-primary'
            )}
          >
            {parentHighlight && (
              <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent" />
            )}
            <item.icon className={classNames('relative h-5 w-5 shrink-0', !collapsed ? 'mr-3' : '', parentHighlight ? 'text-accent' : 'text-text-muted')} />
            {!collapsed && <span className="relative flex-1">{item.name}</span>}
            {!collapsed && (isExpanded ? (
              <ChevronDownIcon className="relative h-4 w-4 shrink-0 text-text-muted" />
            ) : (
              <ChevronRightIcon className="relative h-4 w-4 shrink-0 text-text-muted" />
            ))}
          </button>
          {isExpanded && !collapsed && (
            <div className="ml-8 space-y-0.5">
              {(() => {
                const activeChildHref =
                  item.children
                    .slice()
                    .sort((a, b) => b.href.length - a.href.length)
                    .find((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
                    ?.href ?? null;
                return item.children.map((child) => {
                  const isActive = child.href === activeChildHref;
                  return (
                    <Link
                      key={child.name}
                      href={child.href}
                      onClick={onMobileClose}
                      className={classNames(
                        isActive
                          ? 'bg-card text-text-primary'
                          : 'text-text-secondary hover:bg-card hover:text-text-primary',
                        'group relative block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200'
                      )}
                    >
                      {isActive && (
                        <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent" />
                      )}
                      <span className="relative flex items-center gap-1.5">
                        {child.name}
                        {child.href === '/inquiries' && notificationBadgeCount > 0 && (
                          <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                            {notificationBadgeCount}
                          </span>
                        )}
                        {child.href === '/follow-ups' && crmTaskBadgeCount > 0 && (
                          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                            {crmTaskBadgeCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                });
              })()}
            </div>
          )}
        </div>
      );
    });
  };
  const navContent = renderNavItems(primaryVisibleNav);
  const testingNavContent = renderNavItems(testingVisibleNav);
  const profileLabel =
    productProfile === 'catering_pro'
      ? 'Caterer Pro'
      : 'Hibachi Chef Pro';

  return (
    <SidebarInner
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      pathname={pathname}
      navContent={navContent}
      testingNavContent={testingNavContent}
      profileLabel={profileLabel}
      flyoutItem={flyoutItem}
      flyoutTop={flyoutTop}
      closeAllSections={closeAllSections}
      user={user}
      signOut={signOut}
      classNames={classNames}
      onMobileClose={onMobileClose}
    />
  );
}

function SidebarInner(props: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  pathname: string;
  navContent: ReactNode;
  testingNavContent: ReactNode;
  profileLabel: string;
  flyoutItem: FlyoutItem | null;
  flyoutTop: number;
  closeAllSections: () => void;
  user: { email?: string; user_metadata?: { avatar_url?: string; full_name?: string; name?: string } } | null;
  signOut: () => void;
  classNames: (...classes: (string | boolean | undefined)[]) => string;
  onMobileClose?: () => void;
}) {
  const {
    collapsed,
    setCollapsed,
    pathname,
    navContent,
    testingNavContent,
    profileLabel,
    flyoutItem,
    flyoutTop,
    closeAllSections,
    user,
    signOut,
    classNames,
    onMobileClose,
  } = props;

  return (
    <div className="relative flex h-screen shrink-0">
      <div
        className={`flex flex-col border-r border-border bg-sidebar shadow-sm transition-[width] duration-200 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
      {/* Hamburger toggle */}
      <div className={`relative flex flex-shrink-0 items-center border-b border-border bg-sidebar ${collapsed ? 'justify-center px-2 py-3' : 'justify-start pl-12 pr-3 py-3'}`}>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex shrink-0 items-center justify-center transition-colors ${
            collapsed
              ? 'h-9 w-9 rounded-lg border border-border bg-card text-text-muted hover:bg-card-elevated hover:text-text-primary'
              : 'absolute left-3 h-9 w-9 rounded-full border border-border bg-card text-text-muted hover:bg-card-elevated hover:text-text-primary'
          }`}
        >
          {collapsed ? <Bars3Icon className="h-5 w-5" /> : <XMarkIcon className="h-5 w-5" />}
        </button>
        {!collapsed && (
          <SidebarLogo collapsed={collapsed} />
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-1 overflow-y-auto py-6 ${collapsed ? 'px-3' : 'px-3'}`}>
        <div className="flex min-h-full flex-col">
          <div className="space-y-1">{navContent}</div>
          <div className="mt-auto border-t border-border pt-4">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {profileLabel}
              </p>
            )}
            {!collapsed && (
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Testing only
              </p>
            )}
            <div className="space-y-1">{testingNavContent}</div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className={`border-t border-border bg-card ${collapsed ? 'p-2' : 'p-4'}`}>
        <div className={classNames('gap-2', collapsed ? 'flex flex-col items-center' : 'flex flex-col')}>
          {user && (
            <Link
              href="/account"
              title="Account"
              onClick={onMobileClose}
              className={classNames(
                'flex items-center rounded-md text-text-secondary hover:bg-card-elevated hover:text-text-primary',
                collapsed ? 'justify-center p-1.5' : 'gap-2 px-2 py-1.5'
              )}
            >
              {(user.user_metadata as { avatar_url?: string })?.avatar_url ? (
                <Image
                  src={(user.user_metadata as { avatar_url?: string }).avatar_url!}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                  {(user.user_metadata as { full_name?: string; name?: string })?.full_name?.[0] ??
                    (user.user_metadata as { full_name?: string; name?: string })?.name?.[0] ??
                    user.email?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {(user.user_metadata as { full_name?: string; name?: string })?.full_name ??
                    (user.user_metadata as { full_name?: string; name?: string })?.name ??
                    user.email ??
                    'Account'}
                </span>
              )}
            </Link>
          )}
          {/* Build info */}
          {!collapsed && (
            <div className="px-2 pb-1">
              <p className="text-[10px] leading-tight text-text-muted">
                v{process.env.NEXT_PUBLIC_APP_VERSION}
                {' · '}
                <span className="font-mono">{process.env.NEXT_PUBLIC_BUILD_SHA}</span>
                {' · '}
                {process.env.NEXT_PUBLIC_BUILD_DATE}
              </p>
            </div>
          )}

          <div className={classNames(
            'flex items-center',
            collapsed ? 'flex-col gap-2' : 'justify-between'
          )}>
            <button
              type="button"
              onClick={() => signOut()}
              title={collapsed ? 'Sign out' : undefined}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-elevated hover:text-text-primary"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
              {!collapsed && 'Sign out'}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Flyout submenu when collapsed */}
      {flyoutItem && <SidebarFlyout flyoutItem={flyoutItem} flyoutTop={flyoutTop} pathname={pathname} onClose={closeAllSections} classNames={classNames} />}
    </div>
  );
}
