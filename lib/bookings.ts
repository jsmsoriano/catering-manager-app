import type { Booking, BookingDraft } from "@/types/booking";
import type { MoneyRules } from "@/types/money";
import { clamp, percentOf } from "./moneyRules";
import { loadFromStorage, saveToStorage } from "./storage";

export const STORAGE_KEY_BOOKINGS = "hibachi.bookings.v1";

export function uid(prefix = "b") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function calcChefsNeeded(guests: number, maxGuestsPerChef: number) {
  const g = Math.max(0, Math.round(guests));
  const cap = Math.max(1, Math.round(maxGuestsPerChef));
  return g === 0 ? 0 : Math.ceil(g / cap);
}

export function loadBookings(): Booking[] {
  return loadFromStorage<Booking[]>(STORAGE_KEY_BOOKINGS, []);
}

export function saveBookings(bookings: Booking[]) {
  saveToStorage(STORAGE_KEY_BOOKINGS, bookings);
}

export function computeBookingSnapshot(draft: BookingDraft, rules: MoneyRules) {
  const guests = Math.max(0, Math.round(draft.guests));
  const base = Math.max(0, draft.basePricePerGuest);
  const addOn = Math.max(0, draft.premiumAddOnPerGuest);

  const subtotal = guests * (base + addOn);
  const gratuity = percentOf(subtotal, clamp(draft.gratuityPercent, 0, 100));
  const totalCharged = subtotal + gratuity;
  const chefsNeeded = calcChefsNeeded(guests, rules.pricing.maxGuestsPerChef);

  if (draft.eventType === "private") {
    const chefBasePay = percentOf(subtotal, rules.privateDinnerPay.chefBasePercentOfSubtotal);
    const chefTipShare = draft.assistantPresent ? rules.privateDinnerPay.chefTipSharePercent : 100;
    const assistantTipShare = draft.assistantPresent ? rules.privateDinnerPay.assistantTipSharePercent : 0;

    const chefTips = percentOf(gratuity, chefTipShare);
    const assistantTips = percentOf(gratuity, assistantTipShare);

    const assistantBasePay = draft.assistantPresent ? rules.privateDinnerPay.assistantBasePerEvent : 0;
    const chefTotal = chefBasePay + chefTips;

    return {
      guests,
      subtotal,
      gratuity,
      totalCharged,
      chefsNeeded,
      chefBasePay,
      chefTipShare,
      chefTips,
      chefTotal,
      assistantBasePay,
      assistantTipShare,
      assistantTips,
    };
  }

  // Buffet: tip split only (wages handled later)
  const chefBasePay = 0;
  const chefTipShare = rules.buffetPay.tipSplit5050 ? 50 : 50;
  const assistantTipShare = rules.buffetPay.tipSplit5050 ? 50 : 50;
  const chefTips = percentOf(gratuity, chefTipShare);
  const assistantTips = percentOf(gratuity, assistantTipShare);
  const assistantBasePay = 0;
  const chefTotal = chefBasePay + chefTips;

  return {
    guests,
    subtotal,
    gratuity,
    totalCharged,
    chefsNeeded,
    chefBasePay,
    chefTipShare,
    chefTips,
    chefTotal,
    assistantBasePay,
    assistantTipShare,
    assistantTips,
  };
}