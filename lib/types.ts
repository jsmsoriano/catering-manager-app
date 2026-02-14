// ============================================================================
// HIBACHI A GO GO - TYPE DEFINITIONS
// ============================================================================

// ----------------------------------------------------------------------------
// Event Types & Basic Structures
// ----------------------------------------------------------------------------

export type EventType = 'private-dinner' | 'buffet';

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
  staffPayOverrides?: StaffPayOverride[]; // Event-level overrides for staff pay
  staffingProfileId?: string; // Override auto-matched staffing profile
}

// Per-staff-role override for event-level pay adjustments
export interface StaffPayOverride {
  role: ChefRole | 'assistant';
  basePayPercent: number; // % of revenue (subtotal)
  gratuitySplitPercent: number; // % of gratuity pool for this person
  cap: number | null; // $ max per event, null = no cap
}

// ----------------------------------------------------------------------------
// Money Rules Configuration
// ----------------------------------------------------------------------------

export interface MoneyRules {
  // Pricing Section
  pricing: {
    privateDinnerBasePrice: number; // $ per guest
    buffetBasePrice: number; // $ per guest
    premiumAddOnMin: number; // $ per guest
    premiumAddOnMax: number; // $ per guest
    defaultGratuityPercent: number; // %
    childDiscountPercent: number; // % (e.g., 50 for 50% off)
  };

  // Staffing Rules
  staffing: {
    maxGuestsPerChefPrivate: number; // guests (default: 15)
    maxGuestsPerChefBuffet: number; // guests (default: 25)
    assistantRequired: boolean; // for private events
    profiles: StaffingProfile[]; // Named staffing compositions
  };

  // Private Event Labor
  privateLabor: {
    leadChefBasePercent: number; // % of subtotal
    leadChefCap: number; // $ max per event
    overflowChefBasePercent: number; // % of subtotal (16-30 guests)
    overflowChefCap: number; // $ max per event
    fullChefBasePercent: number; // % of subtotal (31+ guests)
    fullChefCap: number; // $ max per event
    assistantBasePercent: number; // % of subtotal
    assistantCap: number | null; // $ max per event or null for no cap
    chefGratuitySplitPercent: number; // % of gratuity that goes to chefs (default: 55)
    assistantGratuitySplitPercent: number; // % of gratuity that goes to assistant (default: 45)
  };

  // Buffet Event Labor
  buffetLabor: {
    chefBasePercent: number; // % of subtotal
    chefCap: number; // $ max per event
  };

  // Cost Structure
  costs: {
    foodCostPercentPrivate: number; // % of subtotal
    foodCostPercentBuffet: number; // % of subtotal
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
  cap: number | null;
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
  cap: number | null;
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
