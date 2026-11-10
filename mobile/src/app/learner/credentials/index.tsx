import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { CredentialThumb } from '@/components/credential-thumb';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

type Credential = {
  id: string;
  title: string;
  status: string;
  skills: string[];
  publicId: string;
};

export default function LearnerCredentialsScreen() {
  const { token, user } = useAuth();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !user) return;

    apiFetch<{ credentials: Credential[] }>('/learner/credentials', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => setCredentials(data.credentials ?? []))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Could not load credentials.');
      })
      .finally(() => setLoading(false));
  }, [token, user]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>My credentials</Text>

      {loading ? (
        <Text style={styles.loadingText}>Loading certificates...</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      ) : credentials.length === 0 ? (
        <Text style={styles.emptyText}>No credentials found.</Text>
      ) : (
        credentials.map((credential) => (
          <Link href={`/learner/credentials/${credential.id}`} asChild key={credential.id}>
            <Pressable style={styles.card}>
              <CredentialThumb title={credential.title} />
              <View style={styles.cardCopy}>
                <Text style={styles.title}>{credential.title}</Text>
                <Text style={styles.badge}>{credential.status}</Text>
                <Text style={styles.meta}>Reference: {credential.publicId}</Text>
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
