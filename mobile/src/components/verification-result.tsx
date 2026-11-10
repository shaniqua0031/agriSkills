import { StyleSheet, Text, View } from 'react-native';

import { formatDate, statusStyle, type VerificationResult } from '@/lib/verification';

/** Status banner plus the credential details a verification result is allowed to show. */
export function VerificationResultCard({ result }: { result: VerificationResult }) {
  const look = statusStyle(result.status);
  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <View style={[styles.status, { backgroundColor: look.background }]}>
        <Text style={[styles.statusLabel, { color: look.color }]}>{result.valid ? '✓ ' : ''}{look.label}</Text>
        <Text style={[styles.statusMessage, { color: look.color }]}>{result.message}</Text>
      </View>
      {result.credential ? (
        <View style={styles.details}>
          <Text style={styles.credentialTitle}>{result.credential.title}</Text>
          <Detail label="Holder" value={result.learner?.name ?? 'Unknown'} />
          <Detail label="Issued by" value={result.credential.issuer} />
          <Detail label="Issue date" value={formatDate(result.credential.issueDate)} />
          <Detail label="Expiry date" value={formatDate(result.credential.expiryDate)} />
          {result.credential.skills.length > 0 ? <Detail label="Skills" value={result.credential.skills.join(', ')} /> : null}
          <Detail label="Reference" value={result.credential.publicId} />
        </View>
      ) : null}
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
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },
});
