import type { MoneyRules, EventInput, EventFinancials, StaffingPlan, StaffMember, LaborCompensation, ChefRole, StaffPayOverride, StaffingProfile, EventType } from './types';

export const STORAGE_KEY_RULES = "catering.moneyRules.v1";
const LEGACY_STORAGE_KEY_RULES = "hibachi.moneyRules.v1";

export const DEFAULT_RULES: MoneyRules = {
  pricing: {
    primaryBasePrice: 60,
    secondaryBasePrice: 32,
    premiumAddOnMin: 5,
    premiumAddOnMax: 20,
    proteinAddOns: [
      { protein: 'chicken', label: 'Chicken', pricePerPerson: 6 },
      { protein: 'filet-mignon', label: 'Filet Mignon', pricePerPerson: 10 },
      { protein: 'scallops', label: 'Scallops', pricePerPerson: 8 },
    ],
    defaultGratuityPercent: 20,
    childDiscountPercent: 50,
    defaultDepositPercent: 30,
  },
  staffing: {
    maxGuestsPerChefPrimary: 15,
    maxGuestsPerChefSecondary: 25,
    assistantRequired: true,
    profiles: [],
  },
  privateLabor: {
    leadChefBasePercent: 15,
    leadChefCapPercent: null,
    fullChefBasePercent: 10,
    fullChefCapPercent: null,
    assistantBasePercent: 8,
    assistantCapPercent: null,
    chefGratuitySplitPercent: 55,
    assistantGratuitySplitPercent: 45,
  },
  buffetLabor: {
    chefBasePercent: 12,
    chefCapPercent: null,
  },
  costs: {
    primaryFoodCostPercent: 18,
    secondaryFoodCostPercent: 20,
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
    owners: [
      { id: 'owner-a', name: 'Owner A', equityPercent: 40 },
      { id: 'owner-b', name: 'Owner B', equityPercent: 60 },
    ],
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

/** One-time migration of old field names to new generic names in a parsed rules object. */
function migrateLegacyRuleFields(parsed: Record<string, any>): void {
  // Migrate old localStorage key (hibachi-specific) to new key
  // (handled in loadRules before this is called)

  // pricing: privateDinnerBasePrice → primaryBasePrice, buffetBasePrice → secondaryBasePrice
  if (parsed.pricing) {
    if (parsed.pricing.privateDinnerBasePrice !== undefined && parsed.pricing.primaryBasePrice === undefined) {
      parsed.pricing.primaryBasePrice = parsed.pricing.privateDinnerBasePrice;
      delete parsed.pricing.privateDinnerBasePrice;
    }
    if (parsed.pricing.buffetBasePrice !== undefined && parsed.pricing.secondaryBasePrice === undefined) {
      parsed.pricing.secondaryBasePrice = parsed.pricing.buffetBasePrice;
      delete parsed.pricing.buffetBasePrice;
    }
  }
  // staffing: maxGuestsPerChefPrivate → maxGuestsPerChefPrimary, etc.
  if (parsed.staffing) {
    if (parsed.staffing.maxGuestsPerChefPrivate !== undefined && parsed.staffing.maxGuestsPerChefPrimary === undefined) {
      parsed.staffing.maxGuestsPerChefPrimary = parsed.staffing.maxGuestsPerChefPrivate;
      delete parsed.staffing.maxGuestsPerChefPrivate;
    }
    if (parsed.staffing.maxGuestsPerChefBuffet !== undefined && parsed.staffing.maxGuestsPerChefSecondary === undefined) {
      parsed.staffing.maxGuestsPerChefSecondary = parsed.staffing.maxGuestsPerChefBuffet;
      delete parsed.staffing.maxGuestsPerChefBuffet;
    }
  }
  // costs: foodCostPercentPrivate → primaryFoodCostPercent, etc.
  if (parsed.costs) {
    if (parsed.costs.foodCostPercentPrivate !== undefined && parsed.costs.primaryFoodCostPercent === undefined) {
      parsed.costs.primaryFoodCostPercent = parsed.costs.foodCostPercentPrivate;
      delete parsed.costs.foodCostPercentPrivate;
    }
    if (parsed.costs.foodCostPercentBuffet !== undefined && parsed.costs.secondaryFoodCostPercent === undefined) {
      parsed.costs.secondaryFoodCostPercent = parsed.costs.foodCostPercentBuffet;
      delete parsed.costs.foodCostPercentBuffet;
    }
  }
  // Remove overflow chef role (deprecated)
  if (parsed.privateLabor) {
    delete (parsed.privateLabor as Record<string, unknown>).overflowChefBasePercent;
    delete (parsed.privateLabor as Record<string, unknown>).overflowChefCapPercent;
  }
}

export function loadRules(): MoneyRules {
  if (typeof window === 'undefined') return DEFAULT_RULES;

  // Migrate legacy storage key (hibachi-specific) → generic key
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_RULES);
  if (legacyRaw && !localStorage.getItem('moneyRules')) {
    localStorage.setItem('moneyRules', legacyRaw);
    localStorage.removeItem(LEGACY_STORAGE_KEY_RULES);
  }

  const saved = localStorage.getItem('moneyRules');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // One-time field name migration (old hibachi-specific names → generic)
      migrateLegacyRuleFields(parsed);
      // Deep merge one level, stripping null/NaN values so defaults are used instead
      const pd = { ...DEFAULT_RULES.profitDistribution, ...stripInvalid(parsed.profitDistribution) };
      // Migrate legacy Owner A/B to owners array if not present
      if (!Array.isArray(parsed.profitDistribution?.owners) || parsed.profitDistribution.owners.length === 0) {
        pd.owners = [
          { id: 'owner-a', name: 'Owner A', equityPercent: pd.ownerAEquityPercent ?? 40 },
          { id: 'owner-b', name: 'Owner B', equityPercent: pd.ownerBEquityPercent ?? 60 },
        ];
      } else {
        pd.owners = parsed.profitDistribution.owners;
      }
      const merged = {
        pricing: { ...DEFAULT_RULES.pricing, ...stripInvalid(parsed.pricing) },
        staffing: { ...DEFAULT_RULES.staffing, ...stripInvalid(parsed.staffing) },
        privateLabor: { ...DEFAULT_RULES.privateLabor, ...stripInvalid(parsed.privateLabor) },
        buffetLabor: { ...DEFAULT_RULES.buffetLabor, ...stripInvalid(parsed.buffetLabor) },
        costs: { ...DEFAULT_RULES.costs, ...stripInvalid(parsed.costs) },
        distance: { ...DEFAULT_RULES.distance, ...stripInvalid(parsed.distance) },
        profitDistribution: pd,
        safetyLimits: { ...DEFAULT_RULES.safetyLimits, ...stripInvalid(parsed.safetyLimits) },
      };
      // Ensure profiles is always a valid array
      if (!Array.isArray(merged.staffing.profiles)) {
        merged.staffing.profiles = [];
      }
      // Ensure proteinAddOns is a valid array of { protein, label, pricePerPerson }
      if (!Array.isArray(merged.pricing.proteinAddOns)) {
        merged.pricing.proteinAddOns = DEFAULT_RULES.pricing.proteinAddOns;
      } else {
        merged.pricing.proteinAddOns = merged.pricing.proteinAddOns
          .filter((x) => x && typeof x.protein === 'string' && typeof x.label === 'string' && Number.isFinite(x.pricePerPerson))
          .map((x) => ({ protein: x.protein, label: x.label, pricePerPerson: Number(x.pricePerPerson) }));
        if (merged.pricing.proteinAddOns.length === 0) {
          merged.pricing.proteinAddOns = DEFAULT_RULES.pricing.proteinAddOns;
        }
      }
      return merged;
    } catch (e) {
      console.error('Failed to load rules:', e);
      return DEFAULT_RULES;
    }
  }
  return DEFAULT_RULES;
}

/** Merge template overrides onto a rules object (one level deep for top-level keys). */
export function mergeRulesOverrides(
  rules: MoneyRules,
  overrides: Partial<MoneyRules> | undefined
): MoneyRules {
  if (!overrides || typeof overrides !== 'object') return rules;
  const o = stripInvalid(overrides) as Partial<MoneyRules>;
  return {
    pricing: { ...rules.pricing, ...stripInvalid(o.pricing) },
    staffing: {
      ...rules.staffing,
      ...stripInvalid(o.staffing),
      profiles: Array.isArray((o.staffing as any)?.profiles) ? (o.staffing as any).profiles : rules.staffing.profiles,
    },
    privateLabor: { ...rules.privateLabor, ...stripInvalid(o.privateLabor) },
    buffetLabor: { ...rules.buffetLabor, ...stripInvalid(o.buffetLabor) },
    costs: { ...rules.costs, ...stripInvalid(o.costs) },
    distance: { ...rules.distance, ...stripInvalid(o.distance) },
    profitDistribution: { ...rules.profitDistribution, ...stripInvalid(o.profitDistribution) },
    safetyLimits: { ...rules.safetyLimits, ...stripInvalid(o.safetyLimits) },
  };
}

export function saveRules(rules: MoneyRules): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('moneyRules', JSON.stringify(rules));
  window.dispatchEvent(new Event('moneyRulesUpdated'));
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

  // Pricing calculations — use pricingSlot from input if provided, else fall back to
  // legacy 'private-dinner' detection so existing hibachi bookings keep correct pricing.
  const slot = input.pricingSlot ?? (eventType === 'private-dinner' ? 'primary' : 'secondary');
  const basePrice = slot === 'primary'
    ? rules.pricing.primaryBasePrice
    : rules.pricing.secondaryBasePrice;

  const childPrice = basePrice * (1 - rules.pricing.childDiscountPercent / 100);
  const adultTotal = adults * basePrice;
  const childTotal = children * childPrice;
  const premiumTotal = guestCount * premiumAddOn;
  const computedSubtotal = adultTotal + childTotal + premiumTotal;
  const normalizedSubtotalOverride =
    typeof subtotalOverride === 'number' && Number.isFinite(subtotalOverride) && subtotalOverride >= 0
      ? subtotalOverride
      : undefined;
  const subtotal = normalizedSubtotalOverride ?? computedSubtotal;

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
  const configuredFoodCostPercent = slot === 'primary'
    ? rules.costs.primaryFoodCostPercent
    : rules.costs.secondaryFoodCostPercent;
  const normalizedFoodCostOverride =
    typeof foodCostOverride === 'number' && Number.isFinite(foodCostOverride) && foodCostOverride >= 0
      ? foodCostOverride
      : undefined;
  const foodCost = normalizedFoodCostOverride ?? subtotal * (configuredFoodCostPercent / 100);
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

  const ownersList = rules.profitDistribution.owners && rules.profitDistribution.owners.length > 0
    ? rules.profitDistribution.owners
    : [
        { id: 'owner-a', name: 'Owner A', equityPercent: rules.profitDistribution.ownerAEquityPercent },
        { id: 'owner-b', name: 'Owner B', equityPercent: rules.profitDistribution.ownerBEquityPercent },
      ];
  const ownerDistributions = ownersList.map((o) => ({
    ownerId: o.id,
    ownerName: o.name,
    amount: distributionAmount * (o.equityPercent / 100),
  }));
  const ownerADistribution = ownerDistributions[0]?.amount ?? 0;
  const ownerBDistribution = ownerDistributions[1]?.amount ?? 0;

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
    ownerDistributions,
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
        capPercent: rules.privateLabor.assistantCapPercent,
        isOwner: false,
      });
    } else {
      // Map legacy 'overflow' to 'full' for saved profiles
      const chefRole: ChefRole = (role as string) === 'overflow' ? 'full' : (role as ChefRole);
      chefRoles.push(chefRole);
      let basePayPercent: number;
      let capPercent: number | null;

      if (chefRole === 'buffet') {
        basePayPercent = rules.buffetLabor.chefBasePercent;
        capPercent = rules.buffetLabor.chefCapPercent;
      } else {
        switch (chefRole) {
          case 'lead':
            basePayPercent = rules.privateLabor.leadChefBasePercent;
            capPercent = rules.privateLabor.leadChefCapPercent;
            break;
          case 'full':
            basePayPercent = rules.privateLabor.fullChefBasePercent;
            capPercent = rules.privateLabor.fullChefCapPercent;
            break;
          default:
            basePayPercent = 0;
            capPercent = null;
        }
      }

      staff.push({ role: chefRole, basePayPercent, capPercent, isOwner: false });
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

  // Fallback: rule-based logic — secondary event type uses simpler chef-only staffing
  // (historically 'buffet'; now driven by pricingSlot for non-hibachi templates)
  if (eventType === 'buffet' || eventType === 'secondary') {
    const maxPerChef = rules.staffing.maxGuestsPerChefSecondary;
    const chefsNeeded = Math.ceil(guestCount / maxPerChef);
    const chefRoles: ChefRole[] = Array(chefsNeeded).fill('buffet');

    return {
      chefRoles,
      assistantNeeded: false,
      totalStaffCount: chefsNeeded,
      staff: chefRoles.map(role => ({
        role,
        basePayPercent: rules.buffetLabor.chefBasePercent,
        capPercent: rules.buffetLabor.chefCapPercent,
        isOwner: false,
      })),
    };
  }

  // Primary event type staffing: lead required; full chef(s) when over threshold
  const maxPerChef = rules.staffing.maxGuestsPerChefPrimary;
  const chefRoles: ChefRole[] = [];

  if (guestCount <= maxPerChef) {
    chefRoles.push('lead');
  } else {
    chefRoles.push('lead');
    const additionalChefs = Math.ceil((guestCount - maxPerChef) / maxPerChef);
    for (let i = 0; i < additionalChefs; i++) {
      chefRoles.push('full');
    }
  }

  const assistantNeeded = rules.staffing.assistantRequired;
  const staff: StaffMember[] = [
    ...chefRoles.map(role => {
      let basePayPercent: number;
      let capPercent: number | null;

      switch (role) {
        case 'lead':
          basePayPercent = rules.privateLabor.leadChefBasePercent;
          capPercent = rules.privateLabor.leadChefCapPercent;
          break;
        case 'full':
          basePayPercent = rules.privateLabor.fullChefBasePercent;
          capPercent = rules.privateLabor.fullChefCapPercent;
          break;
        default:
          basePayPercent = 0;
          capPercent = null;
      }

      return {
        role,
        basePayPercent,
        capPercent,
        isOwner: false,
      };
    }),
  ];

  if (assistantNeeded) {
    staff.push({
      role: 'assistant',
      basePayPercent: rules.privateLabor.assistantBasePercent,
      capPercent: rules.privateLabor.assistantCapPercent,
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
  eventType: string,
  staffingPlan: StaffingPlan,
  rules: MoneyRules,
  overrides?: StaffPayOverride[]
): LaborCompensation[] {
  const compensation: LaborCompensation[] = [];
  const totalRevenue = subtotal + gratuity;

  // Helper to find override for a specific role
  const getOverride = (role: ChefRole | 'assistant'): StaffPayOverride | undefined => {
    return overrides?.find(o => o.role === role);
  };

  // Cap computation: % of (subtotal + gratuity), null = no cap
  const computeCap = (capPercent: number | null): number | null => {
    if (!capPercent || capPercent <= 0) return null;
    return totalRevenue * (capPercent / 100);
  };

  if (eventType === 'buffet') {
    // Buffet: split gratuity equally among all staff (or use overrides)
    const staffCount = staffingPlan.staff.length;

    staffingPlan.staff.forEach(staff => {
      const override = getOverride(staff.role as ChefRole);
      const basePayPercent = override ? override.basePayPercent : staff.basePayPercent;
      const capPercent = override ? override.capPercent : staff.capPercent;
      const capAmount = computeCap(capPercent);

      // For buffet with overrides, use gratuitySplitPercent; otherwise equal split
      const gratuityShare = override
        ? gratuity * (override.gratuitySplitPercent / 100)
        : gratuity / staffCount;

      const basePay = subtotal * (basePayPercent / 100);
      const totalCalculated = basePay + gratuityShare;
      const finalPay = capAmount !== null && totalCalculated > capAmount ? capAmount : totalCalculated;
      const wasCapped = capAmount !== null && totalCalculated > capAmount;
      const excessToProfit = wasCapped ? totalCalculated - finalPay : 0;

      compensation.push({
        role: staff.role as ChefRole,
        basePay,
        gratuityShare,
        totalCalculated,
        capPercent,
        capAmount,
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
      const capPercent = override ? override.capPercent : staff.capPercent;
      const capAmount = computeCap(capPercent);

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
      const finalPay = capAmount !== null && totalCalculated > capAmount ? capAmount : totalCalculated;
      const wasCapped = capAmount !== null && totalCalculated > capAmount;
      const excessToProfit = wasCapped ? totalCalculated - finalPay : 0;

      compensation.push({
        role: staff.role as ChefRole | 'assistant',
        basePay,
        gratuityShare,
        totalCalculated,
        capPercent,
        capAmount,
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