import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFocusEffect } from 'expo-router';

import { CredentialThumb } from '@/components/credential-thumb';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

type Credential = { id: string; title: string; status: string; learner?: { name: string } };

export default function IssuedCredentialsScreen() {
  const { token } = useAuth();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Reload whenever this tab is shown, so newly issued credentials appear straight away.
  useFocusEffect(useCallback(() => {
    if (!token) {
      setLoading(false);
      setError('Sign in as an issuer to view credentials.');
      return;
    }

    apiFetch<{ credentials: Credential[] }>('/issuer/credentials', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => setCredentials(data.credentials ?? []))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Could not load issued credentials.');
      })
      .finally(() => setLoading(false));
  }, [token]));

  const revokeCredential = async (id: string) => {
    if (!token) return;
    setRevokingId(id);
    setError('');
    setMessage('');
    try {
      const { credential } = await apiFetch<{ credential: Credential }>(
        `/issuer/credentials/${encodeURIComponent(id)}/revoke`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setCredentials((current) => current.map((item) => item.id === id ? credential : item));
      setMessage('Credential revoked.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not revoke this credential.');
    } finally {
      setRevokingId('');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Issued qualifications</Text>
      {loading ? (
        <Text style={styles.emptyText}>Loading issued qualifications…</Text>
      ) : error && credentials.length === 0 ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      ) : credentials.length === 0 ? (
        <Text style={styles.emptyText}>No qualifications issued yet.</Text>
      ) : (
        credentials.map((credential) => (
          <View style={styles.card} key={credential.id}>
            <View style={styles.cardHeader}>
              <CredentialThumb title={credential.title} size={56} />
              <View style={styles.cardCopy}>
                <Text style={styles.title}>{credential.title}</Text>
                <Text style={styles.meta}>{credential.learner?.name ?? 'Learner'}</Text>
              </View>
              <Text style={[styles.badge, credential.status === 'REVOKED' && styles.revokedBadge]}>
                {credential.status}
              </Text>
            </View>
            {credential.status !== 'REVOKED' ? (
              <Pressable
                accessibilityRole="button"
                disabled={revokingId === credential.id}
                onPress={() => revokeCredential(credential.id)}
                style={styles.revokeButton}>
                <Text style={styles.revokeText}>
                  {revokingId === credential.id ? 'Revoking…' : 'Revoke credential'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
      {error && credentials.length > 0 ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.successText}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  heading: { fontSize: 26, fontWeight: '700', color: '#232323', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e7e7e7' },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardCopy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: '#232323' },
  meta: { color: '#5b5b5b', marginTop: 8 },
  emptyText: { color: '#5b5b5b' },
  badge: { backgroundColor: '#f0f0f0', borderRadius: 20, color: '#1b1b1b', fontSize: 10, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  revokedBadge: { backgroundColor: '#fbe9e7', color: '#9a352c' },
  revokeButton: { alignSelf: 'flex-start', borderColor: '#e9c9c5', borderRadius: 9, borderWidth: 1, marginTop: 14, paddingHorizontal: 12, paddingVertical: 8 },
  revokeText: { color: '#963c32', fontSize: 12, fontWeight: '700' },
  errorText: { color: '#9a352c', marginTop: 8 },
  successText: { color: '#1b1b1b', marginTop: 8 },
});
