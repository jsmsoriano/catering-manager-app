// ============================================================================
// BUSINESS TEMPLATE CONFIG
// ============================================================================
// Drives business type, UI modules, labels, event types, and rule overrides.
// Single-tenant (id='default'); designed so multi-tenant can be added later.

import type { MoneyRules } from './types';

export type BusinessType = 'hibachi' | 'private_chef' | 'wedding' | 'bbq' | 'corporate';

export type PricingMode = 'per_guest' | 'per_person' | 'flat_fee' | 'package' | 'hourly';

export interface EventTypeConfig {
  id: string;            // stored on bookings.eventType (e.g. 'private-dinner')
  label: string;         // shown in admin UI (booking form, filters, reports)
  customerLabel: string; // shown on public inquiry form
  pricingSlot: 'primary' | 'secondary'; // maps to moneyRules.pricing.primaryBasePrice / secondaryBasePrice
}

export interface BusinessTemplateConfig {
  businessType: BusinessType;
  businessName: string;           // displayed in app header / mobile bar
  pricingModeDefault: PricingMode;
  enabledModules: string[];
  eventTypes: EventTypeConfig[];  // replaces hardcoded 'private-dinner' | 'buffet'
  occasions: string[];            // options on the public inquiry form
  labels: Record<string, string>;
  defaults: {
    moneyRulesOverrides?: Partial<MoneyRules>;
    menuEnabled?: boolean;
    staffingEnabled?: boolean;
  };
}

// Module IDs used for enabledModules (UI sections)
export const MODULE_IDS = [
  'event_basics',
  'guest_pricing',
  'menu_builder',
  'staffing_payouts',
  'travel_fees',
  'taxes_gratuity',
  'profit_summary',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export function isModuleEnabled(config: BusinessTemplateConfig, moduleId: string): boolean {
  return config.enabledModules.includes(moduleId);
}

// ----------------------------------------------------------------------------
// Starter templates
// ----------------------------------------------------------------------------

export const HIBACHI_TEMPLATE: BusinessTemplateConfig = {
  businessType: 'hibachi',
  businessName: 'My Hibachi Co.',
  pricingModeDefault: 'per_guest',
  enabledModules: [
    'event_basics',
    'guest_pricing',
    'staffing_payouts',
    'travel_fees',
    'taxes_gratuity',
    'profit_summary',
  ],
  eventTypes: [
    { id: 'private-dinner', label: 'Hibachi Private Event', customerLabel: 'Hibachi Private Event', pricingSlot: 'primary' },
    { id: 'buffet',         label: 'Catering',               customerLabel: 'Catering', pricingSlot: 'secondary' },
  ],
  occasions: [
    'Birthday Party', 'Corporate Event', 'Wedding', 'Anniversary',
    'Graduation', 'Holiday Party', 'Baby Shower', 'Other',
  ],
  labels: {
    guests: 'Guests',
    premiumAddOn: 'Premium Add-on',
    leadChef: 'Hibachi Chef',
    assistant: 'Assistant',
  },
  defaults: {
    moneyRulesOverrides: undefined,
    menuEnabled: false,
    staffingEnabled: true,
  },
};

export const PRIVATE_CHEF_TEMPLATE: BusinessTemplateConfig = {
  businessType: 'private_chef',
  businessName: 'My Private Chef Co.',
  pricingModeDefault: 'flat_fee',
  enabledModules: [
    'event_basics',
    'menu_builder',
    'staffing_payouts',
    'travel_fees',
    'taxes_gratuity',
    'profit_summary',
  ],
  eventTypes: [
    { id: 'private-dinner', label: 'Private Dinner', customerLabel: 'Private Dinner', pricingSlot: 'primary' },
    { id: 'tasting-menu',   label: 'Tasting Menu',   customerLabel: 'Tasting Menu',   pricingSlot: 'secondary' },
  ],
  occasions: [
    'Anniversary', 'Birthday', 'Proposal', 'Corporate Dinner',
    'Holiday Gathering', 'Dinner Party', 'Other',
  ],
  labels: {
    guests: 'Covers',
    premiumAddOn: 'Add-on',
    leadChef: 'Chef',
    assistant: 'Server',
  },
  defaults: {
    moneyRulesOverrides: {
      staffing: {
        assistantRequired: false,
      },
      pricing: {
        childDiscountPercent: 0,
      },
    } as Partial<MoneyRules>,
    menuEnabled: true,
    staffingEnabled: true,
  },
};

export const WEDDING_CATERING_TEMPLATE: BusinessTemplateConfig = {
  businessType: 'wedding',
  businessName: 'My Catering Co.',
  pricingModeDefault: 'package',
  enabledModules: [
    'event_basics',
    'menu_builder',
    'staffing_payouts',
    'travel_fees',
    'taxes_gratuity',
    'profit_summary',
  ],
  eventTypes: [
    { id: 'plated-dinner',     label: 'Plated Dinner',     customerLabel: 'Plated Dinner',     pricingSlot: 'primary' },
    { id: 'buffet-reception',  label: 'Buffet Reception',  customerLabel: 'Buffet / Reception', pricingSlot: 'secondary' },
  ],
  occasions: [
    'Wedding', 'Anniversary', 'Engagement Party', 'Rehearsal Dinner',
    'Bridal Shower', 'Corporate Event', 'Gala', 'Other',
  ],
  labels: {
    guests: 'Guests',
    premiumAddOn: 'Upgrade',
    leadChef: 'Head Chef',
    assistant: 'Server',
  },
  defaults: {
    moneyRulesOverrides: {
      pricing: { defaultGratuityPercent: 20, defaultDepositPercent: 50 },
    } as Partial<MoneyRules>,
    menuEnabled: true,
    staffingEnabled: true,
  },
};

export const BBQ_TEMPLATE: BusinessTemplateConfig = {
  businessType: 'bbq',
  businessName: 'My BBQ Co.',
  pricingModeDefault: 'per_guest',
  enabledModules: [
    'event_basics',
    'guest_pricing',
    'staffing_payouts',
    'travel_fees',
    'taxes_gratuity',
    'profit_summary',
  ],
  eventTypes: [
    { id: 'bbq-buffet',    label: 'BBQ Buffet',    customerLabel: 'BBQ Buffet',    pricingSlot: 'primary' },
    { id: 'custom-spread', label: 'Custom Spread',  customerLabel: 'Custom Menu',   pricingSlot: 'secondary' },
  ],
  occasions: [
    'Birthday', 'Corporate Event', 'Graduation', 'Holiday Party',
    'Block Party', 'Tailgate', 'Family Reunion', 'Other',
  ],
  labels: {
    guests: 'Guests',
    premiumAddOn: 'Premium Meat',
    leadChef: 'Pitmaster',
    assistant: 'Grill Assist',
  },
  defaults: {
    moneyRulesOverrides: {
      staffing: { assistantRequired: false },
      pricing: { defaultGratuityPercent: 0 },
    } as Partial<MoneyRules>,
    menuEnabled: false,
    staffingEnabled: true,
  },
};

export const CORPORATE_CATERING_TEMPLATE: BusinessTemplateConfig = {
  businessType: 'corporate',
  businessName: 'My Catering Co.',
  pricingModeDefault: 'per_person',
  enabledModules: [
    'event_basics',
    'guest_pricing',
    'menu_builder',
    'staffing_payouts',
    'travel_fees',
    'taxes_gratuity',
    'profit_summary',
  ],
  eventTypes: [
    { id: 'office-lunch',  label: 'Office Lunch',       customerLabel: 'Office Lunch',          pricingSlot: 'primary' },
    { id: 'full-service',  label: 'Full Service Event',  customerLabel: 'Full Service Catering', pricingSlot: 'secondary' },
  ],
  occasions: [
    'Team Lunch', 'Board Meeting', 'Company Party', 'Training Day',
    'Client Entertainment', 'Product Launch', 'Other',
  ],
  labels: {
    guests: 'Headcount',
    premiumAddOn: 'Premium Option',
    leadChef: 'Catering Lead',
    assistant: 'Server',
  },
  defaults: {
    moneyRulesOverrides: {
      pricing: { childDiscountPercent: 0, defaultGratuityPercent: 18 },
    } as Partial<MoneyRules>,
    menuEnabled: true,
    staffingEnabled: true,
  },
};

export const DEFAULT_TEMPLATE = HIBACHI_TEMPLATE;

const PRICING_MODES: PricingMode[] = ['per_guest', 'per_person', 'flat_fee', 'package', 'hourly'];

const DEFAULT_EVENT_TYPES: EventTypeConfig[] = HIBACHI_TEMPLATE.eventTypes;
const DEFAULT_OCCASIONS: string[] = HIBACHI_TEMPLATE.occasions;

/** Normalize stored config (e.g. from DB) into full BusinessTemplateConfig. */
export function normalizeTemplateConfig(raw: unknown): BusinessTemplateConfig {
  if (raw && typeof raw === 'object' && 'businessType' in raw) {
    const o = raw as Record<string, unknown>;

    const validTypes: BusinessType[] = ['hibachi', 'private_chef', 'wedding', 'bbq', 'corporate'];
    const businessType: BusinessType = validTypes.includes(o.businessType as BusinessType)
      ? (o.businessType as BusinessType)
      : 'hibachi';

    // Normalize eventTypes — must be an array of valid EventTypeConfig objects
    let eventTypes: EventTypeConfig[] = DEFAULT_EVENT_TYPES;
    if (Array.isArray(o.eventTypes) && o.eventTypes.length > 0) {
      const parsed = o.eventTypes.filter(
        (e): e is EventTypeConfig =>
          e && typeof e === 'object' &&
          typeof e.id === 'string' && e.id.length > 0 &&
          typeof e.label === 'string' &&
          (e.pricingSlot === 'primary' || e.pricingSlot === 'secondary')
      ).map(e => ({
        id: e.id,
        label: e.label,
        customerLabel: typeof e.customerLabel === 'string' ? e.customerLabel : e.label,
        pricingSlot: e.pricingSlot,
      }));
      if (parsed.length > 0) eventTypes = parsed;
    }

    // Normalize occasions
    let occasions: string[] = DEFAULT_OCCASIONS;
    if (Array.isArray(o.occasions) && o.occasions.length > 0) {
      const parsed = o.occasions.filter((s): s is string => typeof s === 'string' && s.length > 0);
      if (parsed.length > 0) occasions = parsed;
    }

    return {
      businessType,
      businessName: typeof o.businessName === 'string' && o.businessName.length > 0
        ? o.businessName
        : DEFAULT_TEMPLATE.businessName,
      pricingModeDefault: PRICING_MODES.includes((o.pricingModeDefault as PricingMode) ?? '')
        ? (o.pricingModeDefault as PricingMode)
        : 'per_guest',
      enabledModules: Array.isArray(o.enabledModules)
        ? o.enabledModules.filter((m): m is string => typeof m === 'string')
        : [...HIBACHI_TEMPLATE.enabledModules],
      eventTypes,
      occasions,
      labels: typeof o.labels === 'object' && o.labels && !Array.isArray(o.labels)
        ? (o.labels as Record<string, string>)
        : { ...HIBACHI_TEMPLATE.labels },
      defaults: typeof o.defaults === 'object' && o.defaults && !Array.isArray(o.defaults)
        ? (o.defaults as BusinessTemplateConfig['defaults'])
        : HIBACHI_TEMPLATE.defaults,
    };
  }
  return { ...DEFAULT_TEMPLATE };
}

/** Helper: get a template label with fallback. */
export function getTemplateLabel(
  labels: Record<string, string>,
  key: string,
  fallback: string
): string {
  return labels[key] || fallback;
}

/** Look up the pricingSlot for an eventType id from template config. */
export function getPricingSlot(
  eventTypes: EventTypeConfig[],
  eventTypeId: string
): 'primary' | 'secondary' {
  return eventTypes.find(et => et.id === eventTypeId)?.pricingSlot ?? 'primary';
}
