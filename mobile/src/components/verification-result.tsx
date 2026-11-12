import { StyleSheet, Text, View } from 'react-native';

import { formatDate, statusStyle, type ProfileVerification, type VerificationResult } from '@/lib/verification';

/** Status banner plus the credential details a verification result is allowed to show. */
export function VerificationResultCard({ result }: { result: VerificationResult }) {
  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <StatusBanner valid={result.valid} status={result.status} message={result.message} />
      {result.credential ? <CredentialDetails credential={result.credential} holder={result.learner?.name ?? 'Unknown'} /> : null}
    </View>
  );
}

/** A curated profile: an overall banner, then each credential with its own result. */
export function ProfileResultCard({ result }: { result: ProfileVerification }) {
  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <StatusBanner valid={result.valid} status={result.status} message={result.message} />
      {result.learner ? (
        <View style={styles.details}>
          {result.title ? <Text style={styles.credentialTitle}>{result.title}</Text> : null}
          <Detail label="Holder" value={result.learner.name} />
          <Detail label="Credentials" value={`${result.verifiedCount} of ${result.credentials.length} verified`} />
          {result.linkExpiresAt ? <Detail label="Link expires" value={formatDate(result.linkExpiresAt)} /> : null}
        </View>
      ) : null}
      {result.credentials.map((item, index) => (
        <View key={item.credential?.publicId ?? `hidden-${index}`} style={styles.item}>
          <StatusPill status={item.status} />
          {item.credential ? (
            <CredentialDetails credential={item.credential} />
          ) : (
            <Text style={styles.hiddenText}>{item.message}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function StatusBanner({ valid, status, message }: { valid: boolean; status: string; message: string }) {
  const look = statusStyle(status);
  return (
    <View style={[styles.status, { backgroundColor: look.background }]}>
      <Text style={[styles.statusLabel, { color: look.color }]}>{valid ? '✓ ' : ''}{look.label}</Text>
      <Text style={[styles.statusMessage, { color: look.color }]}>{message}</Text>
    </View>
  );
}

function CredentialDetails({ credential, holder }: { credential: NonNullable<VerificationResult['credential']>; holder?: string }) {
  return (
    <View style={styles.details}>
      <Text style={styles.credentialTitle}>{credential.title}</Text>
      {holder ? <Detail label="Holder" value={holder} /> : null}
      <Detail label="Issued by" value={credential.issuer} />
      <Detail label="Issue date" value={formatDate(credential.issueDate)} />
      <Detail label="Expiry date" value={formatDate(credential.expiryDate)} />
      {credential.skills.length > 0 ? <Detail label="Skills" value={credential.skills.join(', ')} /> : null}
      <Detail label="Reference" value={credential.publicId} />
    </View>
  );
}

/** Small coloured pill for a saved check's latest result. */
export function StatusPill({ status }: { status: string }) {
  const look = statusStyle(status);
  return (
    <View style={[styles.pill, { backgroundColor: look.background }]}>
      <Text style={[styles.pillText, { color: look.color }]}>{status === 'VERIFIED' ? '✓ ' : ''}{look.label}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  result: { marginTop: 14, gap: 12 },
  status: { borderRadius: 14, padding: 14 },
  statusLabel: { fontSize: 18, fontWeight: '800' },
  statusMessage: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  details: { backgroundColor: '#f7f7f7', borderRadius: 14, padding: 14, gap: 8 },
  credentialTitle: { fontSize: 17, fontWeight: '800', color: '#232323', marginBottom: 2 },
  detail: { gap: 2 },
  detailLabel: { color: '#666666', fontSize: 12, fontWeight: '700' },
  detailValue: { color: '#252525', fontSize: 15, lineHeight: 21 },
  item: { borderColor: '#e7e7e7', borderRadius: 14, borderWidth: 1, gap: 10, padding: 10 },
  hiddenText: { color: '#5b5b5b', fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },
});
