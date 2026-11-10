import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Simplified project integrity scheme (not W3C Verifiable Credentials / Open Badges):
// HMAC-SHA256 over a canonical JSON serialisation of the credential's fixed fields.
// Status, revocation and expiry checks happen separately at verification time.
export const SIGNATURE_ALGORITHM = 'HMAC-SHA256';
export const SIGNATURE_KEY_ID = 'v1';

export type SignableCredential = {
  publicId: string;
  learnerId: string;
  issuerId: string;
  title: string;
  description: string;
  category: string;
  issueDate: string;
  expiryDate?: string | null;
  skills: string[];
};

export function getSigningSecret() {
  const secret = process.env.CREDENTIAL_SIGNING_SECRET
    ?? (process.env.NODE_ENV === 'production' ? '' : 'demo-credential-signing-secret');
  if (!secret) {
    throw new Error('CREDENTIAL_SIGNING_SECRET must be set in production.');
  }
  return secret;
}

// Keys are listed in a fixed order so the same credential always produces the same bytes.
export function canonicalCredentialPayload(credential: SignableCredential) {
  return JSON.stringify({
    schema: 'agriskills-credential/1',
    publicId: credential.publicId,
    learnerId: credential.learnerId,
    issuerId: credential.issuerId,
    title: credential.title,
    description: credential.description,
    category: credential.category,
    issueDate: new Date(credential.issueDate).toISOString(),
    expiryDate: credential.expiryDate ? new Date(credential.expiryDate).toISOString() : null,
    skills: [...credential.skills],
  });
}

export function signCredential(credential: SignableCredential, secret = getSigningSecret()) {
  return createHmac('sha256', secret).update(canonicalCredentialPayload(credential)).digest('base64url');
}

// Fails closed: a missing signature, unknown key ID or any mismatch returns false.
export function verifyCredentialSignature(
  credential: SignableCredential & { signature?: string | null; signatureKeyId?: string | null },
  secret = getSigningSecret(),
) {
  if (!credential.signature || credential.signatureKeyId !== SIGNATURE_KEY_ID) return false;
  try {
    const expected = Buffer.from(signCredential(credential, secret));
    const actual = Buffer.from(credential.signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// Share tokens: 32 random bytes, base64url (43 chars). Only the SHA-256 hash is stored.
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createShareToken() {
  return randomBytes(32).toString('base64url');
}

export function hashShareToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
