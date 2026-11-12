// Shared by the single-credential and profile sharing screens.

// The server accepts up to 365 days (MAX_SHARE_DAYS in Server/src/app.ts).
export const EXPIRY_OPTIONS = [7, 30, 90, 365];
export const expiryLabel = (days: number) => (days === 365 ? '1 year' : `${days} days`);

export function formatShareDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';
}
