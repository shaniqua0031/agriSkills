import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { CredentialBanner } from '@/components/credential-thumb';
import { DownloadButton } from '@/components/download-button';
import { ExpiryTag } from '@/components/expiry-reminder';
import { OfflineCopyNotice } from '@/components/offline-copy-notice';
import { VerificationHistory } from '@/components/verification-history';
import { useAuth } from '@/context/auth';
import type { LearnerCredential } from '@/hooks/use-learner-credentials';
import { ApiError, apiFetch } from '@/lib/api';
import { downloadCertificate } from '@/lib/downloads';
import { loadPassportCache } from '@/lib/passport-cache';
import { STATUS_LABELS } from '@/lib/pdf';

export default function CredentialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const [credential, setCredential] = useState<LearnerCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id || !user) return;

    apiFetch<{ credential: LearnerCredential }>(`/learner/credentials/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        setCredential(data.credential);
        setSavedAt(null);
      })
      .catch(async (requestError: unknown) => {
        // No connection: show the copy saved on this device, if there is one.
        const cached = requestError instanceof ApiError && requestError.status === 0 ? await loadPassportCache(user.id) : null;
        const saved = cached?.credentials.find((item) => item.id === id);
        if (cached && saved) {
          setCredential(saved);
          setSavedAt(cached.savedAt);
          return;
        }
        setError(requestError instanceof Error ? requestError.message : 'Could not load this credential.');
      })
      .finally(() => setLoading(false));
  }, [id, token, user]);

  if (!credential) {
    return (
      <View style={styles.container}>
        {loading ? (
          <Text style={styles.emptyText}>Loading credential details…</Text>
        ) : (
          <Text accessibilityRole="alert" style={styles.errorText}>{error || 'Credential not found.'}</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {savedAt ? <OfflineCopyNotice savedAt={savedAt} /> : null}
      <CredentialBanner title={credential.title} />
      <Text style={styles.kicker}>Credential</Text>
      <Text style={styles.title} accessibilityRole="header">{credential.title}</Text>
      <Text style={styles.badge}>{STATUS_LABELS[credential.status] ?? credential.status}</Text>
      <ExpiryTag credential={credential} />

      <View style={styles.card}>
        <Text style={styles.label}>Issued by</Text>
        <Text style={styles.value}>{credential.issuer?.name ?? 'Issuer'}</Text>

        <Text style={styles.label}>Category</Text>
        <Text style={styles.value}>{credential.category}</Text>

        <Text style={styles.label}>Issue date</Text>
        <Text style={styles.value}>{new Date(credential.issueDate).toLocaleDateString()}</Text>

        <Text style={styles.label}>Expiry date</Text>
        <Text style={styles.value}>{credential.expiryDate ? new Date(credential.expiryDate).toLocaleDateString() : 'No expiry'}</Text>

        <Text style={styles.label}>Public reference</Text>
        <Text style={styles.value}>{credential.publicId}</Text>
      </View>

      {credential.status === 'ACTIVE' ? (
        <DownloadButton
          label="Download certificate (PDF)"
          hint="Makes a certificate with a QR code employers can scan to verify it"
          run={() => downloadCertificate(token!, user!.name, credential)}
        />
      ) : (
        <Text style={styles.note}>
          A certificate can be downloaded while the credential is valid. This one is {(STATUS_LABELS[credential.status] ?? credential.status).toLowerCase()}.
        </Text>
      )}

      {credential.description ? (
        <>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.value}>{credential.description}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Skills</Text>
      <Text style={[styles.value, styles.lastValue]}>{credential.skills.join(', ')}</Text>

      <VerificationHistory credentialId={credential.id} limit={10} />
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
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  kicker: {
    color: '#1e1e1e',
    fontWeight: '700',
    letterSpacing: 1,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#232323',
    marginTop: 8,
  },
  badge: {
    marginTop: 8,
    color: '#1e1e1e',
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 11,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
    marginBottom: 16,
  },
  label: {
    color: '#666666',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '600',
  },
  value: {
    color: '#252525',
    fontSize: 15,
    lineHeight: 22,
  },
  lastValue: {
    marginBottom: 16,
  },
  note: {
    color: '#5b5b5b',
    fontSize: 14,
    marginBottom: 12,
  },
  emptyText: {
    color: '#5b5b5b',
    fontSize: 15,
  },
  errorText: {
    color: '#9a352c',
    fontSize: 15,
    textAlign: 'center',
  },
});
