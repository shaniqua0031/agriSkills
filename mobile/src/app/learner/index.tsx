import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';

import { CredentialThumb } from '@/components/credential-thumb';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

type PassportCredential = {
  id: string;
  title: string;
  status: string;
  skills: string[];
  publicId: string;
  issueDate: string;
  expiryDate?: string | null;
};

export default function LearnerPassportScreen() {
  const { user, token, logout } = useAuth();
  const [credentials, setCredentials] = useState<PassportCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !token) {
      router.replace('/');
      return;
    }

    apiFetch<{ credentials: PassportCredential[]; stats: { total: number; verified: number } }>(
      '/learner/passport',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
      .then((data) => {
        setCredentials(data.credentials ?? []);
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Could not load your passport.');
      })
      .finally(() => setLoading(false));
  }, [token, user]);

  if (!user) {
    return null;
  }

  const verifiedCount = credentials.filter((item) => item.status === 'ACTIVE').length;
  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header panel: learner name and summary counts on a dark background. */}
      <View style={styles.hero}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Passport</Text>
            <Text style={styles.name}>{user.name}</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.metricLabel}>Credentials</Text>
            <Text style={styles.metricValue}>{credentials.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.metricLabel}>Verified</Text>
            <Text style={styles.metricValue}>{verifiedCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent achievements</Text>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading passport...</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      ) : credentials.length === 0 ? (
        <Text style={styles.emptyText}>No credentials yet.</Text>
      ) : (
        credentials.slice(0, 3).map((credential) => (
          <Link href={`/learner/credentials/${credential.id}`} key={credential.id} asChild>
            <Pressable style={styles.credentialCard}>
              <CredentialThumb title={credential.title} />
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{credential.title}</Text>
                <Text style={styles.cardStatus}>{credential.status}</Text>
                <Text style={styles.cardMeta}>{credential.skills.join(', ')}</Text>
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
    paddingHorizontal: 18,
    paddingTop: 50,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 22,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    color: '#bdbdbd',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  name: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#1e1e1e',
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    padding: 16,
  },
  metricLabel: {
    color: '#cfcfcf',
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#232323',
  },
  loadingText: {
    color: '#5b5b5b',
    fontSize: 15,
    marginTop: 10,
  },
  errorText: {
    color: '#9a352c',
    fontSize: 14,
    marginTop: 10,
  },
  emptyText: {
    color: '#5b5b5b',
    fontSize: 15,
    marginTop: 10,
  },
  credentialCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1e1e1e',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: '#232323',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 6,
  },
  cardStatus: {
    color: '#1e1e1e',
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 11,
    marginBottom: 8,
  },
  cardMeta: {
    color: '#5b5b5b',
    fontSize: 13,
  },
});
