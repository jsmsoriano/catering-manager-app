'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { StaffMember as StaffRecord } from '@/lib/staffTypes';
import { CHEF_ROLE_TO_STAFF_ROLE, STAFF_ROLE_TO_CHEF_ROLE } from '@/lib/staffTypes';
import type { ChefRole } from '@/lib/types';

// Helper to parse date strings as local dates (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// ChefRole display labels
const CHEF_ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

type StaffFilter = 'all' | 'owners' | 'non-owners';
type RoleFilter = 'all' | ChefRole | 'assistant';

interface StaffPayoutRow {
  key: string;
  name: string;
  role: string;
  roleLabel: string;
  isOwner: boolean;
  ownerRole?: 'owner-a' | 'owner-b';
  eventsWorked: number;
  totalBasePay: number;
  totalGratuity: number;
  totalProfitShare: number;
  totalPayout: number;
  avgPerEvent: number;
}

interface EventDetailRow {
  date: string;
  customer: string;
  eventType: string;
  guests: number;
  staffName: string;
  role: string;
  roleLabel: string;
  isOwner: boolean;
  basePay: number;
  gratuity: number;
  profitShare: number;
  total: number;
}

export default function StaffPayoutReportPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Load bookings
  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (saved) {
        try {
          setBookings(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load bookings:', e);
        }
      }
    };

    loadBookings();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bookings') loadBookings();
    };
    const handleCustom = () => loadBookings();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('bookingsUpdated', handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bookingsUpdated', handleCustom);
    };
  }, []);

  // Load staff records
  useEffect(() => {
    const loadStaff = () => {
      const saved = localStorage.getItem('staff');
      if (saved) {
        try {
          setStaffRecords(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load staff:', e);
        }
      }
    };

    loadStaff();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'staff') loadStaff();
    };
    const handleCustom = () => loadStaff();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('staffUpdated', handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('staffUpdated', handleCustom);
    };
  }, []);

  // Filter bookings for date range (non-cancelled only)
  const filteredBookings = useMemo(() => {
    const rangeStart = parseLocalDate(startDate);
    const rangeEnd = parseLocalDate(endDate);

    return bookings.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isWithinInterval(d, { start: rangeStart, end: rangeEnd }) && b.status !== 'cancelled';
    });
  }, [bookings, startDate, endDate]);

  // Build owner lookup: maps ChefRole/assistant string -> owner name
  const ownerLookup = useMemo(() => {
    const lookup = new Map<string, { name: string; ownerRole: string }>();

    staffRecords
      .filter((s) => s.isOwner && s.status === 'active')
      .forEach((s) => {
        const chefRole = STAFF_ROLE_TO_CHEF_ROLE[s.primaryRole];
        if (chefRole) {
          lookup.set(chefRole, { name: s.name, ownerRole: s.ownerRole || '' });
        }
      });

    return lookup;
  }, [staffRecords]);

  // Build staff ID lookup for resolving assignments
  const staffById = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffRecords.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffRecords]);

  // Aggregate payout data
  const { payoutRows, eventDetails, grandTotals } = useMemo(() => {
    const staffMap = new Map<string, StaffPayoutRow>();
    const details: EventDetailRow[] = [];
    let totalBasePay = 0;
    let totalGratuity = 0;
    let totalProfitShare = 0;
    let totalPayout = 0;
    let totalEvents = 0;

    filteredBookings.forEach((booking) => {
      const { financials } = calculateBookingFinancials(booking, rules);

      totalEvents++;
      const matchedOwners = new Set<string>();

      // Track which owner roles have been assigned profit share for this event
      const profitShareAssigned = new Set<string>();

      financials.laborCompensation.forEach((comp, compIdx) => {
        let key: string;
        let name: string;
        let isOwner = false;
        let ownerRole: 'owner-a' | 'owner-b' | undefined;

        // Priority 1: Check booking.staffAssignments for this position
        const staffRole = CHEF_ROLE_TO_STAFF_ROLE[comp.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
        let resolvedFromAssignment = false;

        if (booking.staffAssignments && staffRole) {
          // Count same-role positions before this index
          let sameRoleIndex = 0;
          for (let i = 0; i < compIdx; i++) {
            if (financials.laborCompensation[i].role === comp.role) sameRoleIndex++;
          }

          // Find the nth assignment matching this role
          let matchCount = 0;
          const assignment = booking.staffAssignments.find((a) => {
            if (a.role === staffRole) {
              if (matchCount === sameRoleIndex) return true;
              matchCount++;
            }
            return false;
          });

          if (assignment) {
            const staffRecord = staffById.get(assignment.staffId);
            if (staffRecord) {
              resolvedFromAssignment = true;
              name = staffRecord.name;
              isOwner = staffRecord.isOwner;
              ownerRole = staffRecord.ownerRole;
              key = isOwner ? `owner:${staffRecord.id}` : `staff:${staffRecord.id}`;
            }
          }
        }

        // Priority 2: Fallback to role-based owner matching
        if (!resolvedFromAssignment) {
          const ownerInfo = ownerLookup.get(comp.role);
          if (ownerInfo && !matchedOwners.has(comp.role)) {
            matchedOwners.add(comp.role);
            key = `owner:${comp.role}`;
            name = ownerInfo.name;
            isOwner = true;
            ownerRole = ownerInfo.ownerRole as 'owner-a' | 'owner-b' | undefined;
          } else {
            key = `role:${comp.role}`;
            name = CHEF_ROLE_LABELS[comp.role] || comp.role;
          }
        }

        const roleLabel = CHEF_ROLE_LABELS[comp.role] || comp.role;

        // Calculate profit share for this position (owners only, once per owner per event)
        let profitShare = 0;
        if (isOwner && ownerRole && !profitShareAssigned.has(ownerRole)) {
          profitShareAssigned.add(ownerRole);
          profitShare = ownerRole === 'owner-a'
            ? financials.ownerADistribution
            : financials.ownerBDistribution;
        }

        // Update aggregated row
        const existing = staffMap.get(key!);
        if (existing) {
          existing.eventsWorked++;
          existing.totalBasePay += comp.basePay;
          existing.totalGratuity += comp.gratuityShare;
          existing.totalProfitShare += profitShare;
          existing.totalPayout += comp.finalPay + profitShare;
          existing.avgPerEvent = existing.totalPayout / existing.eventsWorked;
        } else {
          staffMap.set(key!, {
            key: key!,
            name: name!,
            role: comp.role,
            roleLabel,
            isOwner,
            ownerRole,
            eventsWorked: 1,
            totalBasePay: comp.basePay,
            totalGratuity: comp.gratuityShare,
            totalProfitShare: profitShare,
            totalPayout: comp.finalPay + profitShare,
            avgPerEvent: comp.finalPay + profitShare,
          });
        }

        totalBasePay += comp.basePay;
        totalGratuity += comp.gratuityShare;
        totalProfitShare += profitShare;
        totalPayout += comp.finalPay + profitShare;

        // Event detail row
        details.push({
          date: booking.eventDate,
          customer: booking.customerName,
          eventType: booking.eventType === 'private-dinner' ? 'Private' : 'Buffet',
          guests: booking.adults + booking.children,
          staffName: name!,
          role: comp.role,
          roleLabel,
          isOwner,
          basePay: comp.basePay,
          gratuity: comp.gratuityShare,
          profitShare,
          total: comp.finalPay + profitShare,
        });
      });
    });

    // Sort: owners first, then by total payout descending
    const rows = Array.from(staffMap.values()).sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return b.totalPayout - a.totalPayout;
    });

    // Sort details by date
    details.sort((a, b) => a.date.localeCompare(b.date));

    return {
      payoutRows: rows,
      eventDetails: details,
      grandTotals: { totalBasePay, totalGratuity, totalProfitShare, totalPayout, totalEvents },
    };
  }, [filteredBookings, rules, ownerLookup, staffById]);

  // Apply staff and role filters to summary rows
  const filteredRows = useMemo(() => {
    return payoutRows.filter((row) => {
      if (staffFilter === 'owners' && !row.isOwner) return false;
      if (staffFilter === 'non-owners' && row.isOwner) return false;
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;
      return true;
    });
  }, [payoutRows, staffFilter, roleFilter]);

  // Apply staff and role filters to event detail rows
  const filteredDetails = useMemo(() => {
    return eventDetails.filter((row) => {
      if (staffFilter === 'owners' && !row.isOwner) return false;
      if (staffFilter === 'non-owners' && row.isOwner) return false;
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;
      return true;
    });
  }, [eventDetails, staffFilter, roleFilter]);

  // Compute filtered totals for summary cards and table footer
  const filteredTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        totalBasePay: acc.totalBasePay + row.totalBasePay,
        totalGratuity: acc.totalGratuity + row.totalGratuity,
        totalProfitShare: acc.totalProfitShare + row.totalProfitShare,
        totalPayout: acc.totalPayout + row.totalPayout,
        totalStaffEvents: acc.totalStaffEvents + row.eventsWorked,
      }),
      { totalBasePay: 0, totalGratuity: 0, totalProfitShare: 0, totalPayout: 0, totalStaffEvents: 0 }
    );
  }, [filteredRows]);

  const handlePrint = () => window.print();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header - Hide on print */}
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-text-primary">
          Staff Payout Report
        </h1>
        <p className="mt-2 text-text-secondary">
          Comprehensive breakdown of all staff payouts including owners
        </p>
      </div>

      {/* Filters - Hide on print */}
      <div className="mb-8 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <button
          onClick={() => {
            const today = new Date();
            setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
            setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
          }}
          className="rounded-md border border-border bg-card-elevated px-4 py-2 text-text-secondary hover:bg-card"
        >
          This Month
        </button>
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            Staff
          </label>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value as StaffFilter)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          >
            <option value="all">All Staff</option>
            <option value="owners">Owners Only</option>
            <option value="non-owners">Non-Owner Staff</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            Role
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          >
            <option value="all">All Roles</option>
            <option value="lead">Lead Chef</option>
            <option value="full">Full Chef</option>
            <option value="buffet">Buffet Chef</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <button
          onClick={handlePrint}
          className="rounded-md bg-card-elevated px-4 py-2 text-text-primary hover:bg-card"
        >
          Print Report
        </button>
      </div>

      {/* Report Content - Print friendly */}
      <div className="space-y-8 rounded-lg border border-border bg-card p-8 print:border-0 print:shadow-none">
        {/* Print Header */}
        <div className="hidden border-b border-border pb-6 print:block">
          <div className="mb-4 flex justify-center">
            <Image
              src="/hibachisun.png"
              alt="Hibachi A Go Go"
              width={200}
              height={60}
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-center text-xl font-semibold text-text-primary">
            Staff Payout Report
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-text-secondary">
            <div>
              <strong>Report Period:</strong>{' '}
              {format(parseLocalDate(startDate), 'MMM d, yyyy')} -{' '}
              {format(parseLocalDate(endDate), 'MMM d, yyyy')}
            </div>
            <div>
              <strong>Generated:</strong> {format(new Date(), 'PPP')}
            </div>
            <div>
              <strong>Total Payouts:</strong>{' '}
              {formatCurrency(filteredTotals.totalPayout)}
            </div>
            <div>
              <strong>Events:</strong> {grandTotals.totalEvents}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20 print:border-blue-300">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Total Payouts
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(filteredTotals.totalPayout)}
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              Labor + gratuity + profit share
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20 print:border-emerald-300">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              Base Pay
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(filteredTotals.totalBasePay)}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              From revenue
            </p>
          </div>

          <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20 print:border-purple-300">
            <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
              Total Gratuity
            </p>
            <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(filteredTotals.totalGratuity)}
            </p>
            <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
              From tips
            </p>
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/20 print:border-indigo-300">
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
              Profit Share
            </p>
            <p className="mt-2 text-3xl font-bold text-accent dark:text-indigo-400">
              {formatCurrency(filteredTotals.totalProfitShare)}
            </p>
            <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
              Owner equity distributions
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/20 print:border-amber-300">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Events in Period
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
              {grandTotals.totalEvents}
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {filteredBookings.length} non-cancelled bookings
            </p>
          </div>
        </div>

        {/* Staff Payout Summary Table */}
        {filteredRows.length > 0 ? (
          <>
            <div>
              <h3 className="mb-4 text-xl font-semibold text-text-primary">
                Staff Payout Summary
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-border bg-card-elevated">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-text-primary">
                        Name / Role
                      </th>
                      <th className="px-4 py-3 font-semibold text-text-primary">
                        Role
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Events
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Base Pay
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Gratuity
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Profit Share
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Total Pay
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Avg/Event
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.key}
                        className="hover:bg-card-elevated"
                      >
                        <td className="px-4 py-3 text-text-primary">
                          <div className="flex items-center gap-2">
                            {row.name}
                            {row.isOwner && (
                              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                Owner
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {row.roleLabel}
                        </td>
                        <td className="px-4 py-3 text-right text-text-secondary">
                          {row.eventsWorked}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary">
                          {formatCurrency(row.totalBasePay)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary">
                          {formatCurrency(row.totalGratuity)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary">
                          {row.isOwner ? formatCurrency(row.totalProfitShare) : (
                            <span className="text-text-muted">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-text-primary">
                          {formatCurrency(row.totalPayout)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-secondary">
                          {formatCurrency(row.avgPerEvent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-card-elevated font-semibold">
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-3 text-right text-text-primary"
                      >
                        Totals:
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {filteredTotals.totalStaffEvents}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {formatCurrency(filteredTotals.totalBasePay)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {formatCurrency(filteredTotals.totalGratuity)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {formatCurrency(filteredTotals.totalProfitShare)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {formatCurrency(filteredTotals.totalPayout)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {filteredTotals.totalStaffEvents > 0
                          ? formatCurrency(
                              filteredTotals.totalPayout / filteredTotals.totalStaffEvents
                            )
                          : formatCurrency(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Event-by-Event Breakdown */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-text-primary">
                Event-by-Event Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-border bg-card-elevated">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-text-primary">
                        Date
                      </th>
                      <th className="px-4 py-3 font-semibold text-text-primary">
                        Customer
                      </th>
                      <th className="px-4 py-3 font-semibold text-text-primary">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Guests
                      </th>
                      <th className="px-4 py-3 font-semibold text-text-primary">
                        Staff
                      </th>
                      <th className="px-4 py-3 font-semibold text-text-primary">
                        Role
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Base Pay
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Gratuity
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Profit Share
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-text-primary">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDetails.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-card-elevated"
                      >
                        <td className="px-4 py-3 text-text-primary">
                          {format(parseLocalDate(row.date), 'MMM d')}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {row.customer}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {row.eventType}
                        </td>
                        <td className="px-4 py-3 text-right text-text-secondary">
                          {row.guests}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          <div className="flex items-center gap-1">
                            {row.staffName}
                            {row.isOwner && (
                              <span className="inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                Owner
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {row.roleLabel}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary">
                          {formatCurrency(row.basePay)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary">
                          {formatCurrency(row.gratuity)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary">
                          {row.profitShare > 0 ? formatCurrency(row.profitShare) : (
                            <span className="text-text-muted">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-text-primary">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-card-elevated p-12 text-center">
            <p className="text-text-secondary">
              No payout data found for{' '}
              {format(parseLocalDate(startDate), 'MMM d, yyyy')} -{' '}
              {format(parseLocalDate(endDate), 'MMM d, yyyy')}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Create bookings in the Bookings page to see staff payout data here.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-text-muted ">
          <p>
            This report is generated based on current Business Rules settings.
            Historical events may have used different rates.
          </p>
          <p className="mt-2">
            Report generated on {format(new Date(), 'PPP')} at{' '}
            {format(new Date(), 'p')}
          </p>
        </div>
      </div>
    </div>
  );
}
