export type Role = 'LEARNER' | 'EMPLOYER' | 'ISSUER' | 'ADMIN';
export type CredentialStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type CredentialRecord = {
  id: string;
  publicId: string;
  learnerId: string;
  issuerId: string;
  title: string;
  description: string;
  category: string;
  issueDate: string;
  expiryDate?: string | null;
  status?: CredentialStatus;
  skills: string[];
  evidence?: string | null;
  revokedAt?: string | null;
  signature?: string | null;
  signatureAlgorithm?: string | null;
  signatureKeyId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function computeCredentialStatus(credential: Pick<CredentialRecord, 'status' | 'expiryDate' | 'revokedAt'>): CredentialStatus {
  if (credential.status === 'REVOKED' || credential.revokedAt) {
    return 'REVOKED';
  }

  if (credential.expiryDate) {
    const expiry = new Date(credential.expiryDate).getTime();
    if (!Number.isNaN(expiry) && expiry < Date.now()) {
      return 'EXPIRED';
    }
  }

  if (credential.status === 'PENDING') {
    return 'PENDING';
  }

  return 'ACTIVE';
}
