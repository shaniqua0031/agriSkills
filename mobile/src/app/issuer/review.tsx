import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';
import { REVIEW_LABELS, absolutePhotoUrl, formatDate, type EvidenceForReview } from '@/lib/evidence';

type Tab = 'waiting' | 'reviewed';

/** Skills evidence that learners have asked this training provider to review. */
export default function ReviewEvidenceScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<EvidenceForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('waiting');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ evidence: EvidenceForReview[] }>('/issuer/evidence', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(data.evidence);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load evidence to review.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const waiting = items.filter((item) => item.reviewStatus === 'SUBMITTED');
  const reviewed = items.filter((item) => item.reviewStatus !== 'SUBMITTED');
  const shown = tab === 'waiting' ? waiting : reviewed;

  const replace = (updated: EvidenceForReview) =>
    setItems((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <Text style={styles.kicker}>Skills evidence</Text>
      <Text style={styles.heading}>Evidence to review</Text>
      <Text style={styles.help}>
        Learners chose you to check proof of skills they already have. Approve it if the evidence shows the skill. If not,
        tell the learner why.
      </Text>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['waiting', 'reviewed'] as Tab[]).map((value) => {
          const active = tab === value;
          const count = value === 'waiting' ? waiting.length : reviewed.length;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {value === 'waiting' ? 'Waiting' : 'Reviewed'} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {loading ? (
        <Text style={styles.muted}>Loading evidence...</Text>
      ) : shown.length === 0 && !error ? (
        <Text style={styles.muted}>
          {tab === 'waiting' ? 'Nothing waiting for review.' : 'You haven’t reviewed any evidence yet.'}
        </Text>
      ) : (
        shown.map((item) => <EvidenceCard key={item.id} item={item} token={token} onReviewed={replace} />)
      )}
    </ScrollView>
  );
}

function EvidenceCard({
  item,
  token,
  onReviewed,
}: {
  item: EvidenceForReview;
  token: string | null;
  onReviewed: (updated: EvidenceForReview) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'' | 'APPROVED' | 'REJECTED'>('');
  const [error, setError] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUri = absolutePhotoUrl(item.photoUrl);

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!token) return;
    if (decision === 'REJECTED' && !note.trim()) {
      setError('Add a note telling the learner why it isn’t approved.');
      return;
    }
    setBusy(decision);
    setError('');
    try {
      const data = await apiFetch<{ evidence: EvidenceForReview }>(`/issuer/evidence/${encodeURIComponent(item.id)}/review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { decision, note: note.trim() || null },
      });
      onReviewed(data.evidence);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save your decision.');
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.skill}</Text>
      <Text style={styles.meta}>{item.learner.name} · {formatDate(item.createdAt)}</Text>

      {item.hasPhoto ? (
        photoUri && !photoFailed ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => setPhotoFailed(true)}
            accessibilityLabel={`Evidence photo for ${item.skill}`}
          />
        ) : (
          <Text style={styles.muted}>The photo can’t be shown right now. Pull down to refresh.</Text>
        )
      ) : null}

      <Text style={styles.label}>What was done</Text>
      <Text style={styles.value}>{item.note}</Text>

      {item.locationConsent && item.locationLatitude !== null ? (
        <>
          <Text style={styles.label}>Location stamp</Text>
          <Text style={styles.value}>{item.locationLatitude}, {item.locationLongitude}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Supervisor (you may contact them to check)</Text>
      <Text style={styles.value}>
        {item.supervisorName
          ? `${item.supervisorName}${item.supervisorContact ? ` · ${item.supervisorContact}` : ''}`
          : 'Not named'}
      </Text>

      {item.reviewStatus === 'SUBMITTED' ? (
        <>
          <Text style={styles.label}>Note to the learner (needed if not approved)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Please add a photo of the finished installation."
            multiline
            maxLength={1000}
            style={styles.input}
          />
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              style={[styles.approve, busy && styles.disabled]}
              disabled={Boolean(busy)}
              onPress={() => decide('APPROVED')}
              accessibilityRole="button">
              <Text style={styles.approveText}>{busy === 'APPROVED' ? 'Saving...' : 'Approve'}</Text>
            </Pressable>
            <Pressable
              style={[styles.reject, busy && styles.disabled]}
              disabled={Boolean(busy)}
              onPress={() => decide('REJECTED')}
              accessibilityRole="button">
              <Text style={styles.rejectText}>{busy === 'REJECTED' ? 'Saving...' : 'Not approved'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.decision}>
          <Text style={[styles.decisionText, item.reviewStatus === 'REJECTED' && styles.decisionRejected]}>
            {REVIEW_LABELS[item.reviewStatus]}{item.reviewedAt ? ` on ${formatDate(item.reviewedAt)}` : ''}
          </Text>
          {item.reviewNote ? <Text style={styles.value}>{item.reviewNote}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 48 },
  kicker: { color: '#1e1e1e', fontWeight: '700', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
  heading: { fontSize: 26, fontWeight: '700', color: '#232323', marginTop: 6 },
  help: { color: '#5b5b5b', fontSize: 14, lineHeight: 20, marginTop: 6 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#e5e5e5', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#1e1e1e', borderColor: '#1e1e1e' },
  tabText: { color: '#353535', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  muted: { color: '#5b5b5b', marginTop: 12 },
  errorText: { color: '#9a352c', fontSize: 14, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginTop: 14 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#232323' },
  meta: { color: '#666666', fontSize: 13, marginTop: 2 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginTop: 12, backgroundColor: '#e5e5e5' },
  label: { color: '#666666', fontSize: 12, marginTop: 12, marginBottom: 4, fontWeight: '600' },
  value: { color: '#252525', fontSize: 15, lineHeight: 22 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  approve: { flex: 1, backgroundColor: '#1e1e1e', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  approveText: { color: '#fff', fontWeight: '700' },
  reject: { flex: 1, borderWidth: 1, borderColor: '#9a352c', borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff' },
  rejectText: { color: '#9a352c', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  decision: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#eeeeee', paddingTop: 12, gap: 4 },
  decisionText: { color: '#14532d', fontWeight: '700' },
  decisionRejected: { color: '#9a352c' },
});
