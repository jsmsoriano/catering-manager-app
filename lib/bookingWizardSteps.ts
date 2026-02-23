/**
 * Event wizard steps: each event has its own page with a step-based flow.
 * Steps: Contact → Event details → Menu creation → Staff assignments.
 */

export const BOOKING_WIZARD_STEPS = [
  { id: 'contact', label: 'Contact', shortLabel: 'Contact' },
  { id: 'details', label: 'Event details', shortLabel: 'Event details' },
  { id: 'menu', label: 'Menu creation', shortLabel: 'Menu' },
  { id: 'staff', label: 'Staff assignments', shortLabel: 'Staff' },
] as const;

export type BookingWizardStepId = (typeof BOOKING_WIZARD_STEPS)[number]['id'];

export function getStepIndex(stepId: string): number {
  const i = BOOKING_WIZARD_STEPS.findIndex((s) => s.id === stepId);
  return i >= 0 ? i : 0;
}

export function getStepId(index: number): BookingWizardStepId {
  const step = BOOKING_WIZARD_STEPS[Math.max(0, Math.min(index, BOOKING_WIZARD_STEPS.length - 1))];
  return step.id;
}

export function getNextStepId(currentStepId: string): BookingWizardStepId | null {
  const i = getStepIndex(currentStepId);
  if (i >= BOOKING_WIZARD_STEPS.length - 1) return null;
  return BOOKING_WIZARD_STEPS[i + 1].id;
}

export function getPrevStepId(currentStepId: string): BookingWizardStepId | null {
  const i = getStepIndex(currentStepId);
  if (i <= 0) return null;
  return BOOKING_WIZARD_STEPS[i - 1].id;
}
