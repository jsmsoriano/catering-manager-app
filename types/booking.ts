import type { Percent } from "./money";

export type EventType = "private" | "buffet";

export type BookingDraft = {
  eventDateIso: string;
  eventType: EventType;
  customerName: string;
  phone: string;
  email: string;
  location: string;
  guests: number;
  basePricePerGuest: number;
  premiumAddOnPerGuest: number;
  gratuityPercent: Percent;
  assistantPresent: boolean;
  notes: string;
};

export type Booking = {
  id: string;
  createdAtIso: string;
  updatedAtIso: string;

  eventDateIso: string;
  eventType: EventType;
  customerName: string;
  phone?: string;
  email?: string;
  location?: string;
  guests: number;

  basePricePerGuest: number;
  premiumAddOnPerGuest: number;
  gratuityPercent: Percent;
  assistantPresent: boolean;
  notes?: string;

  // Snapshot amounts
  subtotal: number;
  gratuity: number;
  totalCharged: number;
  chefsNeeded: number;

  // Payout preview
  chefBasePay: number;
  chefTipShare: Percent;
  chefTips: number;
  chefTotal: number;
  assistantBasePay: number;
  assistantTipShare: Percent;
  assistantTips: number;
};