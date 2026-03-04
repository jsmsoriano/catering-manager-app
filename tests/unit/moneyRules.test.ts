import {
  calculatePricing,
  calculateCosts,
  calculateProfit,
  calculateStaffing,
  calculateLaborCompensation,
  calculateEventFinancials,
  mergeRulesOverrides,
  findMatchingProfile,
  DEFAULT_RULES,
  clamp,
  toNumber,
  formatCurrency,
} from '@/lib/moneyRules';
import type { MoneyRules, EventInput, StaffingProfile } from '@/lib/types';

// ─── Shared test fixture ──────────────────────────────────────────────────────

/** Minimal MoneyRules matching DEFAULT_RULES shape — used as a stable baseline. */
const rules: MoneyRules = DEFAULT_RULES;

function makeEventInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    adults: 40,
    children: 10,
    eventType: 'private-dinner',
    eventDate: new Date('2026-06-15'),
    distanceMiles: 10,
    ...overrides,
  };
}

// ─── calculatePricing ────────────────────────────────────────────────────────

describe('calculatePricing', () => {
  it('uses primaryBasePrice for private-dinner event type (slot: primary)', () => {
    // 10 adults, 0 children, private-dinner, no distance fee
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 0 });
    const result = calculatePricing(input, rules);

    expect(result.slot).toBe('primary');
    expect(result.basePrice).toBe(rules.pricing.primaryBasePrice); // 65
  });

  it('uses secondaryBasePrice when pricingSlot is explicitly "secondary"', () => {
    const input = makeEventInput({ pricingSlot: 'secondary', adults: 20, children: 0, distanceMiles: 0 });
    const result = calculatePricing(input, rules);

    expect(result.slot).toBe('secondary');
    expect(result.basePrice).toBe(rules.pricing.secondaryBasePrice); // 32
  });

  it('computes subtotal correctly for 50 guests (40 adults + 10 children) at $65 primary', () => {
    // adults: 40 × $65 = $2600
    // children: 10 × $65 × (1 - 50/100) = 10 × $32.50 = $325
    // subtotal = $2600 + $325 = $2925
    const input = makeEventInput({ adults: 40, children: 10, distanceMiles: 0 });
    const result = calculatePricing(input, rules);

    expect(result.subtotal).toBeCloseTo(2925, 2);
  });

  it('applies child discount of 50% off base price', () => {
    const input = makeEventInput({ adults: 0, children: 10, distanceMiles: 0 });
    const result = calculatePricing(input, rules);
    const expectedChildPrice = rules.pricing.primaryBasePrice * 0.5; // $32.50
    expect(result.subtotal).toBeCloseTo(10 * expectedChildPrice, 2);
  });

  it('computes gratuity as 20% of subtotal', () => {
    const input = makeEventInput({ adults: 40, children: 10, distanceMiles: 0 });
    const result = calculatePricing(input, rules);

    expect(result.gratuityPercent).toBe(20);
    expect(result.gratuity).toBeCloseTo(result.subtotal * 0.20, 2);
  });

  it('totalCharged = subtotal + gratuity when within free distance', () => {
    const input = makeEventInput({ adults: 40, children: 10, distanceMiles: 5 });
    const result = calculatePricing(input, rules);

    expect(result.distanceFee).toBe(0);
    expect(result.totalCharged).toBeCloseTo(result.subtotal + result.gratuity, 2);
  });

  it('adds distance fee when beyond freeDistanceMiles (20 miles)', () => {
    // 25 miles → 5 miles over free threshold → ceil(5/5) = 1 increment
    // distanceFee = $50 base + 1 × $25 = $75
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 25 });
    const result = calculatePricing(input, rules);

    expect(result.distanceFee).toBe(75);
    expect(result.totalCharged).toBeCloseTo(result.subtotal + result.gratuity + 75, 2);
  });

  it('distance fee increments correctly for multiple 5-mile bands', () => {
    // 40 miles → 20 miles over → ceil(20/5) = 4 increments
    // distanceFee = $50 + 4 × $25 = $150
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 40 });
    const result = calculatePricing(input, rules);

    expect(result.distanceFee).toBe(150);
  });

  it('no distance fee exactly at freeDistanceMiles boundary (20 miles)', () => {
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 20 });
    const result = calculatePricing(input, rules);

    expect(result.distanceFee).toBe(0);
  });

  it('premiumAddOn adds $ per guest to subtotal', () => {
    // 10 adults, 0 children, $5 premium → subtotal = 10 × ($65 + $5) = $700
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 0, premiumAddOn: 5 });
    const result = calculatePricing(input, rules);

    // adults: 10 × 65 = 650; premium: 10 guests × 5 = 50 → 700
    expect(result.subtotal).toBeCloseTo(700, 2);
  });

  it('subtotalOverride replaces computed subtotal when valid', () => {
    const input = makeEventInput({ adults: 40, children: 10, distanceMiles: 0, subtotalOverride: 5000 });
    const result = calculatePricing(input, rules);

    expect(result.subtotal).toBe(5000);
    expect(result.gratuity).toBeCloseTo(5000 * 0.20, 2);
  });

  it('ignores subtotalOverride when negative', () => {
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 0, subtotalOverride: -100 });
    const computedResult = calculatePricing(makeEventInput({ adults: 10, children: 0, distanceMiles: 0 }), rules);
    const result = calculatePricing(input, rules);

    expect(result.subtotal).toBeCloseTo(computedResult.subtotal, 2);
  });

  it('handles 0 guests without crashing', () => {
    const input = makeEventInput({ adults: 0, children: 0, distanceMiles: 0 });
    const result = calculatePricing(input, rules);

    expect(result.subtotal).toBe(0);
    expect(result.gratuity).toBe(0);
    expect(result.totalCharged).toBe(0);
  });

  it('hibachi buffet scenario: 50 guests at secondary price ($32)', () => {
    // secondaryBasePrice = $32; children discount 50% → childPrice $16
    // 45 adults × $32 = $1440; 5 children × $16 = $80 → subtotal $1520
    const input = makeEventInput({ adults: 45, children: 5, eventType: 'buffet', pricingSlot: 'secondary', distanceMiles: 0 });
    const result = calculatePricing(input, rules);

    expect(result.slot).toBe('secondary');
    expect(result.basePrice).toBe(32);
    expect(result.subtotal).toBeCloseTo(45 * 32 + 5 * 16, 2);
    expect(result.gratuity).toBeCloseTo(result.subtotal * 0.20, 2);
  });
});

// ─── calculateCosts ──────────────────────────────────────────────────────────

describe('calculateCosts', () => {
  it('uses primary food cost percent (18%) for "primary" slot', () => {
    // subtotal = $2925, slot = primary → food cost = $2925 × 0.18 = $526.50
    const result = calculateCosts(2925, 'primary', undefined, rules);

    expect(result.foodCost).toBeCloseTo(2925 * 0.18, 2);
    expect(result.foodCostPercent).toBeCloseTo(18, 1);
  });

  it('uses secondary food cost percent (20%) for "secondary" slot', () => {
    const result = calculateCosts(1600, 'secondary', undefined, rules);

    expect(result.foodCost).toBeCloseTo(1600 * 0.20, 2);
    expect(result.foodCostPercent).toBeCloseTo(20, 1);
  });

  it('computes supplies cost at 7% of subtotal', () => {
    const result = calculateCosts(2000, 'primary', undefined, rules);

    expect(result.suppliesCost).toBeCloseTo(2000 * 0.07, 2);
  });

  it('includes flat transportation stipend ($50)', () => {
    const result = calculateCosts(2000, 'primary', undefined, rules);

    expect(result.transportationCost).toBe(50);
  });

  it('totalCosts = foodCost + suppliesCost + transportationCost', () => {
    const result = calculateCosts(2925, 'primary', undefined, rules);

    expect(result.totalCosts).toBeCloseTo(
      result.foodCost + result.suppliesCost + result.transportationCost,
      2
    );
  });

  it('respects foodCostOverride when valid', () => {
    const result = calculateCosts(2000, 'primary', 999, rules);

    expect(result.foodCost).toBe(999);
    // foodCostPercent should reflect override vs subtotal
    expect(result.foodCostPercent).toBeCloseTo((999 / 2000) * 100, 2);
  });

  it('ignores foodCostOverride when negative', () => {
    const defaultResult = calculateCosts(2000, 'primary', undefined, rules);
    const result = calculateCosts(2000, 'primary', -50, rules);

    expect(result.foodCost).toBeCloseTo(defaultResult.foodCost, 2);
  });

  it('returns foodCostPercent of 0 when subtotal is 0', () => {
    const result = calculateCosts(0, 'primary', undefined, rules);

    expect(result.foodCostPercent).toBe(0);
    expect(result.foodCost).toBe(0);
    expect(result.suppliesCost).toBe(0);
    expect(result.transportationCost).toBe(50); // flat stipend still applies
  });
});

// ─── calculateStaffing ───────────────────────────────────────────────────────

describe('calculateStaffing', () => {
  describe('hibachi private-dinner path', () => {
    it('assigns lead chef only for small party (≤ 18 guests)', () => {
      // getHibachiStaffingRecommendation: guestCount <= 18 → 1 chef, 0 assistants
      const plan = calculateStaffing(15, 'private-dinner', rules);

      expect(plan.chefRoles[0]).toBe('lead');
      expect(plan.chefRoles.length).toBe(1);
      expect(plan.assistantNeeded).toBe(false);
    });

    it('scales to 4 chefs for 50 guests (private-dinner)', () => {
      // ceil(50/15) = 4 → Math.max(2, 4) = 4 chefs; 50 >= 30 → 1 assistant
      const plan = calculateStaffing(50, 'private-dinner', rules);

      expect(plan.chefRoles.length).toBe(4);
      expect(plan.chefRoles[0]).toBe('lead');
      expect(plan.chefRoles.slice(1).every(r => r === 'full')).toBe(true);
      expect(plan.assistantNeeded).toBe(true);
      expect(plan.totalStaffCount).toBe(5); // 4 chefs + 1 assistant
    });

    it('assigns assistant when guest count reaches privateDinnerAssistantThreshold (30)', () => {
      const planBelow = calculateStaffing(29, 'private-dinner', rules);
      const planAtThreshold = calculateStaffing(30, 'private-dinner', rules);

      expect(planBelow.assistantNeeded).toBe(false);
      expect(planAtThreshold.assistantNeeded).toBe(true);
    });

    it('staff array entries have correct role and pay percentages', () => {
      const plan = calculateStaffing(50, 'private-dinner', rules);

      const lead = plan.staff.find(s => s.role === 'lead');
      const full = plan.staff.find(s => s.role === 'full');
      const assistant = plan.staff.find(s => s.role === 'assistant');

      expect(lead?.basePayPercent).toBe(rules.privateLabor.leadChefBasePercent); // 15
      expect(full?.basePayPercent).toBe(rules.privateLabor.fullChefBasePercent); // 10
      expect(assistant?.basePayPercent).toBe(rules.privateLabor.assistantBasePercent); // 8
    });

    it('serviceStyleLabel is "Hibachi Private Dinner"', () => {
      const plan = calculateStaffing(20, 'private-dinner', rules);

      expect(plan.serviceStyleLabel).toBe('Hibachi Private Dinner');
    });
  });

  describe('hibachi buffet path', () => {
    it('assigns 2 buffet chefs for 50 guests (at large-party threshold)', () => {
      // guestCount >= buffetLargePartyThreshold (50) → Math.max(2, ceil(50/25)) = Math.max(2,2) = 2
      const plan = calculateStaffing(50, 'buffet', rules);

      expect(plan.chefRoles.length).toBe(2);
      expect(plan.chefRoles.every(r => r === 'buffet')).toBe(true);
      expect(plan.assistantNeeded).toBe(false);
      expect(plan.totalStaffCount).toBe(2);
    });

    it('assigns 1 chef for small buffet (under large-party threshold)', () => {
      // guestCount=20, < 50 → Math.max(1, ceil(20/25)) = Math.max(1,1) = 1
      const plan = calculateStaffing(20, 'buffet', rules);

      expect(plan.chefRoles.length).toBe(1);
      expect(plan.chefRoles[0]).toBe('buffet');
    });

    it('scales to 3 buffet chefs for 75 guests (above threshold)', () => {
      // guestCount=75, >= 50 → Math.max(2, ceil(75/25)) = Math.max(2,3) = 3
      const plan = calculateStaffing(75, 'buffet', rules);

      expect(plan.chefRoles.length).toBe(3);
    });

    it('buffet chef staff entries use buffetLabor.chefBasePercent', () => {
      const plan = calculateStaffing(50, 'buffet', rules);

      plan.staff.forEach(s => {
        expect(s.basePayPercent).toBe(rules.buffetLabor.chefBasePercent); // 12
      });
    });

    it('serviceStyleLabel is "Hibachi Buffet"', () => {
      const plan = calculateStaffing(50, 'buffet', rules);

      expect(plan.serviceStyleLabel).toBe('Hibachi Buffet');
    });
  });

  describe('generic non-hibachi primary event type', () => {
    it('assigns lead chef only when guests ≤ maxGuestsPerChefPrimary (15)', () => {
      // 'catering' → getHibachiServiceFormat returns 'other' → hibachiRecommendation null
      // → primary staffing: guestCount(10) <= 15 → ['lead']
      const plan = calculateStaffing(10, 'catering', rules);

      expect(plan.chefRoles).toEqual(['lead']);
    });

    it('adds full chef for every additional 15 guests above the primary threshold', () => {
      // 30 guests → ceil((30-15)/15) = 1 additional full chef → [lead, full]
      const plan = calculateStaffing(30, 'catering', rules);

      expect(plan.chefRoles).toEqual(['lead', 'full']);
    });

    it('requires assistant for primary events when assistantRequired is true', () => {
      const plan = calculateStaffing(10, 'catering', rules);

      expect(rules.staffing.assistantRequired).toBe(true);
      expect(plan.assistantNeeded).toBe(true);
      expect(plan.staff.some(s => s.role === 'assistant')).toBe(true);
    });

    it('totalStaffCount equals chefs + assistant for primary events', () => {
      // 10 guests → 1 lead + 1 assistant = 2 total
      const plan = calculateStaffing(10, 'catering', rules);

      expect(plan.totalStaffCount).toBe(plan.chefRoles.length + (plan.assistantNeeded ? 1 : 0));
    });
  });

  describe('generic secondary event type fallback', () => {
    it('uses maxGuestsPerChefSecondary (25) for "secondary" event type', () => {
      // 'secondary' → not hibachi path, not 'buffet', is 'secondary' → secondary fallback
      // 50 guests / 25 per chef = 2 chefs
      const plan = calculateStaffing(50, 'secondary', rules);

      expect(plan.chefRoles.length).toBe(2);
      expect(plan.chefRoles.every(r => r === 'buffet')).toBe(true);
      expect(plan.assistantNeeded).toBe(false);
    });
  });

  describe('staffing profiles', () => {
    it('uses named profile when it matches event type and guest range', () => {
      const profile: StaffingProfile = {
        id: 'prof-1',
        name: 'Small Private',
        eventType: 'catering',
        minGuests: 1,
        maxGuests: 20,
        roles: ['lead', 'assistant'],
      };
      const rulesWithProfile: MoneyRules = {
        ...rules,
        staffing: { ...rules.staffing, profiles: [profile] },
      };

      const plan = calculateStaffing(10, 'catering', rulesWithProfile);

      expect(plan.matchedProfileId).toBe('prof-1');
      expect(plan.matchedProfileName).toBe('Small Private');
      expect(plan.chefRoles).toEqual(['lead']);
      expect(plan.assistantNeeded).toBe(true);
    });

    it('falls back to default logic when no profile matches guest count range', () => {
      const profile: StaffingProfile = {
        id: 'prof-2',
        name: 'Large Party',
        eventType: 'catering',
        minGuests: 50,
        maxGuests: 200,
        roles: ['lead', 'full', 'assistant'],
      };
      const rulesWithProfile: MoneyRules = {
        ...rules,
        staffing: { ...rules.staffing, profiles: [profile] },
      };

      // 10 guests → below profile minimum (50) → no match → default logic
      const plan = calculateStaffing(10, 'catering', rulesWithProfile);

      expect(plan.matchedProfileId).toBeUndefined();
    });

    it('selects profile by explicit staffingProfileId regardless of guest count', () => {
      const profile: StaffingProfile = {
        id: 'prof-vip',
        name: 'VIP Setup',
        eventType: 'catering',
        minGuests: 100,
        maxGuests: 200,
        roles: ['lead', 'full', 'full', 'assistant'],
      };
      const rulesWithProfile: MoneyRules = {
        ...rules,
        staffing: { ...rules.staffing, profiles: [profile] },
      };

      // Only 10 guests, but profile is explicitly requested by id
      const plan = calculateStaffing(10, 'catering', rulesWithProfile, 'prof-vip');

      expect(plan.matchedProfileId).toBe('prof-vip');
      expect(plan.chefRoles.length).toBe(3); // lead + full + full
    });
  });

  describe('edge cases', () => {
    it('handles 0 guests without throwing', () => {
      // hibachiService returns null for guestCount <= 0 → falls to generic logic
      expect(() => calculateStaffing(0, 'catering', rules)).not.toThrow();
    });

    it('returns at least 1 staff member for 1 guest (primary type)', () => {
      const plan = calculateStaffing(1, 'catering', rules);

      expect(plan.totalStaffCount).toBeGreaterThanOrEqual(1);
    });
  });
});

// ─── calculateProfit ─────────────────────────────────────────────────────────

describe('calculateProfit', () => {
  it('grossProfit = subtotal + gratuity - costs - labor', () => {
    const subtotal = 2925;
    const gratuity = 585;   // 20%
    const totalCosts = 600; // food + supplies + transport
    const totalLaborPaid = 400;

    const result = calculateProfit(subtotal, gratuity, totalCosts, totalLaborPaid, rules);

    expect(result.grossProfit).toBeCloseTo(subtotal + gratuity - totalCosts - totalLaborPaid, 2);
  });

  it('retainedAmount = grossProfit × businessRetainedPercent (30%)', () => {
    const result = calculateProfit(2000, 400, 300, 200, rules);

    expect(result.retainedPercent).toBe(30);
    expect(result.retainedAmount).toBeCloseTo(result.grossProfit * 0.30, 2);
  });

  it('distributionAmount = grossProfit × ownerDistributionPercent (70%)', () => {
    const result = calculateProfit(2000, 400, 300, 200, rules);

    expect(result.distributionPercent).toBe(70);
    expect(result.distributionAmount).toBeCloseTo(result.grossProfit * 0.70, 2);
  });

  it('retainedAmount + distributionAmount equals grossProfit', () => {
    const result = calculateProfit(3000, 600, 400, 500, rules);

    expect(result.retainedAmount + result.distributionAmount).toBeCloseTo(result.grossProfit, 2);
  });

  it('splits distribution between Owner A (40%) and Owner B (60%)', () => {
    const result = calculateProfit(3000, 600, 400, 500, rules);

    expect(result.ownerADistribution).toBeCloseTo(result.distributionAmount * 0.40, 2);
    expect(result.ownerBDistribution).toBeCloseTo(result.distributionAmount * 0.60, 2);
  });

  it('ownerDistributions array sums to distributionAmount', () => {
    const result = calculateProfit(3000, 600, 400, 500, rules);

    const total = result.ownerDistributions.reduce((sum, o) => sum + o.amount, 0);
    expect(total).toBeCloseTo(result.distributionAmount, 2);
  });

  it('handles negative grossProfit (loss scenario)', () => {
    // If costs + labor exceed revenue, profit is negative
    const result = calculateProfit(500, 100, 800, 200, rules);

    expect(result.grossProfit).toBeLessThan(0);
    expect(result.retainedAmount).toBeLessThan(0); // retained share of a loss
    expect(result.distributionAmount).toBeLessThan(0);
  });

  it('handles zero revenue correctly', () => {
    const result = calculateProfit(0, 0, 0, 0, rules);

    expect(result.grossProfit).toBe(0);
    expect(result.retainedAmount).toBe(0);
    expect(result.distributionAmount).toBe(0);
    expect(result.ownerADistribution).toBe(0);
    expect(result.ownerBDistribution).toBe(0);
  });

  it('uses custom owner list from rules when provided', () => {
    const customRules: MoneyRules = {
      ...rules,
      profitDistribution: {
        ...rules.profitDistribution,
        owners: [
          { id: 'alice', name: 'Alice', equityPercent: 60 },
          { id: 'bob', name: 'Bob', equityPercent: 40 },
        ],
      },
    };

    const result = calculateProfit(3000, 600, 400, 500, customRules);

    expect(result.ownerDistributions[0].ownerId).toBe('alice');
    expect(result.ownerDistributions[1].ownerId).toBe('bob');
    expect(result.ownerADistribution).toBeCloseTo(result.distributionAmount * 0.60, 2);
    expect(result.ownerBDistribution).toBeCloseTo(result.distributionAmount * 0.40, 2);
  });
});

// ─── mergeRulesOverrides ─────────────────────────────────────────────────────

describe('mergeRulesOverrides', () => {
  it('returns base rules unchanged when overrides is undefined', () => {
    const result = mergeRulesOverrides(rules, undefined);

    expect(result.pricing.primaryBasePrice).toBe(rules.pricing.primaryBasePrice);
    expect(result.costs.primaryFoodCostPercent).toBe(rules.costs.primaryFoodCostPercent);
  });

  it('overrides a single pricing field without affecting others', () => {
    const result = mergeRulesOverrides(rules, {
      pricing: { ...rules.pricing, primaryBasePrice: 80 },
    });

    expect(result.pricing.primaryBasePrice).toBe(80);
    expect(result.pricing.secondaryBasePrice).toBe(rules.pricing.secondaryBasePrice); // unchanged
    expect(result.pricing.defaultGratuityPercent).toBe(rules.pricing.defaultGratuityPercent); // unchanged
  });

  it('overrides cost percentages without changing staffing rules', () => {
    const result = mergeRulesOverrides(rules, {
      costs: { ...rules.costs, primaryFoodCostPercent: 25 },
    });

    expect(result.costs.primaryFoodCostPercent).toBe(25);
    expect(result.staffing.maxGuestsPerChefPrimary).toBe(rules.staffing.maxGuestsPerChefPrimary);
  });

  it('overrides privateLabor percentages', () => {
    const result = mergeRulesOverrides(rules, {
      privateLabor: { ...rules.privateLabor, leadChefBasePercent: 20 },
    });

    expect(result.privateLabor.leadChefBasePercent).toBe(20);
    expect(result.privateLabor.fullChefBasePercent).toBe(rules.privateLabor.fullChefBasePercent);
  });

  it('strips null values from overrides, preserving defaults', () => {
    // Passing null for primaryBasePrice (as any) should be stripped → default retained
    const result = mergeRulesOverrides(rules, {
      pricing: { ...rules.pricing, primaryBasePrice: null as unknown as number },
    });

    expect(result.pricing.primaryBasePrice).toBe(rules.pricing.primaryBasePrice);
  });

  it('strips NaN values from overrides, preserving defaults', () => {
    const result = mergeRulesOverrides(rules, {
      pricing: { ...rules.pricing, primaryBasePrice: NaN },
    });

    expect(result.pricing.primaryBasePrice).toBe(rules.pricing.primaryBasePrice);
  });

  it('overrides staffing profiles array when provided', () => {
    const newProfile: StaffingProfile = {
      id: 'new-prof',
      name: 'Test Profile',
      eventType: 'catering',
      minGuests: 1,
      maxGuests: 50,
      roles: ['lead'],
    };

    const result = mergeRulesOverrides(rules, {
      staffing: { ...rules.staffing, profiles: [newProfile] },
    });

    expect(result.staffing.profiles).toHaveLength(1);
    expect(result.staffing.profiles[0].id).toBe('new-prof');
  });

  it('can override multiple sections simultaneously', () => {
    const result = mergeRulesOverrides(rules, {
      pricing: { ...rules.pricing, primaryBasePrice: 75 },
      costs: { ...rules.costs, primaryFoodCostPercent: 22 },
      distance: { ...rules.distance, freeDistanceMiles: 30 },
    });

    expect(result.pricing.primaryBasePrice).toBe(75);
    expect(result.costs.primaryFoodCostPercent).toBe(22);
    expect(result.distance.freeDistanceMiles).toBe(30);
  });
});

// ─── findMatchingProfile ─────────────────────────────────────────────────────

describe('findMatchingProfile', () => {
  const profiles: StaffingProfile[] = [
    { id: 'small', name: 'Small', eventType: 'catering', minGuests: 1, maxGuests: 20, roles: ['lead'] },
    { id: 'large', name: 'Large', eventType: 'catering', minGuests: 21, maxGuests: 100, roles: ['lead', 'full'] },
    { id: 'any-size', name: 'Any Size', eventType: 'any', minGuests: 1, maxGuests: 9999, roles: ['lead'] },
  ];

  it('returns undefined when profiles list is empty', () => {
    expect(findMatchingProfile([], 'catering', 25)).toBeUndefined();
  });

  it('matches profile by event type and guest count range', () => {
    const match = findMatchingProfile(profiles, 'catering', 15);

    expect(match?.id).toBe('small');
  });

  it('matches the large profile for 50 guests', () => {
    const match = findMatchingProfile(profiles, 'catering', 50);

    expect(match?.id).toBe('large');
  });

  it('prefers exact event type match over "any" type match', () => {
    // Both 'small' (catering) and 'any-size' (any) could match, but 'small' is exact
    const match = findMatchingProfile(profiles, 'catering', 10);

    expect(match?.id).toBe('small');
  });

  it('falls back to "any" type profile when no exact type match', () => {
    // eventType 'wedding' has no exact match, only 'any-size'
    const match = findMatchingProfile(profiles, 'wedding', 10);

    expect(match?.id).toBe('any-size');
  });

  it('returns undefined when guest count is outside all profile ranges', () => {
    const match = findMatchingProfile(profiles, 'catering', 999);

    // All catering profiles cap at 100; 'any-size' caps at 9999
    expect(match?.id).toBe('any-size');
  });

  it('selects profile by explicit staffingProfileId regardless of type/range', () => {
    const match = findMatchingProfile(profiles, 'wedding', 999, 'large');

    expect(match?.id).toBe('large');
  });

  it('falls back to auto-match when staffingProfileId does not exist', () => {
    const match = findMatchingProfile(profiles, 'catering', 15, 'nonexistent-id');

    // 'nonexistent-id' not found → auto-match for 'catering' + 15 guests → 'small'
    expect(match?.id).toBe('small');
  });
});

// ─── calculateLaborCompensation ───────────────────────────────────────────────

describe('calculateLaborCompensation', () => {
  it('private-dinner: lead chef gets 15% of subtotal as base pay', () => {
    const plan = calculateStaffing(10, 'catering', rules);
    const compensation = calculateLaborCompensation(1000, 200, 'catering', plan, rules);

    const leadComp = compensation.find(c => c.role === 'lead');
    expect(leadComp?.basePay).toBeCloseTo(1000 * 0.15, 2);
  });

  it('private-dinner: gratuity is split 55% to chefs, 45% to assistant', () => {
    const plan = calculateStaffing(50, 'private-dinner', rules);
    const gratuity = 500;
    const compensation = calculateLaborCompensation(2500, gratuity, 'private-dinner', plan, rules);

    const assistantComp = compensation.find(c => c.role === 'assistant');
    const chefComps = compensation.filter(c => c.role !== 'assistant');
    const totalChefGratuity = chefComps.reduce((sum, c) => sum + c.gratuityShare, 0);

    expect(assistantComp?.gratuityShare).toBeCloseTo(gratuity * 0.45, 2);
    expect(totalChefGratuity).toBeCloseTo(gratuity * 0.55, 2);
  });

  it('buffet: gratuity split equally among all staff', () => {
    const plan = calculateStaffing(50, 'buffet', rules); // 2 chefs
    const gratuity = 300;
    const compensation = calculateLaborCompensation(1500, gratuity, 'buffet', plan, rules);

    expect(compensation.length).toBe(2);
    compensation.forEach(c => {
      expect(c.gratuityShare).toBeCloseTo(gratuity / 2, 2);
    });
  });

  it('cap is enforced when totalCalculated exceeds capPercent', () => {
    const cappedRules: MoneyRules = {
      ...rules,
      privateLabor: {
        ...rules.privateLabor,
        leadChefCapPercent: 10, // cap at 10% of (subtotal + gratuity)
      },
    };

    const plan = calculateStaffing(10, 'catering', cappedRules);
    const subtotal = 1000;
    const gratuity = 200;
    // lead basePay = 1000 × 15% = 150; cap = (1000+200) × 10% = 120 → capped
    const compensation = calculateLaborCompensation(subtotal, gratuity, 'catering', plan, cappedRules);

    const leadComp = compensation.find(c => c.role === 'lead');
    expect(leadComp?.wasCapped).toBe(true);
    expect(leadComp?.finalPay).toBeCloseTo(120, 2);
    expect(leadComp?.excessToProfit).toBeGreaterThan(0);
  });

  it('no cap applied when capPercent is null', () => {
    // DEFAULT_RULES has all cap percents as null
    const plan = calculateStaffing(10, 'catering', rules);
    const compensation = calculateLaborCompensation(1000, 200, 'catering', plan, rules);

    compensation.forEach(c => {
      expect(c.wasCapped).toBe(false);
      expect(c.capAmount).toBeNull();
      expect(c.finalPay).toBeCloseTo(c.totalCalculated, 2);
    });
  });
});

// ─── calculateEventFinancials (orchestrator) ─────────────────────────────────

describe('calculateEventFinancials', () => {
  it('assembles a complete EventFinancials object with all required fields', () => {
    const input = makeEventInput({ adults: 40, children: 10, distanceMiles: 0 });
    const result = calculateEventFinancials(input, rules);

    expect(result.guestCount).toBe(50);
    expect(result.adultCount).toBe(40);
    expect(result.childCount).toBe(10);
    expect(result.subtotal).toBeGreaterThan(0);
    expect(result.gratuity).toBeGreaterThan(0);
    expect(result.totalCharged).toBeGreaterThan(0);
    expect(result.foodCost).toBeGreaterThan(0);
    expect(result.totalCosts).toBeGreaterThan(0);
    expect(typeof result.grossProfit).toBe('number');
    expect(Array.isArray(result.staffingPlan.staff)).toBe(true);
    expect(Array.isArray(result.laborCompensation)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('grossProfit = subtotal + gratuity - totalCosts - totalLaborPaid', () => {
    const input = makeEventInput({ adults: 40, children: 10, distanceMiles: 0 });
    const result = calculateEventFinancials(input, rules);

    const expectedProfit = result.subtotal + result.gratuity - result.totalCosts - result.totalLaborPaid;
    expect(result.grossProfit).toBeCloseTo(expectedProfit, 2);
  });

  it('generates a labor warning when labor exceeds maxTotalLaborPercent (30%)', () => {
    // Force a high-labor scenario by cranking up base percents
    const highLaborRules: MoneyRules = {
      ...rules,
      privateLabor: {
        ...rules.privateLabor,
        leadChefBasePercent: 40,
        assistantBasePercent: 30,
      },
      safetyLimits: { maxTotalLaborPercent: 30, maxFoodCostPercent: 30, warnWhenExceeded: true },
    };
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 0 });
    const result = calculateEventFinancials(input, highLaborRules);

    const laborWarning = result.warnings.some(w => w.toLowerCase().includes('labor'));
    expect(laborWarning).toBe(true);
  });

  it('suppresses warnings when warnWhenExceeded is false', () => {
    const noWarnRules: MoneyRules = {
      ...rules,
      privateLabor: { ...rules.privateLabor, leadChefBasePercent: 40, assistantBasePercent: 30 },
      safetyLimits: { maxTotalLaborPercent: 30, maxFoodCostPercent: 30, warnWhenExceeded: false },
    };
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 0 });
    const result = calculateEventFinancials(input, noWarnRules);

    expect(result.warnings).toHaveLength(0);
  });

  it('handles 0 guests without throwing and returns zero revenue', () => {
    const input = makeEventInput({ adults: 0, children: 0, distanceMiles: 0 });

    expect(() => calculateEventFinancials(input, rules)).not.toThrow();

    const result = calculateEventFinancials(input, rules);
    expect(result.guestCount).toBe(0);
    expect(result.subtotal).toBe(0);
    expect(result.gratuity).toBe(0);
  });

  it('passes subtotalOverride through to all dependent calculations', () => {
    const input = makeEventInput({ adults: 40, children: 10, distanceMiles: 0, subtotalOverride: 9999 });
    const result = calculateEventFinancials(input, rules);

    expect(result.subtotal).toBe(9999);
    expect(result.gratuity).toBeCloseTo(9999 * 0.20, 2);
  });

  it('distance fee is included in totalCharged', () => {
    // 30 miles → 10 over → ceil(10/5) = 2 increments → $50 + 2×$25 = $100
    const input = makeEventInput({ adults: 10, children: 0, distanceMiles: 30 });
    const result = calculateEventFinancials(input, rules);

    expect(result.distanceFee).toBe(100);
    expect(result.totalCharged).toBeCloseTo(result.subtotal + result.gratuity + 100, 2);
  });
});

// ─── Utility functions ───────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min for non-finite input (NaN and Infinity both fail Number.isFinite)', () => {
    expect(clamp(NaN, 0, 10)).toBe(0);
    // Infinity fails Number.isFinite → clamp returns min, not max
    expect(clamp(Infinity, 0, 10)).toBe(0);
    expect(clamp(Infinity, 5, 100)).toBe(5);
  });
});

describe('toNumber', () => {
  it('parses valid numeric strings', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber('3.14')).toBe(3.14);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('')).toBe(0);
  });

  it('returns 0 for NaN strings', () => {
    expect(toNumber('NaN')).toBe(0);
  });
});

describe('formatCurrency', () => {
  it('formats positive numbers as USD currency', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats zero as $0.00', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('treats falsy values (NaN, undefined cast to 0) as $0.00', () => {
    // formatCurrency passes `n || 0` so NaN → 0
    expect(formatCurrency(NaN)).toBe('$0.00');
  });
});
