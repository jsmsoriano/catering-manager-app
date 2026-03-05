// ─── Waterfall Calculator — pure calculation module ─────────────────────────
// Supports hibachi private dinner, buffet catering, private chef, food truck.
// No React or localStorage dependencies — all functions are pure.

export type WaterfallEventType =
  | 'hibachi_private'
  | 'hibachi_buffet'
  | 'private_chef'
  | 'food_truck';

export interface WaterfallInputs {
  guests: number;
  pricePerPerson: number;

  // Rates (as whole-number percentages, e.g. 20 = 20%)
  gratuityRate: number;          // default 20
  salesTaxRate: number;          // default 7
  foodCostPercent: number;       // default 30
  chefLaborPercent: number;      // % of revenue — default 20
  assistantLaborPercent: number; // % of revenue — default 10
  businessReservePercent: number;// % of revenue — default 10

  // Split configuration
  chefGratuityPercent: number;   // % of gratuity going to chef — default 60
  chefOwnershipPercent: number;  // % of profit going to chef owner — default 40

  // Optional: for future event-type-aware cost scaling
  eventType?: WaterfallEventType;
}

export interface WaterfallResult {
  // Revenue
  revenue: number;
  gratuity: number;
  salesTax: number;
  totalCollected: number;

  // Labor
  chefLabor: number;
  assistantLabor: number;
  totalLabor: number;

  // Gratuity split
  chefTip: number;
  assistantTip: number;

  // Costs
  foodCost: number;
  businessReserve: number;
  totalCosts: number; // labor + food + reserve + tax

  // Profit
  grossProfit: number;       // revenue − labor − food − reserve − salesTax
  chefProfit: number;        // grossProfit × chefOwnership%
  assistantProfit: number;   // grossProfit × (1 − chefOwnership%)

  // Total earnings per person
  chefTotal: number;         // chefLabor + chefTip + chefProfit
  assistantTotal: number;    // assistantLabor + assistantTip + assistantProfit

  // Percentages of revenue (for chart segments)
  pct: {
    labor: number;
    food: number;
    reserve: number;
    tax: number;
    profit: number;
  };
}

export const WATERFALL_DEFAULTS: Omit<WaterfallInputs, 'guests' | 'pricePerPerson'> = {
  gratuityRate: 20,
  salesTaxRate: 7,
  foodCostPercent: 30,
  chefLaborPercent: 20,
  assistantLaborPercent: 10,
  businessReservePercent: 10,
  chefGratuityPercent: 60,
  chefOwnershipPercent: 40,
};

export function calculateWaterfall(inputs: WaterfallInputs): WaterfallResult {
  const {
    guests,
    pricePerPerson,
    gratuityRate,
    salesTaxRate,
    foodCostPercent,
    chefLaborPercent,
    assistantLaborPercent,
    businessReservePercent,
    chefGratuityPercent,
    chefOwnershipPercent,
  } = inputs;

  // Step 1 — Revenue
  const revenue = guests * pricePerPerson;

  // Step 2 — Gratuity
  const gratuity = revenue * (gratuityRate / 100);

  // Step 3 — Sales tax (on revenue only, not gratuity)
  const salesTax = revenue * (salesTaxRate / 100);

  const totalCollected = revenue + gratuity + salesTax;

  // Step 4 — Labor payouts (from revenue)
  const chefLabor = revenue * (chefLaborPercent / 100);
  const assistantLabor = revenue * (assistantLaborPercent / 100);
  const totalLabor = chefLabor + assistantLabor;

  // Step 5 — Gratuity split
  const chefTip = gratuity * (chefGratuityPercent / 100);
  const assistantTip = gratuity * ((100 - chefGratuityPercent) / 100);

  // Step 6 — Food cost (from revenue)
  const foodCost = revenue * (foodCostPercent / 100);

  // Step 7 — Business reserve (from revenue)
  const businessReserve = revenue * (businessReservePercent / 100);

  // Step 8 — Remaining profit from revenue
  const grossProfit = revenue - totalLabor - foodCost - businessReserve - salesTax;

  // Step 9 — Distribute profit by ownership
  const chefProfit = grossProfit > 0 ? grossProfit * (chefOwnershipPercent / 100) : 0;
  const assistantProfit = grossProfit > 0 ? grossProfit * ((100 - chefOwnershipPercent) / 100) : 0;

  const totalCosts = totalLabor + foodCost + businessReserve + salesTax;

  // Percentages of revenue for chart segments (clamp negatives to 0)
  const pctOf = (n: number) => (revenue > 0 ? Math.max(0, (n / revenue) * 100) : 0);

  return {
    revenue,
    gratuity,
    salesTax,
    totalCollected,
    chefLabor,
    assistantLabor,
    totalLabor,
    chefTip,
    assistantTip,
    foodCost,
    businessReserve,
    totalCosts,
    grossProfit,
    chefProfit,
    assistantProfit,
    chefTotal: chefLabor + chefTip + chefProfit,
    assistantTotal: assistantLabor + assistantTip + assistantProfit,
    pct: {
      labor: pctOf(totalLabor),
      food: pctOf(foodCost + businessReserve),
      reserve: pctOf(businessReserve),
      tax: pctOf(salesTax),
      profit: pctOf(Math.max(0, grossProfit)),
    },
  };
}

/** Returns a human-readable label for each event type. */
export function getWaterfallEventTypeLabel(t: WaterfallEventType): string {
  const map: Record<WaterfallEventType, string> = {
    hibachi_private: 'Hibachi Private Dinner',
    hibachi_buffet: 'Hibachi Buffet',
    private_chef: 'Private Chef',
    food_truck: 'Food Truck',
  };
  return map[t];
}
