import type { MoneyRules, EventInput, EventFinancials, StaffingPlan, StaffMember, LaborCompensation, ChefRole, StaffPayOverride, StaffingProfile, EventType } from './types';

export const STORAGE_KEY_RULES = "hibachi.moneyRules.v1";

export const DEFAULT_RULES: MoneyRules = {
  pricing: {
    privateDinnerBasePrice: 85,
    buffetBasePrice: 65,
    premiumAddOnMin: 5,
    premiumAddOnMax: 20,
    defaultGratuityPercent: 20,
    childDiscountPercent: 50,
  },
  staffing: {
    maxGuestsPerChefPrivate: 15,
    maxGuestsPerChefBuffet: 25,
    assistantRequired: true,
    profiles: [],
  },
  privateLabor: {
    leadChefBasePercent: 15,
    leadChefCap: 350,
    overflowChefBasePercent: 12,
    overflowChefCap: 300,
    fullChefBasePercent: 10,
    fullChefCap: 350,
    assistantBasePercent: 8,
    assistantCap: null,
    chefGratuitySplitPercent: 55,
    assistantGratuitySplitPercent: 45,
  },
  buffetLabor: {
    chefBasePercent: 12,
    chefCap: 400,
  },
  costs: {
    foodCostPercentPrivate: 18,
    foodCostPercentBuffet: 20,
    suppliesCostPercent: 7,
    transportationStipend: 50,
  },
  distance: {
    freeDistanceMiles: 20,
    baseDistanceFee: 50,
    additionalFeePerIncrement: 25,
    incrementMiles: 5,
  },
  profitDistribution: {
    businessRetainedPercent: 30,
    ownerDistributionPercent: 70,
    ownerAEquityPercent: 40,
    ownerBEquityPercent: 60,
    distributionFrequency: 'monthly',
  },
  safetyLimits: {
    maxTotalLaborPercent: 30,
    maxFoodCostPercent: 30,
    warnWhenExceeded: true,
  },
};

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

// Utility functions
export function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : min;
}

export function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Strip null/NaN/undefined values from an object so defaults aren't overridden by bad data
function stripInvalid<T extends Record<string, any>>(obj: T | undefined | null): Partial<T> {
  if (!obj || typeof obj !== 'object') return {};
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && (typeof value !== 'number' || Number.isFinite(value))) {
      clean[key] = value;
    }
  }
  return clean as Partial<T>;
}

export function loadRules(): MoneyRules {
  if (typeof window === 'undefined') return DEFAULT_RULES;

  const saved = localStorage.getItem('moneyRules');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Deep merge one level, stripping null/NaN values so defaults are used instead
      const merged = {
        pricing: { ...DEFAULT_RULES.pricing, ...stripInvalid(parsed.pricing) },
        staffing: { ...DEFAULT_RULES.staffing, ...stripInvalid(parsed.staffing) },
        privateLabor: { ...DEFAULT_RULES.privateLabor, ...stripInvalid(parsed.privateLabor) },
        buffetLabor: { ...DEFAULT_RULES.buffetLabor, ...stripInvalid(parsed.buffetLabor) },
        costs: { ...DEFAULT_RULES.costs, ...stripInvalid(parsed.costs) },
        distance: { ...DEFAULT_RULES.distance, ...stripInvalid(parsed.distance) },
        profitDistribution: { ...DEFAULT_RULES.profitDistribution, ...stripInvalid(parsed.profitDistribution) },
        safetyLimits: { ...DEFAULT_RULES.safetyLimits, ...stripInvalid(parsed.safetyLimits) },
      };
      // Ensure profiles is always a valid array
      if (!Array.isArray(merged.staffing.profiles)) {
        merged.staffing.profiles = [];
      }
      return merged;
    } catch (e) {
      console.error('Failed to load rules:', e);
      return DEFAULT_RULES;
    }
  }
  return DEFAULT_RULES;
}

export function saveRules(rules: MoneyRules): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('moneyRules', JSON.stringify(rules));
}

// Calculate event financials based on input and money rules
export function calculateEventFinancials(
  input: EventInput,
  rules: MoneyRules
): EventFinancials {
  const {
    adults,
    children,
    eventType,
    distanceMiles,
    premiumAddOn = 0,
    subtotalOverride,
    foodCostOverride,
  } = input;
  const guestCount = adults + children;

  // Pricing calculations
  const basePrice = eventType === 'private-dinner'
    ? rules.pricing.privateDinnerBasePrice
    : rules.pricing.buffetBasePrice;

  const childPrice = basePrice * (1 - rules.pricing.childDiscountPercent / 100);
  const adultTotal = adults * basePrice;
  const childTotal = children * childPrice;
  const premiumTotal = guestCount * premiumAddOn;
  const computedSubtotal = adultTotal + childTotal + premiumTotal;
  const subtotal = Number.isFinite(subtotalOverride) && subtotalOverride >= 0
    ? subtotalOverride
    : computedSubtotal;

  const gratuityPercent = rules.pricing.defaultGratuityPercent;
  const gratuity = subtotal * (gratuityPercent / 100);

  // Distance fee calculation
  let distanceFee = 0;
  if (distanceMiles > rules.distance.freeDistanceMiles) {
    distanceFee = rules.distance.baseDistanceFee;
    const extraMiles = distanceMiles - rules.distance.freeDistanceMiles;
    const increments = Math.ceil(extraMiles / rules.distance.incrementMiles);
    distanceFee += increments * rules.distance.additionalFeePerIncrement;
  }

  const totalCharged = subtotal + gratuity + distanceFee;

  // Cost calculations
  const configuredFoodCostPercent = eventType === 'private-dinner'
    ? rules.costs.foodCostPercentPrivate
    : rules.costs.foodCostPercentBuffet;
  const foodCost = Number.isFinite(foodCostOverride) && foodCostOverride >= 0
    ? foodCostOverride
    : subtotal * (configuredFoodCostPercent / 100);
  const foodCostPercent = subtotal > 0 ? (foodCost / subtotal) * 100 : 0;
  const suppliesCost = subtotal * (rules.costs.suppliesCostPercent / 100);
  const transportationCost = rules.costs.transportationStipend;
  const totalCosts = foodCost + suppliesCost + transportationCost;

  // Staffing determination
  const staffingPlan = determineStaffing(guestCount, eventType, rules, input.staffingProfileId);

  // Labor compensation calculations
  const laborCompensation = calculateLabor(
    subtotal,
    gratuity,
    eventType,
    staffingPlan,
    rules,
    input.staffPayOverrides
  );

  const totalLaborBase = laborCompensation.reduce((sum, comp) => sum + comp.basePay, 0);
  const totalLaborWithGratuity = laborCompensation.reduce((sum, comp) => sum + comp.totalCalculated, 0);
  const totalLaborPaid = laborCompensation.reduce((sum, comp) => sum + comp.finalPay, 0);
  const totalExcessToProfit = laborCompensation.reduce((sum, comp) => sum + comp.excessToProfit, 0);
  const totalRevenue = subtotal + gratuity;
  const laborAsPercentOfRevenue = totalRevenue > 0 ? (totalLaborPaid / totalRevenue) * 100 : 0;

  // Profit calculations
  const grossProfit = subtotal + gratuity - totalCosts - totalLaborPaid;
  const retainedPercent = rules.profitDistribution.businessRetainedPercent;
  const distributionPercent = rules.profitDistribution.ownerDistributionPercent;
  const retainedAmount = grossProfit * (retainedPercent / 100);
  const distributionAmount = grossProfit * (distributionPercent / 100);

  const ownerADistribution = distributionAmount * (rules.profitDistribution.ownerAEquityPercent / 100);
  const ownerBDistribution = distributionAmount * (rules.profitDistribution.ownerBEquityPercent / 100);

  // Warnings
  const warnings: string[] = [];
  if (rules.safetyLimits.warnWhenExceeded) {
    if (laborAsPercentOfRevenue > rules.safetyLimits.maxTotalLaborPercent) {
      warnings.push(`Labor cost (${laborAsPercentOfRevenue.toFixed(1)}%) exceeds maximum (${rules.safetyLimits.maxTotalLaborPercent}%) of total revenue`);
    }
    if (foodCostPercent > rules.safetyLimits.maxFoodCostPercent) {
      warnings.push(`Food cost (${foodCostPercent.toFixed(1)}%) exceeds maximum (${rules.safetyLimits.maxFoodCostPercent}%)`);
    }
  }

  return {
    // Revenue
    guestCount,
    adultCount: adults,
    childCount: children,
    basePrice,
    premiumAddOn,
    subtotal,
    gratuity,
    gratuityPercent,
    distanceFee,
    totalCharged,

    // Costs
    foodCost,
    foodCostPercent,
    suppliesCost,
    transportationCost,
    totalCosts,

    // Labor
    staffingPlan,
    laborCompensation,
    totalLaborBase,
    totalLaborWithGratuity,
    totalLaborPaid,
    totalExcessToProfit,
    laborAsPercentOfRevenue,

    // Profit
    grossProfit,
    retainedAmount,
    retainedPercent,
    distributionAmount,
    distributionPercent,
    ownerADistribution,
    ownerBDistribution,

    // Warnings
    warnings,
  };
}

// Helper: Find best-matching staffing profile
export function findMatchingProfile(
  profiles: StaffingProfile[],
  eventType: EventType,
  guestCount: number,
  staffingProfileId?: string
): StaffingProfile | undefined {
  // Explicit override by ID
  if (staffingProfileId) {
    const explicit = profiles.find(p => p.id === staffingProfileId);
    if (explicit) return explicit;
    // Profile was deleted — fall through to auto-match
  }

  // Auto-match by event type and guest count
  const candidates = profiles.filter(p => {
    const typeMatch = p.eventType === eventType || p.eventType === 'any';
    const rangeMatch = guestCount >= p.minGuests && guestCount <= p.maxGuests;
    return typeMatch && rangeMatch;
  });

  if (candidates.length === 0) return undefined;

  // Prefer exact event type match, then narrowest guest range
  candidates.sort((a, b) => {
    const aExact = a.eventType === eventType ? 0 : 1;
    const bExact = b.eventType === eventType ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return (a.maxGuests - a.minGuests) - (b.maxGuests - b.minGuests);
  });

  return candidates[0];
}

// Helper: Build staffing plan from a profile's role list
function buildStaffingPlanFromProfile(
  profile: StaffingProfile,
  rules: MoneyRules
): StaffingPlan {
  const chefRoles: ChefRole[] = [];
  let assistantNeeded = false;
  const staff: StaffMember[] = [];

  for (const role of profile.roles) {
    if (role === 'assistant') {
      assistantNeeded = true;
      staff.push({
        role: 'assistant',
        basePayPercent: rules.privateLabor.assistantBasePercent,
        cap: rules.privateLabor.assistantCap,
        isOwner: false,
      });
    } else {
      chefRoles.push(role);
      let basePayPercent: number;
      let cap: number | null;

      if (role === 'buffet') {
        basePayPercent = rules.buffetLabor.chefBasePercent;
        cap = rules.buffetLabor.chefCap;
      } else {
        switch (role) {
          case 'lead':
            basePayPercent = rules.privateLabor.leadChefBasePercent;
            cap = rules.privateLabor.leadChefCap;
            break;
          case 'overflow':
            basePayPercent = rules.privateLabor.overflowChefBasePercent;
            cap = rules.privateLabor.overflowChefCap;
            break;
          case 'full':
            basePayPercent = rules.privateLabor.fullChefBasePercent;
            cap = rules.privateLabor.fullChefCap;
            break;
          default:
            basePayPercent = 0;
            cap = 0;
        }
      }

      staff.push({ role, basePayPercent, cap, isOwner: false });
    }
  }

  return {
    chefRoles,
    assistantNeeded,
    totalStaffCount: staff.length,
    staff,
    matchedProfileId: profile.id,
    matchedProfileName: profile.name,
  };
}

// Helper: Determine staffing needs
function determineStaffing(
  guestCount: number,
  eventType: EventType,
  rules: MoneyRules,
  staffingProfileId?: string
): StaffingPlan {
  // Try profile-based staffing first
  const matchedProfile = findMatchingProfile(
    rules.staffing.profiles,
    eventType,
    guestCount,
    staffingProfileId
  );

  if (matchedProfile) {
    return buildStaffingPlanFromProfile(matchedProfile, rules);
  }

  // Fallback: hardcoded logic
  if (eventType === 'buffet') {
    const maxPerChef = rules.staffing.maxGuestsPerChefBuffet;
    const chefsNeeded = Math.ceil(guestCount / maxPerChef);
    const chefRoles: ChefRole[] = Array(chefsNeeded).fill('buffet');

    return {
      chefRoles,
      assistantNeeded: false,
      totalStaffCount: chefsNeeded,
      staff: chefRoles.map(role => ({
        role,
        basePayPercent: rules.buffetLabor.chefBasePercent,
        cap: rules.buffetLabor.chefCap,
        isOwner: false,
      })),
    };
  }

  // Private dinner staffing
  const maxPerChef = rules.staffing.maxGuestsPerChefPrivate;
  const chefRoles: ChefRole[] = [];

  if (guestCount <= maxPerChef) {
    chefRoles.push('lead');
  } else if (guestCount <= maxPerChef * 2) {
    chefRoles.push('overflow');
  } else {
    const additionalChefs = Math.ceil((guestCount - maxPerChef) / maxPerChef);
    chefRoles.push('lead');
    for (let i = 0; i < additionalChefs - 1; i++) {
      chefRoles.push('full');
    }
  }

  const assistantNeeded = rules.staffing.assistantRequired;
  const staff: StaffMember[] = [
    ...chefRoles.map(role => {
      let basePayPercent: number;
      let cap: number;

      switch (role) {
        case 'lead':
          basePayPercent = rules.privateLabor.leadChefBasePercent;
          cap = rules.privateLabor.leadChefCap;
          break;
        case 'overflow':
          basePayPercent = rules.privateLabor.overflowChefBasePercent;
          cap = rules.privateLabor.overflowChefCap;
          break;
        case 'full':
          basePayPercent = rules.privateLabor.fullChefBasePercent;
          cap = rules.privateLabor.fullChefCap;
          break;
        default:
          basePayPercent = 0;
          cap = 0;
      }

      return {
        role,
        basePayPercent,
        cap,
        isOwner: false,
      };
    }),
  ];

  if (assistantNeeded) {
    staff.push({
      role: 'assistant',
      basePayPercent: rules.privateLabor.assistantBasePercent,
      cap: rules.privateLabor.assistantCap,
      isOwner: false,
    });
  }

  return {
    chefRoles,
    assistantNeeded,
    totalStaffCount: staff.length,
    staff,
  };
}

// Helper: Calculate labor compensation
function calculateLabor(
  subtotal: number,
  gratuity: number,
  eventType: 'private-dinner' | 'buffet',
  staffingPlan: StaffingPlan,
  rules: MoneyRules,
  overrides?: StaffPayOverride[]
): LaborCompensation[] {
  const compensation: LaborCompensation[] = [];

  // Helper to find override for a specific role
  const getOverride = (role: ChefRole | 'assistant'): StaffPayOverride | undefined => {
    return overrides?.find(o => o.role === role);
  };

  if (eventType === 'buffet') {
    // Buffet: split gratuity equally among all staff (or use overrides)
    const staffCount = staffingPlan.staff.length;

    staffingPlan.staff.forEach(staff => {
      const override = getOverride(staff.role as ChefRole);
      const basePayPercent = override ? override.basePayPercent : staff.basePayPercent;
      const cap = override ? override.cap : staff.cap;

      // For buffet with overrides, use gratuitySplitPercent; otherwise equal split
      const gratuityShare = override
        ? gratuity * (override.gratuitySplitPercent / 100)
        : gratuity / staffCount;

      const basePay = subtotal * (basePayPercent / 100);
      const totalCalculated = basePay + gratuityShare;
      const finalPay = cap && totalCalculated > cap ? cap : totalCalculated;
      const wasCapped = cap ? totalCalculated > cap : false;
      const excessToProfit = wasCapped ? totalCalculated - finalPay : 0;

      compensation.push({
        role: staff.role as ChefRole,
        basePay,
        gratuityShare,
        totalCalculated,
        cap,
        finalPay,
        wasCapped,
        excessToProfit,
        isOwner: staff.isOwner,
        ownerRole: staff.ownerRole,
      });
    });
  } else {
    // Private dinner: gratuity split using configurable percentages
    const chefSplitPercent = rules.privateLabor.chefGratuitySplitPercent;
    const assistantSplitPercent = rules.privateLabor.assistantGratuitySplitPercent;

    staffingPlan.staff.forEach(staff => {
      const override = getOverride(staff.role as ChefRole | 'assistant');
      const basePayPercent = override ? override.basePayPercent : staff.basePayPercent;
      const cap = override ? override.cap : staff.cap;

      let gratuityShare = 0;
      if (override) {
        // Use override's explicit gratuity split
        gratuityShare = gratuity * (override.gratuitySplitPercent / 100);
      } else if (staff.role === 'assistant') {
        gratuityShare = gratuity * (assistantSplitPercent / 100);
      } else {
        const chefCount = staffingPlan.chefRoles.length;
        gratuityShare = (gratuity * (chefSplitPercent / 100)) / chefCount;
      }

      const basePay = subtotal * (basePayPercent / 100);
      const totalCalculated = basePay + gratuityShare;
      const finalPay = cap && totalCalculated > cap ? cap : totalCalculated;
      const wasCapped = cap ? totalCalculated > cap : false;
      const excessToProfit = wasCapped ? totalCalculated - finalPay : 0;

      compensation.push({
        role: staff.role as ChefRole | 'assistant',
        basePay,
        gratuityShare,
        totalCalculated,
        cap,
        finalPay,
        wasCapped,
        excessToProfit,
        isOwner: staff.isOwner,
        ownerRole: staff.ownerRole,
      });
    });
  }

  return compensation;
}