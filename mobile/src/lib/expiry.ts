// Expiry reminders: a valid credential that expires within this many days is "expiring soon".
export const EXPIRY_WARNING_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type Expiring = { status: string; expiryDate?: string | null };

/** Whole days until the credential expires (0 = today), or null when it never expires. */
export function daysUntilExpiry(credential: Expiring, now = Date.now()) {
  if (!credential.expiryDate) return null;
  return Math.max(0, Math.ceil((Date.parse(credential.expiryDate) - now) / DAY_MS));
}

export function isExpiringSoon(credential: Expiring, now = Date.now()) {
  if (credential.status !== 'ACTIVE') return false;
  const days = daysUntilExpiry(credential, now);
  return days !== null && days <= EXPIRY_WARNING_DAYS;
}

/** "Expires today", "Expires tomorrow", "Expires in 12 days". */
export function expiryLabel(credential: Expiring, now = Date.now()) {
  const days = daysUntilExpiry(credential, now);
  if (days === null) return '';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}
