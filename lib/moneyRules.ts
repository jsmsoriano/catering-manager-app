import type { MoneyRules, EventInput, EventFinancials, StaffingPlan, LaborCompensation, ChefRole, StaffPayOverride } from './types';

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

export function loadRules(): MoneyRules {
  if (typeof window === 'undefined') return DEFAULT_RULES;

  const saved = localStorage.getItem('moneyRules');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Deep merge one level to preserve new default fields in nested objects
      return {
        pricing: { ...DEFAULT_RULES.pricing, ...parsed.pricing },
        staffing: { ...DEFAULT_RULES.staffing, ...parsed.staffing },
        privateLabor: { ...DEFAULT_RULES.privateLabor, ...parsed.privateLabor },
        buffetLabor: { ...DEFAULT_RULES.buffetLabor, ...parsed.buffetLabor },
        costs: { ...DEFAULT_RULES.costs, ...parsed.costs },
        distance: { ...DEFAULT_RULES.distance, ...parsed.distance },
        profitDistribution: { ...DEFAULT_RULES.profitDistribution, ...parsed.profitDistribution },
        safetyLimits: { ...DEFAULT_RULES.safetyLimits, ...parsed.safetyLimits },
      };
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
  const { adults, children, eventType, distanceMiles, premiumAddOn = 0 } = input;
  const guestCount = adults + children;

  // Pricing calculations
  const basePrice = eventType === 'private-dinner'
    ? rules.pricing.privateDinnerBasePrice
    : rules.pricing.buffetBasePrice;

  const childPrice = basePrice * (1 - rules.pricing.childDiscountPercent / 100);
  const adultTotal = adults * basePrice;
  const childTotal = children * childPrice;
  const premiumTotal = guestCount * premiumAddOn;
  const subtotal = adultTotal + childTotal + premiumTotal;

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
  const foodCostPercent = eventType === 'private-dinner'
    ? rules.costs.foodCostPercentPrivate
    : rules.costs.foodCostPercentBuffet;
  const foodCost = subtotal * (foodCostPercent / 100);
  const suppliesCost = subtotal * (rules.costs.suppliesCostPercent / 100);
  const transportationCost = rules.costs.transportationStipend;
  const totalCosts = foodCost + suppliesCost + transportationCost;

  // Staffing determination
  const staffingPlan = determineStaffing(guestCount, eventType, rules);

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

// Helper: Determine staffing needs
function determineStaffing(
  guestCount: number,
  eventType: 'private-dinner' | 'buffet',
  rules: MoneyRules
): StaffingPlan {
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
  const staff = [
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
      role: 'assistant' as 'assistant',
      basePayPercent: rules.privateLabor.assistantBasePercent,
      cap: rules.privateLabor.assistantCap ?? null,
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