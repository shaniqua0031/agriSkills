import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

type VerificationEvent = {
  id: string;
  credentialId: string;
  credentialTitle: string;
  result: string;
  source: 'page' | 'app' | 'employer' | 'profile';
  createdAt: string;
};

type History = {
  summary: { total: number; last30Days: number; lastCheckedAt: string | null };
  events: VerificationEvent[];
};

const SOURCE_LABELS: Record<VerificationEvent['source'], string> = {
  page: 'Opened your link in a browser',
  app: 'Checked in the AgriSkills app',
  employer: 'Checked by a registered employer',
  profile: 'Opened your profile link',
};

const RESULT_LABELS: Record<string, { text: string; good: boolean }> = {
  VERIFIED: { text: 'Shown as verified', good: true },
  EXPIRED: { text: 'Shown as expired', good: false },
  REVOKED: { text: 'Shown as revoked', good: false },
  PENDING: { text: 'Shown as pending', good: false },
  LINK_EXPIRED: { text: 'Link had expired', good: false },
  LINK_REVOKED: { text: 'Link was turned off', good: false },
  INVALID: { text: 'Failed the integrity check', good: false },
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * "Who checked": when someone opened the learner's share links, how, and what they saw.
 * Pass a credentialId to show one credential; leave it out for the whole passport.
 */
export function VerificationHistory({ credentialId, limit = 5 }: { credentialId?: string; limit?: number }) {
  const { token, isOfflineSession } = useAuth();
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || isOfflineSession) return;
    const query = credentialId ? `?credentialId=${encodeURIComponent(credentialId)}` : '';
    apiFetch<History>(`/learner/verifications${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(setHistory)
      .catch((requestError: unknown) =>
        setError(requestError instanceof Error ? requestError.message : 'Could not load who checked.'));
  }, [token, credentialId, isOfflineSession]);

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">Who checked</Text>
      {isOfflineSession ? (
        <Text style={styles.muted}>Shown when you are back online.</Text>
      ) : error ? (
        <Text style={styles.error} accessibilityRole="alert">{error}</Text>
      ) : !history ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : history.summary.total === 0 ? (
        <Text style={styles.muted}>
          Nobody has opened your share links yet. When an employer scans your QR code or opens your link, it shows up here.
        </Text>
      ) : (
        <>
          <Text style={styles.summary}>
            Checked {history.summary.total} {history.summary.total === 1 ? 'time' : 'times'}
            {' · '}
            {history.summary.last30Days} in the last 30 days
          </Text>
          {history.events.slice(0, limit).map((event) => {
            const result = RESULT_LABELS[event.result] ?? { text: event.result, good: false };
            return (
              <View key={event.id} style={styles.row}>
                <View style={[styles.dot, result.good ? styles.dotGood : styles.dotOther]} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{formatWhen(event.createdAt)}</Text>
                  {credentialId ? null : <Text style={styles.rowText}>{event.credentialTitle}</Text>}
                  <Text style={styles.rowText}>{SOURCE_LABELS[event.source]} · {result.text}</Text>
                </View>
              </View>
            );
          })}
          <Text style={styles.note}>
            Employers stay anonymous. Opening your own link to test it also counts as a check.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700', color: '#232323', marginBottom: 6 },
  summary: { color: '#232323', fontWeight: '600', fontSize: 14, marginBottom: 6 },
  muted: { color: '#5b5b5b', fontSize: 14, lineHeight: 20 },
  error: { color: '#9a352c', fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#eeeeee' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  dotGood: { backgroundColor: '#2e7d4f' },
  dotOther: { backgroundColor: '#c99a00' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#232323', fontWeight: '700', fontSize: 14 },
  rowText: { color: '#5b5b5b', fontSize: 13, marginTop: 2 },
  note: { color: '#6b6b6b', fontSize: 12, marginTop: 8 },
});
