// Shared by the public "Verify a credential" page and the employer dashboard.

/** The public result of checking a share link (same as the /verify page). */
export type VerificationResult = {
  valid: boolean;
  status: string;
  message: string;
  learner: { name: string } | null;
  credential: {
    title: string;
    issuer: string;
    issueDate: string;
    expiryDate: string | null;
    publicId: string;
    skills: string[];
  } | null;
  linkExpiresAt: string | null;
};

/** An employer's saved check (see Server/src/employer.ts). */
export type EmployerCheck = {
  id: string;
  result: string;
  learnerName: string | null;
  credentialTitle: string | null;
  issuerName: string | null;
  note: string | null;
  createdAt: string;
  checkedAt: string;
  canRecheck: boolean;
};

/** The public result of a curated profile link (several credentials, see Server/src/profile-links.ts). */
export type ProfileVerification = {
  valid: boolean;
  status: string;
  message: string;
  title: string | null;
  learner: { name: string } | null;
  verifiedCount: number;
  credentials: Array<Pick<VerificationResult, 'valid' | 'status' | 'message' | 'credential'>>;
  linkExpiresAt: string | null;
};

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Accepts a full share link (…/verify/<token>) or just the token. */
export function extractToken(input: string) {
  const trimmed = input.trim();
  if (TOKEN.test(trimmed)) return trimmed;
  const match = /\/verify\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/.exec(trimmed);
  return match?.[1] ?? null;
}

/** A pasted link: a curated profile (…/profile/<token>) or one credential (…/verify/<token> or just the token). */
export function parseShareLink(input: string): { kind: 'profile' | 'credential'; token: string } | null {
  const profile = /\/profile\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/.exec(input.trim());
  if (profile) return { kind: 'profile', token: profile[1] };
  const token = extractToken(input);
  return token ? { kind: 'credential', token } : null;
}

export const STATUS_STYLE: Record<string, { label: string; color: string; background: string }> = {
  VERIFIED: { label: 'Verified', color: '#141414', background: '#dcfce7' },
  PARTLY_VERIFIED: { label: 'Some need a look', color: '#7a4a00', background: '#fff1d6' },
  EXPIRED: { label: 'Expired', color: '#7a4a00', background: '#fff1d6' },
  PENDING: { label: 'Not active yet', color: '#7a4a00', background: '#fff1d6' },
  REVOKED: { label: 'Revoked', color: '#8a1c12', background: '#fdecea' },
  INVALID: { label: 'Verification failed', color: '#8a1c12', background: '#fdecea' },
  LINK_EXPIRED: { label: 'Link expired', color: '#7a4a00', background: '#fff1d6' },
  LINK_REVOKED: { label: 'Link turned off', color: '#7a4a00', background: '#fff1d6' },
  NOT_FOUND: { label: 'Not found', color: '#8a1c12', background: '#fdecea' },
};

export const statusStyle = (status: string) => STATUS_STYLE[status] ?? STATUS_STYLE.NOT_FOUND;

export const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'No expiry');
