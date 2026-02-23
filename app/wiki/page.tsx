'use client';

import { useState } from 'react';
import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  CogIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'bookings' | 'pipeline' | 'menus' | 'staff' | 'financials' | 'reports' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Step {
  step: number;
  title: string;
  description: string;
  tip?: string;
}

interface Workflow {
  id: string;
  title: string;
  description: string;
  steps: Step[];
  tip?: string;
  warning?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { id: 'overview',    label: 'Overview',    icon: InformationCircleIcon },
  { id: 'bookings',   label: 'Events',       icon: CalendarDaysIcon },
  { id: 'pipeline',   label: 'Pipeline',     icon: ViewColumnsIcon },
  { id: 'menus',      label: 'Menus',       icon: ClipboardDocumentListIcon },
  { id: 'staff',      label: 'Staff',       icon: UsersIcon },
  { id: 'financials', label: 'Financials',  icon: CurrencyDollarIcon },
  { id: 'reports',    label: 'Reports',     icon: DocumentChartBarIcon },
  { id: 'settings',   label: 'Settings',    icon: CogIcon },
];

const BOOKING_WORKFLOWS: Workflow[] = [
  {
    id: 'create-booking',
    title: 'Creating a New Booking',
    description: 'Record a new event inquiry or confirmed booking.',
    steps: [
      { step: 1, title: 'Open Events', description: 'Navigate to Events from the sidebar.' },
      { step: 2, title: 'Click "+ New Event"', description: 'Opens the event form in a drawer on the right side.' },
      { step: 3, title: 'Fill in event details', description: 'Enter the event date, time, customer info, guest count (adults + children), location, and distance in miles.' },
      { step: 4, title: 'Set pricing inputs', description: 'The subtotal is auto-calculated from your business rules. You can add a premium add-on amount per guest for special requests.' },
      { step: 5, title: 'Add notes (optional)', description: 'Internal notes for your team — not shown to the customer.' },
      { step: 6, title: 'Save', description: 'The event is saved with status "Pending". It will appear in the events table.' },
    ],
    tip: 'Use the Calculator page to quickly estimate a quote before creating the formal booking.',
  },
  {
    id: 'confirm-booking',
    title: 'Confirming a Booking & Taking a Deposit',
    description: 'Move a booking from Pending to Confirmed and collect the deposit.',
    steps: [
      { step: 1, title: 'Open Actions', description: 'Click the "Actions" button on the booking row in the table.' },
      { step: 2, title: 'Select "Confirm Booking"', description: 'Opens the confirmation dialog. Set the deposit percentage (e.g. 30%) and deposit due date.' },
      { step: 3, title: 'Confirm', description: 'Booking status changes to Confirmed. A deposit amount is now set on the record.' },
      { step: 4, title: 'Record deposit payment', description: 'When the customer pays, click Actions → Record Payment. Enter the amount, payment method (Zelle, Venmo, Cash, etc.), payment date, and an optional reference note.' },
      { step: 5, title: 'Verify payment status', description: 'After saving, the payment status updates automatically: "Deposit Received" when the deposit is covered, "Balance Due" for the remaining amount. (Full payment sets booking status to Confirmed if it was still Pending.)' },
    ],
    tip: 'The payment modal pre-fills with the current balance due so you don\'t have to calculate it manually.',
  },
  {
    id: 'assign-staff',
    title: 'Assigning Staff to an Event',
    description: 'Attach team members and roles to a booking.',
    steps: [
      { step: 1, title: 'Open Actions', description: 'Click Actions on the booking row.' },
      { step: 2, title: 'Select "Assign Staff"', description: 'Opens the staff assignment drawer.' },
      { step: 3, title: 'Pick a staffing profile (optional)', description: 'Staffing profiles define the default crew size and pay structure. You can override per booking.' },
      { step: 4, title: 'Add assignments', description: 'Select a staff member and their role for this event (Lead Chef, Chef, Assistant, Contractor).' },
      { step: 5, title: 'Save', description: 'Staff pills (Lead, Chef, Asst, Cont) appear in the Staff column of the events table.' },
    ],
    tip: 'Check the Staff → Availability page first to confirm your crew is free on the event date.',
  },
  {
    id: 'add-menu',
    title: 'Building a Guest Menu',
    description: 'Record each guest\'s protein selections, sides, and upgrade add-ons.',
    steps: [
      { step: 1, title: 'Open Actions', description: 'Click Actions on the booking row.' },
      { step: 2, title: 'Select "Add Menu" or "Edit Menu"', description: 'Opens the Guest Menu Selection page for that booking.' },
      { step: 3, title: 'Fill in guest rows', description: 'Enter a name for each guest (required), mark Adult or Child, and choose their 2 protein selections from the base protein options.' },
      { step: 4, title: 'Select upgrade add-ons', description: 'Check any upgrade proteins (e.g. Filet Mignon +$5, Scallops +$5) for guests who want premium proteins. Revenue and food cost estimates update live.' },
      { step: 5, title: 'Mark side preferences', description: 'Each guest defaults to all sides. Uncheck Fried Rice, Noodles, Salad, or Veggies if they decline a side.' },
      { step: 6, title: 'Add special requests & allergies', description: 'Free-text fields for each guest. Flag anything the chef needs to know.' },
      { step: 7, title: 'Save Menu', description: 'The menu is saved and the booking\'s subtotal is updated to reflect menu-based pricing and upgrade add-ons.' },
    ],
    tip: 'The "Menu Revenue Estimate" card at the top shows the running total including upgrade charges. It updates as you check boxes.',
  },
  {
    id: 'shopping-list',
    title: 'Generating a Shopping List',
    description: 'Get an ingredient list based on the guest menu.',
    steps: [
      { step: 1, title: 'Ensure a menu is saved', description: 'A shopping list is generated from the saved guest menu. Add the menu first if you haven\'t.' },
      { step: 2, title: 'Open Actions → Shopping List', description: 'Opens the shopping list page for the booking.' },
      { step: 3, title: 'Review quantities', description: 'Ingredients are grouped by category. Quantities are calculated from protein and side counts across all guests.' },
      { step: 4, title: 'Check off items as you shop', description: 'Check boxes are persistent — they save to local storage so you can close and come back.' },
      { step: 5, title: 'Record actual costs (optional)', description: 'Enter what you spent per item to track against your food cost estimate.' },
    ],
    tip: 'The Prep Purchase By date shown on the booking detail is set automatically to 2 days before the event.',
  },
  {
    id: 'complete-booking',
    title: 'Completing & Locking an Event',
    description: 'Mark an event as done and lock the record from accidental edits.',
    steps: [
      { step: 1, title: 'Change status to Completed', description: 'On the booking row, use the status dropdown (visible when unlocked) and select "Completed".' },
      { step: 2, title: 'Record final payment', description: 'If balance is still due, record the final payment via Actions → Record Payment before or after completing.' },
      { step: 3, title: 'Auto-lock', description: 'The record locks automatically when status becomes Completed. A lock icon appears and all mutating Actions are hidden.' },
      { step: 4, title: 'Unlock if needed', description: 'Click Actions → Unlock Record to re-enable editing. Re-lock by setting status back to Completed.' },
    ],
    warning: 'Completed bookings lock automatically to prevent accidental edits. Unlock only when a correction is needed, then re-lock.',
  },
  {
    id: 'reconcile',
    title: 'Reconciling an Event',
    description: 'Review final revenue vs. costs and log what was actually paid out.',
    steps: [
      { step: 1, title: 'Open Actions → Reconcile Event', description: 'Available on any booking (locked or unlocked). Opens the reconciliation page.' },
      { step: 2, title: 'Review financials', description: 'See the event\'s total revenue, food cost, gratuity, and gross profit broken down.' },
      { step: 3, title: 'Enter actual costs', description: 'Override estimated food cost with actual receipts. Record staff payouts.' },
      { step: 4, title: 'Save reconciliation', description: 'The reconciliation record is stored separately from the booking and used in financial reports.' },
    ],
    tip: 'Run the Business Summary report after reconciling multiple events to see your true profit margin.',
  },
];

const PIPELINE_WORKFLOWS: Workflow[] = [
  {
    id: 'pipeline-view',
    title: 'Using the Pipeline (Kanban)',
    description: 'Track leads from inquiry through quote, deposit, and booking. Drag cards between columns to update stage.',
    steps: [
      { step: 1, title: 'Open Pipeline', description: 'Click Pipeline in the sidebar. The page shows a Kanban with columns: Inquiry, Quote Sent, Deposit Pending, Booked, Completed.' },
      { step: 2, title: 'Review the metrics bar', description: 'At the top you see Inquiries this month, Conversion rate, and Revenue booked for the current month.' },
      { step: 3, title: 'Drag a card to change stage', description: 'Drag any event card into another column to move it. The booking\'s pipeline status and (when moving to Booked/Completed) its booking status update automatically.' },
      { step: 4, title: 'Open an event', description: 'Click a card (without dragging) to go to the Events page with that booking selected.' },
    ],
    tip: 'In light theme, column headers have a dark background for emphasis. New inquiries start in the Inquiry column.',
  },
];

const MENU_WORKFLOWS: Workflow[] = [
  {
    id: 'menu-template',
    title: 'Configuring the Menu Template',
    description: 'Set the standard inclusions, base proteins, and upgrade add-ons for your private dinner menu.',
    steps: [
      { step: 1, title: 'Go to Settings → Menu Settings', description: 'Open Settings from the sidebar, then select the "Menu Settings" tab.' },
      { step: 2, title: 'Select "Menu Template" (if applicable)', description: 'The menu template section shows your configurable private dinner template.' },
      { step: 3, title: 'Edit Standard Inclusions', description: 'These are the items listed on your flyer (Side Salad, Hibachi Vegetables, Fried Rice & Noodles, 2 Protein Choices). Add or remove items as your menu evolves.' },
      { step: 4, title: 'Edit Base Proteins', description: 'Toggle proteins on/off and edit their display labels. Enabled proteins appear in the guest menu dropdown when building a menu.' },
      { step: 5, title: 'Edit Upgrade Add-ons', description: 'Set the price and cost per person for premium proteins (Filet Mignon, Scallops). Toggle to enable/disable them.' },
      { step: 6, title: 'Save Template', description: 'Changes are stored in local storage and take effect immediately on new guest menus.' },
    ],
    tip: 'The template drives the guest menu builder. If you disable a base protein here, it disappears from the protein selection dropdowns on new menus.',
  },
  {
    id: 'item-catalog',
    title: 'Managing the Item Catalog',
    description: 'Maintain the price-per-serving and cost-per-serving for individual menu items used in pricing calculations.',
    steps: [
      { step: 1, title: 'Go to Menus → Item Catalog tab', description: 'Shows all menu items (proteins, sides, appetizers, beverages, desserts).' },
      { step: 2, title: 'Search or filter', description: 'Use the search bar or category filter to find specific items.' },
      { step: 3, title: 'Edit an item', description: 'Click Edit on an item to update its name, description, price per serving, cost per serving, or dietary tags.' },
      { step: 4, title: 'Toggle availability', description: 'Mark items unavailable to exclude them from active menus without deleting them.' },
    ],
    tip: 'Pricing calculations (revenue estimate, food cost) pull from this catalog. Keep cost-per-serving accurate for reliable profit reporting.',
  },
];

const STAFF_WORKFLOWS: Workflow[] = [
  {
    id: 'add-staff',
    title: 'Adding a Staff Member',
    description: 'Add a new team member to the system.',
    steps: [
      { step: 1, title: 'Go to Staff → Team', description: 'Navigate to Staff from the sidebar, then the Team page.' },
      { step: 2, title: 'Click "Add Staff Member"', description: 'Opens the add staff form.' },
      { step: 3, title: 'Fill in details', description: 'Name, role (Lead Chef, Chef, Assistant, Contractor), contact info, and pay rate.' },
      { step: 4, title: 'Save', description: 'The staff member is now available to assign to bookings.' },
    ],
  },
  {
    id: 'availability',
    title: 'Checking & Setting Availability',
    description: 'View and set when staff are available for events.',
    steps: [
      { step: 1, title: 'Go to Staff → Availability', description: 'Shows a calendar or list of staff availability by date.' },
      { step: 2, title: 'Set recurring availability', description: 'Each staff member can mark their available days of the week.' },
      { step: 3, title: 'Block specific dates', description: 'Staff can mark individual dates as unavailable (vacation, personal).' },
      { step: 4, title: 'Cross-reference before booking', description: 'Check availability before assigning staff to an event to avoid conflicts.' },
    ],
    tip: 'Staff can update their own availability from their profile page at /staff/profile.',
  },
];

const FINANCIAL_WORKFLOWS: Workflow[] = [
  {
    id: 'record-payment',
    title: 'Recording a Customer Payment',
    description: 'Log any payment received — deposit or balance.',
    steps: [
      { step: 1, title: 'Click Actions → Record Payment', description: 'Available on any non-locked confirmed booking.' },
      { step: 2, title: 'Review the payment context', description: 'The modal shows Total, Amount Paid so far, and Balance Due. The amount field pre-fills with the balance due.' },
      { step: 3, title: 'Enter amount', description: 'Change the amount if the customer pays partially.' },
      { step: 4, title: 'Select method', description: 'Choose: Zelle, Venmo, Cash, Card, Bank Transfer, or Other.' },
      { step: 5, title: 'Set date and note', description: 'Set the payment date (defaults to today) and optionally add a reference number or note.' },
      { step: 6, title: 'Save Payment', description: 'The payment status updates automatically: Deposit Received → Balance Due → Paid in Full. Recording a full payment can set the booking status to Confirmed.' },
      { step: 7, title: 'Recording a refund (optional)', description: 'In the same Record Payment modal you can choose type "Refund". Enter the amount and save. The booking\'s status is set to Cancelled and payment status to Refunded.' },
    ],
    tip: 'If a payment covers only the deposit, it\'s automatically tagged as a "deposit" type. Once the deposit is fully covered, subsequent payments are tagged as "payment".',
  },
  {
    id: 'view-invoice',
    title: 'Viewing & Sharing an Invoice',
    description: 'Generate a customer-facing invoice for a booking.',
    steps: [
      { step: 1, title: 'Click Actions → View Invoice', description: 'Opens the invoice page for the booking.' },
      { step: 2, title: 'Review invoice details', description: 'Shows event details, guest count, subtotal, gratuity, distance fee, total, deposit paid, and balance due.' },
      { step: 3, title: 'Print or share', description: 'Use browser print (Ctrl/Cmd + P) to save as PDF or print. Share the PDF with your customer.' },
    ],
  },
  {
    id: 'log-expense',
    title: 'Logging a Business Expense',
    description: 'Track non-event costs like supplies, equipment, marketing, etc.',
    steps: [
      { step: 1, title: 'Go to Expenses', description: 'Navigate to Expenses from the sidebar.' },
      { step: 2, title: 'Click "Add Expense"', description: 'Opens the expense form.' },
      { step: 3, title: 'Enter details', description: 'Category, description, amount, and date. Optionally link to a specific booking.' },
      { step: 4, title: 'Save', description: 'Expense appears in the list and is included in the Business Summary report for that period.' },
    ],
  },
];

const REPORT_DESCRIPTIONS = [
  {
    name: 'Reports Dashboard',
    path: '/reports',
    description: 'High-level KPIs: total revenue, bookings, average event value, and profit for a selected date range.',
  },
  {
    name: 'Event Summary',
    path: '/reports/event-summary',
    description: 'Per-event breakdown: revenue, food cost, gratuity, gross profit, and payment status. From a booking, use Actions → Event Summary to view, download, or email the summary. Great for end-of-month review.',
  },
  {
    name: 'Business Summary',
    path: '/reports/business-summary',
    description: 'Aggregate P&L for a period — total revenue, total costs (food + expenses), and net profit.',
  },
  {
    name: 'Owner Profit Distribution',
    path: '/reports/owner-monthly',
    description: 'Splits net profit among owners based on ownership percentages configured in Settings.',
  },
  {
    name: 'Staff Payouts',
    path: '/reports/comparative',
    description: 'Shows what each staff member earned across events in a selected period, based on their role pay rates.',
  },
];

const SETTINGS_SECTIONS = [
  {
    name: 'Settings (main)',
    path: '/settings',
    description: 'Settings has three tabs: Business template (event type, pricing mode, modules), Business rules (adult/child rates, gratuity, distance fees — rates are snapshotted at booking save), and Menu Settings (menu template, item catalog). App-level configuration like business name, owner distribution, and staffing profiles are also here.',
  },
  {
    name: 'Business Rules',
    path: '/settings?tab=rules',
    description: 'Core pricing: adult rate, child rate, gratuity percentage, distance fee tiers, and child discount. These rates are used to calculate every booking\'s subtotal and total. Rates are snapshotted at booking save time so old bookings are unaffected by future rate changes.',
  },
  {
    name: 'Menu Settings',
    path: '/menus',
    description: 'Menu template (standard inclusions, base proteins, upgrade add-ons) and item catalog. Configure once; all guest menus and pricing use these settings.',
  },
  {
    name: 'Calculator',
    path: '/calculator',
    description: 'Quote tool — enter guest count, location, and premium add-on to instantly see a pricing estimate without creating a booking. Useful for phone inquiries.',
  },
];

// ─── Helper Components ─────────────────────────────────────────────────────────

function TipBox({ text }: { text: string }) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
      <LightBulbIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function WarningBox({ text }: { text: string }) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-card-elevated transition-colors"
      >
        <div>
          <p className="font-semibold text-text-primary">{workflow.title}</p>
          <p className="mt-0.5 text-sm text-text-muted">{workflow.description}</p>
        </div>
        {expanded ? (
          <ChevronDownIcon className="h-5 w-5 flex-shrink-0 text-text-muted" />
        ) : (
          <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-text-muted" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-5 py-4">
          <ol className="space-y-3">
            {workflow.steps.map((s) => (
              <li key={s.step} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                  {s.step}
                </span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{s.title}</p>
                  <p className="text-sm text-text-secondary">{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
          {workflow.tip && <TipBox text={workflow.tip} />}
          {workflow.warning && <WarningBox text={workflow.warning} />}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

// ─── Tab Content ───────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="HibachiSun Manager — App Overview"
        description="Everything you need to run private hibachi dining events, from booking to payout."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: CalendarDaysIcon,         color: 'text-accent',    bg: 'bg-accent/10',      title: 'Events',       desc: 'Create and manage events, assign staff, track payment lifecycle from deposit to paid-in-full. Status and payment are shown as text with a colored left border for quick scanning.' },
          { icon: ViewColumnsIcon,          color: 'text-blue-600',  bg: 'bg-blue-100 dark:bg-blue-950/30',  title: 'Pipeline', desc: 'Kanban view: Inquiry → Quote Sent → Deposit Pending → Booked → Completed. Drag cards to move stage; metrics bar shows inquiries, conversion, and revenue.' },
          { icon: ClipboardDocumentListIcon, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/30', title: 'Menus', desc: 'Configure your menu template and item catalog under Settings → Menu Settings. Build per-guest protein & upgrade selections from the event Actions.' },
          { icon: UsersIcon,               color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-950/30',  title: 'Staff',   desc: 'Add team members, set roles and pay rates, track availability, and assign crew to events.' },
          { icon: CurrencyDollarIcon,       color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-950/30',   title: 'Financials', desc: 'Record payments (including refunds), log expenses, view invoices, and reconcile each event after completion.' },
          { icon: DocumentChartBarIcon,     color: 'text-rose-600',   bg: 'bg-rose-100 dark:bg-rose-950/30',     title: 'Reports', desc: 'Revenue, P&L, owner distributions, and staff payout reports across any date range. Event Summary: view, download, or email per event.' },
          { icon: CogIcon,                 color: 'text-gray-600',   bg: 'bg-gray-100 dark:bg-gray-800',         title: 'Settings', desc: 'Three tabs: Business template, Business rules, Menu Settings. Pricing, gratuity, distance fees, staffing profiles, and menu configuration.' },
        ].map(({ icon: Icon, color, bg, title, desc }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <h3 className="font-semibold text-text-primary">{title}</h3>
            <p className="mt-1 text-sm text-text-secondary">{desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold text-text-primary">Event Lifecycle at a Glance</h3>
        <p className="mb-3 text-sm text-text-secondary">Pipeline (Kanban) stages and booking status flow:</p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Inquiry',        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
            { label: '→', color: 'text-text-muted bg-transparent' },
            { label: 'Quote Sent',     color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' },
            { label: '→', color: 'text-text-muted bg-transparent' },
            { label: 'Deposit Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
            { label: '→', color: 'text-text-muted bg-transparent' },
            { label: 'Booked',         color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
            { label: '→', color: 'text-text-muted bg-transparent' },
            { label: 'Completed',      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
            { label: '  (or Refunded → Cancelled)', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' },
          ].map(({ label, color }, i) => (
            <span key={i} className={`rounded-full px-3 py-1 text-xs font-medium ${color}`}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold text-text-primary">Quick Tips</h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          {[
            'All data is stored locally in your browser. Export or back up regularly.',
            'The first sidebar item is Home — your dashboard with upcoming events and snapshot metrics.',
            'Pricing rates are snapshotted at booking save time — updating business rules won\'t change old bookings.',
            'Completed bookings auto-lock. Use Actions → Unlock Record only for corrections.',
            'The Menu Template (Settings → Menu Settings) drives protein options on all guest menus.',
            'Run the Calculator for quick quotes before creating a formal booking.',
            'Assign staff before the event and check the Availability page for conflicts.',
            'Pipeline: drag cards between columns to move stage; in light theme, column titles have a dark header for emphasis.',
          ].map((tip, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WorkflowTab({ workflows }: { workflows: Workflow[] }) {
  return (
    <div className="space-y-3">
      {workflows.map((w) => (
        <WorkflowCard key={w.id} workflow={w} />
      ))}
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Reports"
        description="Financial and operational summaries across any date range. All reports pull from saved booking, expense, and reconciliation data."
      />
      <div className="space-y-3">
        {REPORT_DESCRIPTIONS.map((r) => (
          <div key={r.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-text-primary">{r.name}</p>
                <p className="mt-1 text-sm text-text-secondary">{r.description}</p>
              </div>
              <span className="flex-shrink-0 rounded-md border border-border bg-card-elevated px-2 py-1 font-mono text-xs text-text-muted">
                {r.path}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="flex gap-2 text-sm text-amber-800 dark:text-amber-300">
          <LightBulbIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          For accurate profit figures, reconcile events after completion and log all business expenses in the Expenses page before running the Business Summary report.
        </p>
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Settings & Configuration"
        description="Configure pricing, business rules, and operational defaults. Changes here affect new bookings but not existing saved ones."
      />
      <div className="space-y-3">
        {SETTINGS_SECTIONS.map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-text-primary">{s.name}</p>
                <p className="mt-1 text-sm text-text-secondary">{s.description}</p>
              </div>
              <span className="flex-shrink-0 rounded-md border border-border bg-card-elevated px-2 py-1 font-mono text-xs text-text-muted">
                {s.path}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold text-text-primary">Pricing Snapshot Behavior</h3>
        <p className="text-sm text-text-secondary">
          When you save a booking, the current adult rate, child rate, and gratuity percentage are snapshotted inside the booking record. This means you can update your prices in Business Rules at any time without retroactively changing your old bookings or invoices. The snapshot is shown on invoices and reconciliation reports.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WikiPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Documentation</h1>
          <p className="mt-2 text-text-secondary">
            Workflows, instructions, and reference guides for using HibachiSun Manager.
          </p>
        </div>

        {/* Tab Bar */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card-elevated p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-secondary hover:bg-card hover:text-text-primary'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && <OverviewTab />}

          {activeTab === 'bookings' && (
            <>
              <SectionHeader
                title="Event Workflows"
                description="Step-by-step guides for the full event lifecycle. Click any workflow to expand it. From a booking you can use Actions → Event Summary to view, download, or email the summary."
              />
              <WorkflowTab workflows={BOOKING_WORKFLOWS} />
            </>
          )}

          {activeTab === 'pipeline' && (
            <>
              <SectionHeader
                title="Pipeline"
                description="Kanban view for moving leads from inquiry to completed. Metrics at the top show monthly inquiries, conversion rate, and revenue booked."
              />
              <WorkflowTab workflows={PIPELINE_WORKFLOWS} />
            </>
          )}

          {activeTab === 'menus' && (
            <>
              <SectionHeader
                title="Menu Workflows"
                description="Menu configuration lives under Settings → Menu Settings. Set up your private dinner template and item catalog; build per-guest selections from the event Actions."
              />
              <WorkflowTab workflows={MENU_WORKFLOWS} />
            </>
          )}

          {activeTab === 'staff' && (
            <>
              <SectionHeader
                title="Staff Workflows"
                description="Add team members, manage availability, and assign them to events."
              />
              <WorkflowTab workflows={STAFF_WORKFLOWS} />
            </>
          )}

          {activeTab === 'financials' && (
            <>
              <SectionHeader
                title="Financial Workflows"
                description="Payment recording, invoicing, expense tracking, and event reconciliation."
              />
              <WorkflowTab workflows={FINANCIAL_WORKFLOWS} />
            </>
          )}

          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}
