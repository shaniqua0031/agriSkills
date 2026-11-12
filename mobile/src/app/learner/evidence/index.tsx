import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';
import { REVIEW_LABELS, type Evidence } from '@/lib/evidence';

export default function EvidenceListScreen() {
  const { token } = useAuth();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reload whenever the tab is shown, so new or deleted evidence appears straight away.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setError('');
      apiFetch<{ evidence: Evidence[] }>('/learner/evidence', { headers: { Authorization: `Bearer ${token}` } })
        .then((data) => setEvidence(data.evidence ?? []))
        .catch((requestError: unknown) => {
          setError(requestError instanceof Error ? requestError.message : 'Could not load your evidence.');
        })
        .finally(() => setLoading(false));
    }, [token]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading} accessibilityRole="header">Skills evidence</Text>
      <Text style={styles.intro}>
        Record proof of skills you already have, such as a photo of your work, a short note and who supervised you.
        It can be reviewed for recognition of prior learning (RPL).
      </Text>

      <Pressable
        style={styles.primaryButton}
        accessibilityRole="button"
        onPress={() => router.push('/learner/evidence/new' as never)}>
        <Text style={styles.primaryButtonText}>+ Add evidence</Text>
      </Pressable>

      {loading ? (
        <Text style={styles.muted}>Loading evidence...</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      ) : evidence.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No evidence yet</Text>
          <Text style={styles.muted}>Tap “Add evidence” to record your first skill.</Text>
        </View>
      ) : (
        evidence.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`${item.skill}, ${REVIEW_LABELS[item.reviewStatus]}`}
            onPress={() => router.push(`/learner/evidence/${item.id}` as never)}>
            <Text style={styles.title}>{item.skill}</Text>
            <Text style={styles.badge}>{REVIEW_LABELS[item.reviewStatus]}</Text>
            <Text style={styles.note} numberOfLines={2}>{item.note}</Text>
            <Text style={styles.meta}>
              {new Date(item.createdAt).toLocaleDateString()}
              {item.hasPhoto ? ' · Photo' : ''}
              {item.locationConsent ? ' · Location' : ''}
              {' · '}
              {item.reviewer ? `Reviewer: ${item.reviewer.name}` : 'No reviewer chosen'}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 26, fontWeight: '700', color: '#232323', marginBottom: 8 },
  intro: { color: '#5b5b5b', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  primaryButton: { backgroundColor: '#1e1e1e', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  muted: { color: '#5b5b5b' },
  errorText: { color: '#9a352c' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#232323' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#232323' },
  badge: { color: '#1e1e1e', fontWeight: '700', textTransform: 'uppercase', fontSize: 11, marginTop: 8 },
  note: { color: '#252525', fontSize: 14, marginTop: 8, lineHeight: 20 },
  meta: { color: '#5b5b5b', fontSize: 12, marginTop: 8 },
});
