'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import Link from 'next/link';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { Expense, ExpenseCategory } from '@/lib/expenseTypes';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Helper to parse date strings as local dates (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Chart palette from design tokens
const CHART_COLORS = {
  accent: '#F97316',
  accentHover: '#EA580C',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#3B82F6',
} as const;

export default function ReportsDashboardPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  // Load bookings and listen for updates
  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          console.log('📊 Reports Dashboard: Loaded bookings from localStorage:', parsed.length);
          setBookings(parsed);
        } catch (e) {
          console.error('Failed to load bookings:', e);
        }
      } else {
        console.log('📊 Reports Dashboard: No bookings found in localStorage');
      }
    };

    // Initial load
    console.log('📊 Reports Dashboard: Component mounted, loading data...');
    loadBookings();

    // Listen for storage changes (cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bookings') {
        console.log('📊 Reports Dashboard: Detected storage change (cross-tab)');
        loadBookings();
      }
    };

    // Listen for custom events (same-tab updates)
    const handleCustomStorageChange = () => {
      console.log('📊 Reports Dashboard: Detected bookingsUpdated event (same-tab)');
      loadBookings();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bookingsUpdated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingsUpdated', handleCustomStorageChange);
    };
  }, []);

  // Load expenses and listen for updates
  useEffect(() => {
    const loadExpenses = () => {
      const saved = localStorage.getItem('expenses');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          console.log('📊 Reports Dashboard: Loaded expenses from localStorage:', parsed.length);
          setExpenses(parsed);
        } catch (e) {
          console.error('Failed to load expenses:', e);
        }
      } else {
        console.log('📊 Reports Dashboard: No expenses found in localStorage');
      }
    };

    console.log('📊 Reports Dashboard: Setting up expense listeners');
    loadExpenses();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'expenses') {
        console.log('📊 Reports Dashboard: Detected storage change (cross-tab)');
        loadExpenses();
      }
    };

    const handleCustomStorageChange = () => {
      console.log('📊 Reports Dashboard: Detected expensesUpdated event (same-tab)');
      loadExpenses();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('expensesUpdated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('expensesUpdated', handleCustomStorageChange);
    };
  }, []);

  // Calculate dashboard metrics
  const dashboardData = useMemo(() => {
    const monthStart = startOfMonth(parseLocalDate(selectedMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);

    // Filter bookings for selected month
    const monthBookings = bookings.filter((booking) => {
      const bookingDate = parseLocalDate(booking.eventDate);
      const isInRange = isWithinInterval(bookingDate, { start: monthStart, end: monthEnd });
      console.log('📊 Filtering booking:', {
        eventDate: booking.eventDate,
        parsedDate: bookingDate.toISOString(),
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString(),
        isInRange,
        status: booking.status,
      });
      return (
        isInRange &&
        booking.status !== 'cancelled'
      );
    });

    // Calculate metrics
    let totalRevenue = 0;
    let totalFoodCosts = 0;
    let totalLaborCosts = 0;
    let totalGrossProfit = 0;
    let privateRevenue = 0;
    let buffetRevenue = 0;
    let privateCount = 0;
    let buffetCount = 0;
    let ownerALabor = 0;
    let ownerBLabor = 0;
    let ownerAProfit = 0;
    let ownerBProfit = 0;

    const statusCounts = {
      pending: 0,
      confirmed: 0,
      completed: 0,
    };

    const upcomingEvents: Array<{
      id: string;
      date: string;
      customer: string;
      type: string;
      guests: number;
      total: number;
    }> = [];

    monthBookings.forEach((booking) => {
      const { financials } = calculateBookingFinancials(booking, rules);

      totalRevenue += financials.subtotal + financials.distanceFee;
      totalFoodCosts += financials.foodCost;
      totalLaborCosts += financials.totalLaborPaid;
      totalGrossProfit += financials.grossProfit;

      if (booking.eventType === 'private-dinner') {
        privateRevenue += financials.subtotal;
        privateCount++;
      } else {
        buffetRevenue += financials.subtotal;
        buffetCount++;
      }

      // Owner compensation
      const ownerAComp = financials.laborCompensation.find((c) => c.ownerRole === 'owner-a');
      const ownerBComp = financials.laborCompensation.find((c) => c.ownerRole === 'owner-b');

      ownerALabor += ownerAComp?.finalPay || 0;
      ownerBLabor += ownerBComp?.finalPay || 0;
      ownerAProfit += financials.ownerADistribution;
      ownerBProfit += financials.ownerBDistribution;

      // Status counts
      if (booking.status === 'pending') statusCounts.pending++;
      if (booking.status === 'confirmed') statusCounts.confirmed++;
      if (booking.status === 'completed') statusCounts.completed++;

      // Upcoming events (confirmed only, future dates)
      if (
        booking.status === 'confirmed' &&
        parseLocalDate(booking.eventDate) > new Date()
      ) {
        upcomingEvents.push({
          id: booking.id,
          date: booking.eventDate,
          customer: booking.customerName,
          type: booking.eventType === 'private-dinner' ? 'Private' : 'Buffet',
          guests: booking.adults + booking.children,
          total: financials.totalCharged,
        });
      }
    });

    // Sort upcoming events by date
    upcomingEvents.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const profitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const avgRevenuePerEvent = monthBookings.length > 0 ? totalRevenue / monthBookings.length : 0;

    return {
      totalRevenue,
      totalFoodCosts,
      totalLaborCosts,
      totalGrossProfit,
      profitMargin,
      privateRevenue,
      buffetRevenue,
      privateCount,
      buffetCount,
      totalEvents: monthBookings.length,
      avgRevenuePerEvent,
      statusCounts,
      upcomingEvents: upcomingEvents.slice(0, 5), // Top 5 upcoming
      ownerATotal: ownerALabor + ownerAProfit,
      ownerBTotal: ownerBLabor + ownerBProfit,
      ownerALabor,
      ownerBLabor,
      ownerAProfit,
      ownerBProfit,
    };
  }, [bookings, selectedMonth, rules]);

  // Calculate expense metrics for selected month
  const expenseData = useMemo(() => {
    const monthStart = startOfMonth(parseLocalDate(selectedMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);

    const monthExpenses = expenses.filter((expense) => {
      const expenseDate = parseLocalDate(expense.date);
      return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
    });

    const byCategory: Record<ExpenseCategory, number> = {
      food: 0,
      'gas-mileage': 0,
      supplies: 0,
      equipment: 0,
      labor: 0,
      other: 0,
    };

    let totalExpenses = 0;
    let eventLinkedExpenses = 0;
    let generalExpenses = 0;

    monthExpenses.forEach((expense) => {
      byCategory[expense.category] += expense.amount;
      totalExpenses += expense.amount;

      if (expense.bookingId) {
        eventLinkedExpenses += expense.amount;
      } else {
        generalExpenses += expense.amount;
      }
    });

    return {
      totalExpenses,
      byCategory,
      eventLinkedExpenses,
      generalExpenses,
      expenseCount: monthExpenses.length,
    };
  }, [expenses, selectedMonth]);

  // Calculate 6-month revenue trend for charts
  const revenueTrendData = useMemo(() => {
    const months = [];
    const currentMonth = parseLocalDate(selectedMonth + '-01');

    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(currentMonth, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Filter bookings for this month
      const monthBookings = bookings.filter((booking) => {
        const bookingDate = parseLocalDate(booking.eventDate);
        return (
          isWithinInterval(bookingDate, { start: monthStart, end: monthEnd }) &&
          booking.status !== 'cancelled'
        );
      });

      // Calculate totals
      let revenue = 0;
      let profit = 0;
      let costs = 0;

      monthBookings.forEach((booking) => {
        const { financials } = calculateBookingFinancials(booking, rules);
        revenue += financials.subtotal + financials.distanceFee;
        profit += financials.grossProfit;
        costs += financials.foodCost + financials.totalLaborPaid;
      });

      months.push({
        month: format(monthDate, 'MMM yyyy'),
        revenue: Math.round(revenue),
        profit: Math.round(profit),
        costs: Math.round(costs),
        events: monthBookings.length,
      });
    }

    return months;
  }, [bookings, selectedMonth, rules]);

  // Calculate 6-month expense trend for charts
  const expenseTrendData = useMemo(() => {
    const months = [];
    const currentMonth = parseLocalDate(selectedMonth + '-01');

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(currentMonth, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthExpenses = expenses.filter((expense) => {
        const expenseDate = parseLocalDate(expense.date);
        return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
      });

      let totalExpenses = 0;
      let foodExpenses = 0;

      monthExpenses.forEach((expense) => {
        totalExpenses += expense.amount;
        if (expense.category === 'food') {
          foodExpenses += expense.amount;
        }
      });

      months.push({
        month: format(monthDate, 'MMM yyyy'),
        expenses: Math.round(totalExpenses),
        foodExpenses: Math.round(foodExpenses),
      });
    }

    return months;
  }, [expenses, selectedMonth]);

  // Event type breakdown for pie chart
  const eventTypeData = useMemo(() => {
    if (dashboardData.totalRevenue === 0) return [];

    return [
      {
        name: 'Private Dinners',
        value: Math.round(dashboardData.privateRevenue),
        count: dashboardData.privateCount,
        color: CHART_COLORS.accent,
      },
      {
        name: 'Buffet Catering',
        value: Math.round(dashboardData.buffetRevenue),
        count: dashboardData.buffetCount,
        color: CHART_COLORS.success,
      },
    ].filter(item => item.value > 0);
  }, [dashboardData]);

  // Expense category breakdown for pie chart
  const expenseCategoryData = useMemo(() => {
    if (expenseData.totalExpenses === 0) return [];

    const categoryColors: Record<ExpenseCategory, string> = {
      food: CHART_COLORS.danger,
      'gas-mileage': CHART_COLORS.info,
      supplies: CHART_COLORS.warning,
      equipment: CHART_COLORS.info,
      labor: CHART_COLORS.accent,
      other: '#71717a',
    };

    const categoryLabels: Record<ExpenseCategory, string> = {
      food: 'Food & Ingredients',
      'gas-mileage': 'Gas & Mileage',
      supplies: 'Supplies',
      equipment: 'Equipment',
      labor: 'Extra Labor',
      other: 'Other',
    };

    return Object.entries(expenseData.byCategory)
      .filter(([, amount]) => amount > 0)
      .map(([category, amount]) => ({
        name: categoryLabels[category as ExpenseCategory],
        value: Math.round(amount),
        color: categoryColors[category as ExpenseCategory],
      }));
  }, [expenseData]);

  // Cost breakdown for current month
  const costBreakdownData = useMemo(() => {
    return [
      {
        category: 'Revenue',
        amount: Math.round(dashboardData.totalRevenue),
        color: CHART_COLORS.success,
      },
      {
        category: 'Food Costs',
        amount: Math.round(dashboardData.totalFoodCosts),
        color: CHART_COLORS.warning,
      },
      {
        category: 'Labor Costs',
        amount: Math.round(dashboardData.totalLaborCosts),
        color: CHART_COLORS.info,
      },
      {
        category: 'Gross Profit',
        amount: Math.round(dashboardData.totalGrossProfit),
        color: CHART_COLORS.accent,
      },
    ];
  }, [dashboardData]);

  // Estimated vs Actual costs comparison
  const estimatedVsActualData = useMemo(() => {
    return [
      {
        category: 'Food Costs',
        estimated: Math.round(dashboardData.totalFoodCosts),
        actual: Math.round(expenseData.byCategory.food),
      },
      {
        category: 'Labor Costs',
        estimated: Math.round(dashboardData.totalLaborCosts),
        actual: Math.round(expenseData.byCategory.labor),
      },
    ].filter(item => item.estimated > 0 || item.actual > 0);
  }, [dashboardData, expenseData]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">
          Reports Dashboard
        </h1>
        <p className="mt-2 text-text-secondary">
          Business performance overview and key metrics
        </p>
      </div>

      {/* Month Selector & Refresh */}
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            Report Period
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <button
          onClick={() => {
            const saved = localStorage.getItem('bookings');
            if (saved) {
              setBookings(JSON.parse(saved));
            }
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          🔄 Refresh Data
        </button>
        <div className="text-sm text-text-secondary">
          {bookings.length} total bookings loaded
        </div>
      </div>

      {/* Consolidated Report Sections */}
      <div className="mb-8 rounded-lg border border-border bg-accent-soft-bg p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          Consolidated Report Sections
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/reports"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-card-elevated"
          >
            Reports Dashboard
          </Link>
          <Link
            href="/reports/business-summary"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-card-elevated"
          >
            Business Summary
          </Link>
          <Link
            href="/reports/owner-monthly"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-card-elevated"
          >
            Owner Profit Distribution
          </Link>
          <Link
            href="/reports/comparative"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-card-elevated"
          >
            Staff Payouts
          </Link>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Total Revenue
          </h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(dashboardData.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            {dashboardData.totalEvents} events
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Gross Profit
          </h3>
          <p className="mt-2 text-3xl font-bold text-success">
            {formatCurrency(dashboardData.totalGrossProfit)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {dashboardData.profitMargin.toFixed(1)}% margin
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Avg per Event
          </h3>
          <p className="mt-2 text-3xl font-bold text-accent">
            {formatCurrency(dashboardData.avgRevenuePerEvent)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Revenue per booking
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Upcoming Events
          </h3>
          <p className="mt-2 text-3xl font-bold text-warning">
            {dashboardData.upcomingEvents.length}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Confirmed bookings
          </p>
        </div>
      </div>

      {/* Expense Metrics Grid */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
          <h3 className="text-sm font-medium text-red-900 dark:text-red-200">
            Total Expenses
          </h3>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(expenseData.totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            {expenseData.expenseCount} expenses tracked
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Actual Food Costs
          </h3>
          <p className="mt-2 text-3xl font-bold text-accent">
            {formatCurrency(expenseData.byCategory.food)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Est: {formatCurrency(dashboardData.totalFoodCosts)}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Event-Linked Expenses
          </h3>
          <p className="mt-2 text-3xl font-bold text-info">
            {formatCurrency(expenseData.eventLinkedExpenses)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {formatCurrency(expenseData.generalExpenses)} general
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Adjusted Profit
          </h3>
          <p className="mt-2 text-3xl font-bold text-success">
            {formatCurrency(dashboardData.totalGrossProfit - expenseData.totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            After actual expenses
          </p>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="mb-8 rounded-lg border border-border bg-card p-6 dark:border-border ">
        <h2 className="mb-6 text-xl font-semibold text-text-primary">
          Revenue & Profit Trends (6 Months)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueTrendData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
              className="text-xs text-text-muted"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis
              className="text-xs text-text-muted"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, '']}
              labelStyle={{ color: 'var(--text-secondary)' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={CHART_COLORS.accent}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Revenue"
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke={CHART_COLORS.success}
              fillOpacity={1}
              fill="url(#colorProfit)"
              name="Profit"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Expense Trend Chart */}
      <div className="mb-8 rounded-lg border border-border bg-card p-6 dark:border-border ">
        <h2 className="mb-6 text-xl font-semibold text-text-primary">
          Monthly Expense Trends (6 Months)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={expenseTrendData}>
            <defs>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.danger} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={CHART_COLORS.danger} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorFoodExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
              className="text-xs text-text-muted"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis
              className="text-xs text-text-muted"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, '']}
              labelStyle={{ color: 'var(--text-secondary)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke={CHART_COLORS.danger}
              fillOpacity={1}
              fill="url(#colorExpenses)"
              name="Total Expenses"
            />
            <Area
              type="monotone"
              dataKey="foodExpenses"
              stroke={CHART_COLORS.accent}
              fillOpacity={1}
              fill="url(#colorFoodExpenses)"
              name="Food Expenses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row */}
      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        {/* Event Type Breakdown Pie Chart */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Event Type Breakdown
          </h2>
          {eventTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={eventTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill={CHART_COLORS.accent}
                  dataKey="value"
                >
                  {eventTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number | undefined, _name, props) => [
                    `$${(value ?? 0).toLocaleString()} (${props.payload.count} events)`,
                    props.payload.name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-text-muted">
              No event data available
            </div>
          )}
        </div>

        {/* Cost Breakdown Bar Chart */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Financial Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costBreakdownData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="category"
                className="text-xs text-text-muted"
                tick={{ fill: 'currentColor' }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis
                className="text-xs text-text-muted"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, '']}
              labelStyle={{ color: 'var(--text-secondary)' }}
              />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {costBreakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expense Charts Row */}
      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        {/* Expense Category Breakdown */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Expense Category Breakdown
          </h2>
          {expenseCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill={CHART_COLORS.accent}
                  dataKey="value"
                >
                  {expenseCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-primary)',
                  }}
                  formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-text-muted">
              No expense data available
            </div>
          )}
        </div>

        {/* Estimated vs Actual */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Estimated vs Actual Costs
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={estimatedVsActualData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="category"
                className="text-xs text-text-muted"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs text-text-muted"
                tick={{ fill: 'currentColor' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, '']}
              labelStyle={{ color: 'var(--text-secondary)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="square" />
              <Bar dataKey="estimated" fill={CHART_COLORS.info} name="Estimated" radius={[8, 8, 0, 0]} />
              <Bar dataKey="actual" fill={CHART_COLORS.danger} name="Actual" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Event Type Performance */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-4 text-xl font-semibold text-text-primary">
            Event Type Performance
          </h2>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium text-text-secondary">
                  Private Dinners
                </span>
                <span className="text-text-primary">
                  {formatCurrency(dashboardData.privateRevenue)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-accent"
                  style={{
                    width: `${
                      dashboardData.totalRevenue > 0
                        ? (dashboardData.privateRevenue / dashboardData.totalRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {dashboardData.privateCount} events (
                {dashboardData.totalEvents > 0
                  ? ((dashboardData.privateCount / dashboardData.totalEvents) * 100).toFixed(0)
                  : 0}
                %)
              </p>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium text-text-secondary">
                  Buffet Catering
                </span>
                <span className="text-text-primary">
                  {formatCurrency(dashboardData.buffetRevenue)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${
                      dashboardData.totalRevenue > 0
                        ? (dashboardData.buffetRevenue / dashboardData.totalRevenue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {dashboardData.buffetCount} events (
                {dashboardData.totalEvents > 0
                  ? ((dashboardData.buffetCount / dashboardData.totalEvents) * 100).toFixed(0)
                  : 0}
                %)
              </p>
            </div>
          </div>
        </div>

        {/* Booking Status */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-4 text-xl font-semibold text-text-primary">
            Booking Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-accent"></div>
                <span className="text-sm text-text-secondary">Pending</span>
              </div>
              <span className="font-semibold text-text-primary">
                {dashboardData.statusCounts.pending}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <span className="text-sm text-text-secondary">Confirmed</span>
              </div>
              <span className="font-semibold text-text-primary">
                {dashboardData.statusCounts.confirmed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-text-muted"></div>
                <span className="text-sm text-text-secondary">Completed</span>
              </div>
              <span className="font-semibold text-text-primary">
                {dashboardData.statusCounts.completed}
              </span>
            </div>
          </div>
        </div>

        {/* Owner Compensation Summary */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">
              Owner Compensation
            </h2>
            <Link
              href="/reports/owner-monthly"
              className="text-sm text-accent hover:text-accent-hover"
            >
              View Details →
            </Link>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">
                  Owner A (Head Chef)
                </span>
                <span className="text-lg font-bold text-text-primary">
                  {formatCurrency(dashboardData.ownerATotal)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Labor: {formatCurrency(dashboardData.ownerALabor)}</span>
                <span>Profit: {formatCurrency(dashboardData.ownerAProfit)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">
                  Owner B (Operations)
                </span>
                <span className="text-lg font-bold text-text-primary">
                  {formatCurrency(dashboardData.ownerBTotal)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Labor: {formatCurrency(dashboardData.ownerBLabor)}</span>
                <span>Profit: {formatCurrency(dashboardData.ownerBProfit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">
              Upcoming Events
            </h2>
            <Link
              href="/bookings"
              className="text-sm text-accent hover:text-accent-hover"
            >
              View Calendar →
            </Link>
          </div>
          {dashboardData.upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {dashboardData.upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 "
                >
                  <div>
                    <p className="font-medium text-text-primary">
                      {event.customer}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {format(parseLocalDate(event.date), 'MMM d, yyyy')} · {event.type} · {event.guests}{' '}
                      guests
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-text-primary">
                    {formatCurrency(event.total)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-text-muted">No upcoming confirmed events</p>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 rounded-lg border border-border bg-card-elevated p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Consolidated Report Views
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/reports/owner-monthly"
          className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-card-elevated"
        >
          <h3 className="font-semibold text-text-primary">
            Owner Profit Distribution
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Event-level owner payouts, retained earnings, and chef payouts
          </p>
        </Link>

        <Link
          href="/reports/business-summary"
          className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-card-elevated"
        >
          <h3 className="font-semibold text-text-primary">
            Business Summary
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Overall performance and trends
          </p>
        </Link>

        <Link
          href="/reports/comparative"
          className="rounded-lg border border-border bg-card p-6 transition-colors hover:bg-card-elevated"
        >
          <h3 className="font-semibold text-text-primary">
            Staff Payouts
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Consolidated labor payout report across owners and staff
          </p>
        </Link>
        </div>
      </div>
    </div>
  );
}
