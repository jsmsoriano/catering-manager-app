/**
 * Auto-formats a phone number string to (xxx)-xxx-xxxx as the user types.
 * Strips all non-digit characters and applies the mask progressively.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Returns true only when the value matches (xxx)-xxx-xxxx exactly.
 */
export function isValidPhone(value: string): boolean {
  return /^\(\d{3}\)-\d{3}-\d{4}$/.test(value);
}
