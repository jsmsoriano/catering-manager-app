export const LEAD_SOURCE_OPTIONS = [
  { value: '', label: 'Select source…' },
  { value: 'google', label: 'Google Search' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'referral', label: 'Referral' },
  { value: 'repeat_customer', label: 'Repeat Customer' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
] as const;

export function getLeadSourceLabel(sourceChannel?: string | null): string {
  if (!sourceChannel) return 'Not provided';
  const match = LEAD_SOURCE_OPTIONS.find((option) => option.value === sourceChannel);
  if (match) return match.label;
  return sourceChannel
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
