import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/auth';
import { CredentialThumb } from '@/components/credential-thumb';
import { IssuerApprovalNotice } from '@/components/issuer-approval-notice';
import { apiFetch } from '@/lib/api';

type IssuedCredential = {
  id: string;
  title: string;
  status: string;
  publicId: string;
  learner?: { name: string };
};

export default function IssuerDashboardScreen() {
  const { user, token, logout, refreshUser } = useAuth();
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reload whenever the dashboard is shown, and re-check approval (an admin may have approved this issuer).
  useFocusEffect(useCallback(() => {
    if (!user || !token) {
      router.replace('/');
      return;
    }
    void refreshUser().catch(() => undefined);

    apiFetch<{ credentials: IssuedCredential[] }>('/issuer/credentials', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => setCredentials(data.credentials ?? []))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Could not load issued credentials.');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on focus or new token, not on every user refresh
  }, [token]));

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header panel: organisation name and summary counts on a dark background. */}
      <View style={styles.hero}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Issuer dashboard</Text>
            <Text style={styles.title}>{user?.name}</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton} accessibilityRole="button" accessibilityLabel="Log out">
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.metricLabel}>Issued</Text>
            <Text style={styles.metricValue}>{credentials.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.metricLabel}>Active</Text>
            <Text style={styles.metricValue}>{credentials.filter((item) => item.status === 'ACTIVE').length}</Text>
          </View>
        </View>
      </View>

      <IssuerApprovalNotice />

      <Text style={styles.sectionTitle} accessibilityRole="header">Latest issued credentials</Text>
      {loading ? (
        <Text style={styles.emptyText}>Loading issued credentials…</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      ) : credentials.length === 0 ? (
        <Text style={styles.emptyText}>No issued credentials yet.</Text>
      ) : (
        credentials.slice(0, 4).map((credential) => (
          <Link href={`/issuer/issued`} key={credential.id} asChild>
            <Pressable
              style={styles.card}
              accessibilityRole="link"
              accessibilityLabel={`${credential.title}, issued to ${credential.learner?.name ?? 'learner'}, ${credential.status.toLowerCase()}`}>
              <CredentialThumb title={credential.title} />
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{credential.title}</Text>
                <Text style={styles.cardMeta}>{credential.learner?.name ?? 'Learner'} · {credential.status}</Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  hero: { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, marginBottom: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerCopy: { flex: 1 },
  kicker: { color: '#bdbdbd', fontWeight: '700', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginTop: 6 },
  logoutButton: { backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  logoutText: { color: '#1e1e1e', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 14, padding: 16 },
  metricLabel: { color: '#cfcfcf', fontSize: 12, marginBottom: 6 },
  metricValue: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#232323', marginBottom: 12 },
  emptyText: { color: '#5b5b5b' },
  errorText: { color: '#9a352c' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#232323' },
  cardMeta: { color: '#5b5b5b', marginTop: 6 },
});
