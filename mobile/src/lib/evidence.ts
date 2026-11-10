import { API_BASE_URL, apiFetch } from '@/lib/api';

export type Evidence = {
  id: string;
  skill: string;
  note: string;
  hasPhoto: boolean;
  photoUrl?: string | null;
  locationConsent: boolean;
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationCapturedAt: string | null;
  supervisorName: string | null;
  /** Optional contact the reviewing training provider may use to check the work. */
  supervisorContact: string | null;
  reviewStatus: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  /** The approved training provider the learner asked to review this evidence. */
  reviewer: Reviewer | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type Reviewer = { id: string; name: string };

/** Evidence as the reviewing issuer sees it. */
export type EvidenceForReview = Omit<Evidence, 'reviewer'> & {
  learner: { id: string; name: string };
};

export const REVIEW_LABELS: Record<Evidence['reviewStatus'], string> = {
  SUBMITTED: 'Submitted, awaiting review',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
};

/** Approved training providers the learner can ask to review evidence. */
export function loadReviewers(token: string) {
  return apiFetch<{ reviewers: Reviewer[] }>('/learner/evidence-reviewers', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((data) => data.reviewers);
}

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Locally stored photos come back as API-relative paths; Cloudinary links are absolute. */
export function absolutePhotoUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
}

type UploadGrant =
  | { provider: 'cloudinary'; photoKey: string; uploadUrl: string; fields: Record<string, string | number> }
  | { provider: 'local'; photoKey: string; uploadUrl: string };

/**
 * Uploads a photo (as a base64 data URI) to wherever the server says, and returns the
 * storage key to send with the evidence record. The server decides the key, so a learner
 * can only attach photos stored under their own account.
 */
export async function uploadEvidencePhoto(token: string, dataUri: string, contentType: string) {
  const auth = { Authorization: `Bearer ${token}` };
  const grant = await apiFetch<UploadGrant>('/learner/evidence/upload', {
    method: 'POST',
    headers: auth,
    body: { contentType },
  });

  if (grant.provider === 'local') {
    await apiFetch(grant.uploadUrl, { method: 'POST', headers: auth, body: { photoKey: grant.photoKey, dataUri } });
    return grant.photoKey;
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(grant.fields)) form.append(key, String(value));
  form.append('file', dataUri);
  let response: Response;
  try {
    response = await fetch(grant.uploadUrl, { method: 'POST', body: form });
  } catch {
    throw new Error('Could not reach the photo storage service. Check your internet connection.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message ? `Photo upload failed: ${data.error.message}` : 'Photo upload failed.');
  }
  return grant.photoKey;
}
