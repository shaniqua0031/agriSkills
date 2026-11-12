import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { CredentialThumb } from '@/components/credential-thumb';
import { ExpiryTag } from '@/components/expiry-reminder';
import { OfflineCopyNotice } from '@/components/offline-copy-notice';
import { useLearnerCredentials } from '@/hooks/use-learner-credentials';
import { expiryLabel, isExpiringSoon } from '@/lib/expiry';
import { STATUS_LABELS } from '@/lib/pdf';

export default function LearnerCredentialsScreen() {
  const { credentials, loading, error, savedAt, reload } = useLearnerCredentials();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">My credentials</Text>
      {savedAt ? <OfflineCopyNotice savedAt={savedAt} onRetry={reload} /> : null}

      {loading ? (
        <Text style={styles.loadingText}>Loading certificates...</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      ) : credentials.length === 0 ? (
        <Text style={styles.emptyText}>No credentials found.</Text>
      ) : (
        credentials.map((credential) => (
          <Link href={`/learner/credentials/${credential.id}`} asChild key={credential.id}>
            <Pressable
              style={styles.card}
              accessibilityRole="link"
              accessibilityLabel={`${credential.title}, ${STATUS_LABELS[credential.status] ?? credential.status}${isExpiringSoon(credential) ? `, ${expiryLabel(credential).toLowerCase()}` : ''}. Open details`}>
              <CredentialThumb title={credential.title} />
              <View style={styles.cardCopy}>
                <Text style={styles.title}>{credential.title}</Text>
                <Text style={styles.badge}>{STATUS_LABELS[credential.status] ?? credential.status}</Text>
                <Text style={styles.meta}>Reference: {credential.publicId}</Text>
                <ExpiryTag credential={credential} />
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#232323',
    marginBottom: 16,
  },
  loadingText: {
    color: '#5b5b5b',
  },
  errorText: {
    color: '#9a352c',
  },
  emptyText: {
    color: '#5b5b5b',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardCopy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#232323',
  },
  badge: {
    color: '#1e1e1e',
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 11,
    marginTop: 8,
  },
  meta: {
    color: '#5b5b5b',
    fontSize: 12,
    marginTop: 8,
  },
});
