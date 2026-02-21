// ============================================================================
// CATERING MANAGER - TYPE DEFINITIONS
// ============================================================================

// ----------------------------------------------------------------------------
// Event Types & Basic Structures
// ----------------------------------------------------------------------------

// Widened to string so templates can define their own event type ids.
// Valid values at runtime are driven by BusinessTemplateConfig.eventTypes.
export type EventType = string;

export type ChefRole = 'lead' | 'overflow' | 'full' | 'buffet';

export type OwnerRole = 'owner-a' | 'owner-b';

export type StaffingRoleEntry = ChefRole | 'assistant';

export interface StaffingProfile {
  id: string;
  name: string;
  eventType: EventType | 'any';
  minGuests: number;
  maxGuests: number; // 9999 = no upper limit
  roles: StaffingRoleEntry[];
}

export interface EventInput {
  adults: number;
  children: number; // under 13 years old
  eventType: EventType;
  eventDate: Date;
  distanceMiles: number;
  premiumAddOn?: number; // $ per guest
  subtotalOverride?: number; // Optional revenue subtotal override (e.g., menu-based pricing)
  foodCostOverride?: number; // Optional food cost override (e.g., menu-based COGS)
  staffPayOverrides?: StaffPayOverride[]; // Event-level overrides for staff pay
  staffingProfileId?: string; // Override auto-matched staffing profile
  pricingSlot?: 'primary' | 'secondary'; // Which base price to use; derived from template eventTypes if omitted
}

// Per-staff-role override for event-level pay adjustments
export interface StaffPayOverride {
  role: ChefRole | 'assistant';
  basePayPercent: number; // % of revenue (subtotal)
  gratuitySplitPercent: number; // % of gratuity pool for this person
  capPercent: number | null; // % of (subtotal + gratuity) max pay, null = no cap
}

// ----------------------------------------------------------------------------
// Money Rules Configuration
// ----------------------------------------------------------------------------

export interface MoneyRules {
  // Pricing Section
  pricing: {
    primaryBasePrice: number;   // $ per guest — primary event type (e.g. private dinner, plated dinner)
    secondaryBasePrice: number; // $ per guest — secondary event type (e.g. buffet, custom spread)
    premiumAddOnMin: number; // $ per guest
    premiumAddOnMax: number; // $ per guest
    defaultGratuityPercent: number; // %
    childDiscountPercent: number; // % (e.g., 50 for 50% off)
    defaultDepositPercent: number; // % required deposit when booking is confirmed (e.g., 30)
  };

  // Staffing Rules
  staffing: {
    maxGuestsPerChefPrimary: number;   // guests for primary event type (default: 15)
    maxGuestsPerChefSecondary: number; // guests for secondary event type (default: 25)
    assistantRequired: boolean; // for primary events
    profiles: StaffingProfile[]; // Named staffing compositions
  };

  // Private Event Labor
  privateLabor: {
    leadChefBasePercent: number; // % of subtotal
    leadChefCapPercent: number | null; // % of (subtotal+gratuity) max, null = no cap
    overflowChefBasePercent: number; // % of subtotal (16-30 guests)
    overflowChefCapPercent: number | null; // % of (subtotal+gratuity) max, null = no cap
    fullChefBasePercent: number; // % of subtotal (31+ guests)
    fullChefCapPercent: number | null; // % of (subtotal+gratuity) max, null = no cap
    assistantBasePercent: number; // % of subtotal
    assistantCapPercent: number | null; // % of (subtotal+gratuity) max, null = no cap
    chefGratuitySplitPercent: number; // % of gratuity that goes to chefs (default: 55)
    assistantGratuitySplitPercent: number; // % of gratuity that goes to assistant (default: 45)
  };

  // Buffet Event Labor
  buffetLabor: {
    chefBasePercent: number; // % of subtotal
    chefCapPercent: number | null; // % of (subtotal+gratuity) max, null = no cap
  };

  // Cost Structure
  costs: {
    primaryFoodCostPercent: number;   // % of subtotal — primary event type
    secondaryFoodCostPercent: number; // % of subtotal — secondary event type
    suppliesCostPercent: number; // % of subtotal
    transportationStipend: number; // $ flat per event
  };

  // Distance Fees
  distance: {
    freeDistanceMiles: number; // miles (default: 25)
    baseDistanceFee: number; // $ for distance > free miles
    additionalFeePerIncrement: number; // $ per 25 miles
    incrementMiles: number; // miles (default: 25)
  };

  // Profit Distribution
  profitDistribution: {
    businessRetainedPercent: number; // % (default: 30)
    ownerDistributionPercent: number; // % (default: 70)
    ownerAEquityPercent: number; // % (default: 40)
    ownerBEquityPercent: number; // % (default: 60)
    distributionFrequency: 'monthly' | 'quarterly' | 'annual';
  };

  // Safety Limits (warnings only)
  safetyLimits: {
    maxTotalLaborPercent: number; // % of subtotal
    maxFoodCostPercent: number; // % of subtotal
    warnWhenExceeded: boolean;
  };
}

// ----------------------------------------------------------------------------
// Staffing Determination
// ----------------------------------------------------------------------------

export interface StaffMember {
  role: ChefRole | 'assistant';
  basePayPercent: number;
  capPercent: number | null;
  isOwner: boolean;
  ownerRole?: OwnerRole;
}

export interface StaffingPlan {
  chefRoles: ChefRole[];
  assistantNeeded: boolean;
  totalStaffCount: number;
  staff: StaffMember[];
  matchedProfileId?: string;
  matchedProfileName?: string;
}

// ----------------------------------------------------------------------------
// Compensation Calculations
// ----------------------------------------------------------------------------

export interface CompensationCap {
  calculatedTotal: number;
  finalPay: number;
  wasCapped: boolean;
  excessAmount: number;
}

export interface LaborCompensation {
  role: ChefRole | 'assistant';
  basePay: number;
  gratuityShare: number;
  totalCalculated: number;
  capPercent: number | null;
  capAmount: number | null; // computed dollar cap for this event
  finalPay: number;
  wasCapped: boolean;
  excessToProfit: number;
  isOwner: boolean;
  ownerRole?: OwnerRole;
}

// ----------------------------------------------------------------------------
// Event Financial Breakdown
// ----------------------------------------------------------------------------

export interface EventFinancials {
  // Revenue
  guestCount: number;
  adultCount: number;
  childCount: number;
  basePrice: number;
  premiumAddOn: number;
  subtotal: number;
  gratuity: number;
  gratuityPercent: number;
  distanceFee: number;
  totalCharged: number;

  // Costs
  foodCost: number;
  foodCostPercent: number;
  suppliesCost: number;
  transportationCost: number;
  totalCosts: number;

  // Labor
  staffingPlan: StaffingPlan;
  laborCompensation: LaborCompensation[];
  totalLaborBase: number;
  totalLaborWithGratuity: number;
  totalLaborPaid: number;
  totalExcessToProfit: number;
  laborAsPercentOfRevenue: number; // % of total revenue (subtotal + gratuity)

  // Profit
  grossProfit: number;
  retainedAmount: number;
  retainedPercent: number;
  distributionAmount: number;
  distributionPercent: number;
  ownerADistribution: number;
  ownerBDistribution: number;

  // Warnings
  warnings: string[];
}

// ----------------------------------------------------------------------------
// Owner Compensation
// ----------------------------------------------------------------------------

export interface OwnerCompensation {
  ownerRole: OwnerRole;
  laborPay: number; // What they earn as worker
  profitShare: number; // What they earn as owner
  totalCompensation: number;
  eventsWorked: number;
  averagePerEvent: number;
}

// ----------------------------------------------------------------------------
// Monthly Projections
// ----------------------------------------------------------------------------

export interface EventSummary {
  eventDate: Date;
  eventType: EventType;
  guests: number;
  revenue: number;
  costs: number;
  laborPaid: number;
  grossProfit: number;
}

export interface MonthlyProjection {
  totalRevenue: number;
  totalFoodCosts: number;
  totalLaborCosts: number;
  totalOtherCosts: number;
  grossProfit: number;
  businessRetained: number;
  totalDistributed: number;

  // Owner A
  ownerALaborTotal: number;
  ownerADistributionTotal: number;
  ownerAGrandTotal: number;

  // Owner B
  ownerBLaborTotal: number;
  ownerBDistributionTotal: number;
  ownerBGrandTotal: number;

  // Event details
  eventBreakdowns: EventSummary[];
  eventCount: number;
}

// ----------------------------------------------------------------------------
// Report Types
// ----------------------------------------------------------------------------

export interface OwnerMonthlyReport {
  // Header
  businessName: string;
  reportPeriod: string; // "January 2025"
  ownerName: string;
  ownerRole: OwnerRole;
  generatedDate: Date;
  reportNumber: string;

  // Summary
  totalLaborEarnings: number;
  totalProfitDistribution: number;
  grandTotalCompensation: number;
  numberOfEventsWorked: number;
  averagePerEvent: number;

  // Labor Details
  laborEventDetails: {
    date: Date;
    eventType: EventType;
    guests: number;
    role: string;
    basePay: number;
    gratuityShare: number;
    capApplied: boolean;
    laborPay: number;
  }[];

  // Profit Distribution
  monthlyGrossProfit: number;
  businessRetained: number;
  availableForDistribution: number;
  equitySharePercent: number;
  profitDistribution: number;

  // YTD Summary
  ytdLaborEarnings: number;
  ytdProfitDistributions: number;
  ytdTotalCompensation: number;
  ytdMonthlyAverage: number;

  // Metadata
  moneyRulesVersion: string;
  notes: string;
}

export interface ComparativeOwnerReport {
  reportPeriod: string;
  generatedDate: Date;

  ownerACompensation: OwnerCompensation;
  ownerBCompensation: OwnerCompensation;

  businessPerformance: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    distributedToOwners: number;
    retainedInBusiness: number;
    profitMargin: number;
  };

  eventParticipation: {
    ownerAEvents: number;
    ownerBEvents: number;
    totalEvents: number;
  };
}

export interface BusinessFinancialSummary {
  reportPeriod: string;
  generatedDate: Date;

  // Performance
  totalRevenue: number;
  totalCosts: {
    food: number;
    labor: number;
    supplies: number;
    transportation: number;
    total: number;
  };
  grossProfit: number;
  distributedToOwners: number;
  retainedInBusiness: number;
  profitMargin: number;

  // Event breakdown
  privateEventCount: number;
  buffetEventCount: number;
  privateEventRevenue: number;
  buffetEventRevenue: number;
  privateEventProfit: number;
  buffetEventProfit: number;
}

export interface EventDetailReport {
  eventId: string;
  eventDate: Date;
  eventType: EventType;
  guests: number;
  location: string;

  financials: EventFinancials;

  notes: string;
  adjustments: string;
}

// ----------------------------------------------------------------------------
// Report Generation Options
// ----------------------------------------------------------------------------

export interface ReportGenerationOptions {
  startDate: Date;
  endDate: Date;
  ownerFilter?: OwnerRole | 'both';
  eventTypeFilter?: EventType | 'all';
  format: 'pdf' | 'excel' | 'csv';
  emailTo?: string[];
}
