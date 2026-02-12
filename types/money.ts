export type Percent = number; // 0..100

export type MoneyRules = {
  pricing: {
    basePrivatePerGuest: number;
    premiumAddOnMinPerGuest: number;
    premiumAddOnMaxPerGuest: number;
    defaultGratuityPercent: Percent;
    maxGuestsPerChef: number;
  };
  revenueTreatment: {
    gratuityIsTipPool: boolean;
    salesTaxIsPassThrough: boolean;
  };
  privateDinnerPay: {
    chefBasePercentOfSubtotal: Percent;
    chefTipSharePercent: Percent;
    chefTotalCapPercentOfSubtotal: Percent;
    assistantBasePerEvent: number;
    assistantTipSharePercent: Percent;
    assistantPresentDefault: boolean;
  };
  buffetPay: {
    laborSplit5050: boolean;
    tipSplit5050: boolean;
  };
  reserves: {
    businessReservePercentOfSubtotal: Percent;
    taxReservePercentOfOperatingProfit: Percent;
    autoTransferWithinHours: number;
  };
  profitDistributions: {
    ownerSplitA: Percent;
    ownerSplitB: Percent;
    monthlyDistributionPercent: Percent;
    monthlyRetainedPercent: Percent;
    annualTrueUpEnabled: boolean;
  };
  safetyLimits: {
    privateTotalLaborMaxPercentOfSubtotal: Percent;
    foodCostMaxPercent: Percent;
    suppliesMaxPercent: Percent;
    warnOnBreach: boolean;
  };
};