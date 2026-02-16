export type ReconciliationStatus = 'draft' | 'finalized';

export interface ActualLaborEntry {
  role: string;
  staffName?: string;
  actualPay: number;
}

export interface EventReconciliation {
  id: string;
  bookingId: string;
  status: ReconciliationStatus;

  // Actual Revenue
  actualAdults?: number;
  actualChildren?: number;
  actualSubtotal?: number;
  actualGratuity?: number;
  actualDistanceFee?: number;
  actualTotal?: number;

  // Actual Costs
  actualFoodCost?: number;
  foodCostSource?: 'shopping-list' | 'manual';
  foodCostSnapshot?: number;
  actualSuppliesCost?: number;
  actualTransportationCost?: number;

  // Actual Labor
  actualLaborEntries?: ActualLaborEntry[];
  actualTotalLaborPaid?: number;

  notes?: string;
  reconciledAt?: string;
  createdAt: string;
  updatedAt: string;
}
