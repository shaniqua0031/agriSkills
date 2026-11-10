import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { CredentialBanner } from '@/components/credential-thumb';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

type CredentialDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  publicId: string;
  issueDate: string;
  expiryDate?: string | null;
  skills: string[];
  issuer?: { name: string };
};

export default function CredentialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [credential, setCredential] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !id) return;

    apiFetch<{ credential: CredentialDetail }>(`/learner/credentials/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => setCredential(data.credential))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Could not load this credential.');
      })
      .finally(() => setLoading(false));
  }, [id, token]);

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
      <CredentialBanner title={credential.title} />
      <Text style={styles.kicker}>Credential</Text>
      <Text style={styles.title}>{credential.title}</Text>
      <Text style={styles.badge}>{credential.status}</Text>

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

      <Text style={styles.label}>Description</Text>
      <Text style={styles.value}>{credential.description}</Text>

      <Text style={styles.label}>Skills</Text>
      <Text style={styles.value}>{credential.skills.join(', ')}</Text>
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
