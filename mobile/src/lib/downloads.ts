import type { LearnerCredential } from '@/hooks/use-learner-credentials';
import { ApiError, apiFetch } from '@/lib/api';
import { type PdfVerification, certificateHtml, outputPdf, passportHtml } from '@/lib/pdf';

// Downloads put a QR code on the PDF that employers scan to verify. Each download creates a
// new verification link valid for 1 year; the learner can turn it off on the Share tab.
const LINK_DAYS = 365;
const MAX_PROFILE_CREDENTIALS = 20;

/** Returns null when the server can't be reached, so the PDF is still made (without a QR code). */
async function linkOrOffline(create: () => Promise<PdfVerification>): Promise<PdfVerification> {
  try {
    return await create();
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) return null;
    throw error;
  }
}

/** A certificate for one valid credential, with a QR code for its own verification link. */
export async function downloadCertificate(token: string, learnerName: string, credential: LearnerCredential) {
  if (credential.status !== 'ACTIVE') {
    throw new Error('Certificates can only be downloaded for valid credentials.');
  }
  const verification = await linkOrOffline(async () => {
    const data = await apiFetch<{ shareUrl: string; shareLink: { expiresAt: string | null } }>(
      `/learner/credentials/${credential.id}/share-links`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: { expiresInDays: LINK_DAYS } },
    );
    return { url: data.shareUrl, expiresAt: data.shareLink.expiresAt };
  });
  await outputPdf(certificateHtml(learnerName, credential, verification), `${credential.title} certificate`);
  return { withQr: Boolean(verification) };
}

/** A one-page summary of every credential, with one QR code for all valid ones (a profile link). */
export async function downloadPassport(
  token: string,
  learnerName: string,
  credentials: LearnerCredential[],
  offlineSavedAt: string | null,
) {
  const validIds = credentials.filter((credential) => credential.status === 'ACTIVE').map((credential) => credential.id);
  const verification = offlineSavedAt || validIds.length === 0
    ? null
    : await linkOrOffline(async () => {
        const data = await apiFetch<{ shareUrl: string; profileLink: { expiresAt: string | null } }>('/learner/profile-links', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: { credentialIds: validIds.slice(0, MAX_PROFILE_CREDENTIALS), title: 'Skills passport', expiresInDays: LINK_DAYS },
        });
        return { url: data.shareUrl, expiresAt: data.profileLink.expiresAt };
      });
  await outputPdf(passportHtml(learnerName, credentials, verification, offlineSavedAt), `${learnerName} skills passport`);
  return { withQr: Boolean(verification) };
}
