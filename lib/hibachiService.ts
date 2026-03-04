export type HibachiServiceFormat = 'private_dinner' | 'buffet' | 'other';

export interface HibachiOpsRules {
  privateDinnerGuestsPerChef: number;
  privateDinnerAssistantThreshold: number;
  buffetGuestsPerChef: number;
  buffetMinChefsAtThreshold: number;
  buffetLargePartyThreshold: number;
}

export interface HibachiStaffingRecommendation {
  chefs: number;
  grills: number;
  assistants: number;
  showIncluded: boolean;
}

const DEFAULT_HIBACHI_OPS: HibachiOpsRules = {
  privateDinnerGuestsPerChef: 15,
  privateDinnerAssistantThreshold: 30,
  buffetGuestsPerChef: 25,
  buffetMinChefsAtThreshold: 2,
  buffetLargePartyThreshold: 50,
};

export function getHibachiServiceFormat(eventType: string): HibachiServiceFormat {
  if (eventType === 'private-dinner') return 'private_dinner';
  if (eventType === 'buffet') return 'buffet';
  return 'other';
}

export function getHibachiStaffingRecommendation(
  guestCount: number,
  format: HibachiServiceFormat,
  ops?: Partial<HibachiOpsRules>
): HibachiStaffingRecommendation | null {
  if (guestCount <= 0) return null;
  const config = { ...DEFAULT_HIBACHI_OPS, ...(ops ?? {}) };

  if (format === 'private_dinner') {
    const chefs = guestCount <= 18 ? 1 : Math.max(2, Math.ceil(guestCount / config.privateDinnerGuestsPerChef));
    const assistants = guestCount >= config.privateDinnerAssistantThreshold ? 1 : 0;
    return {
      chefs,
      grills: chefs,
      assistants,
      showIncluded: true,
    };
  }

  if (format === 'buffet') {
    const chefs =
      guestCount >= config.buffetLargePartyThreshold
        ? Math.max(config.buffetMinChefsAtThreshold, Math.ceil(guestCount / config.buffetGuestsPerChef))
        : Math.max(1, Math.ceil(guestCount / config.buffetGuestsPerChef));
    return {
      chefs,
      grills: chefs,
      assistants: 0,
      showIncluded: false,
    };
  }

  return null;
}
