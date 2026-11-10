import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

type Issuer = {
  id: string;
  name: string;
  email: string;
  signedUpAt: string;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  issuedCount: number;
};
type Tab = 'pending' | 'approved';
// Second tap needed for actions that can't be undone easily.
type Confirming = { id: string; action: 'decline' | 'withdraw' } | null;

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : '');

export default function AdminScreen() {
  const { user, token, logout } = useAuth();
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ issuers: Issuer[] }>('/admin/issuers', { headers: { Authorization: `Bearer ${token}` } });
      setIssuers(data.issuers);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load issuers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user || !token) {
      router.replace('/');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace('/');
      return;
    }
    void load();
  }, [user, token, load]);

  const act = async (issuer: Issuer, action: 'approve' | 'decline' | 'withdraw') => {
    if ((action === 'decline' || action === 'withdraw') && !(confirming?.id === issuer.id && confirming.action === action)) {
      setConfirming({ id: issuer.id, action });
      return;
    }
    setConfirming(null);
    setBusyId(issuer.id);
    setError('');
    setNotice('');
    try {
      if (action === 'decline') {
        await apiFetch(`/admin/issuers/${encodeURIComponent(issuer.id)}`, { method: 'DELETE', headers });
        setNotice(`${issuer.name} was declined and their pending account removed.`);
      } else {
        const data = await apiFetch<{ message: string }>(`/admin/issuers/${encodeURIComponent(issuer.id)}/${action}`, { method: 'POST', headers });
        setNotice(data.message);
      }
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'That action failed. Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const pending = issuers.filter((issuer) => !issuer.approved);
  const approved = issuers.filter((issuer) => issuer.approved);
  const shown = tab === 'pending' ? pending : approved;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <View style={styles.page}>
        {/* Header panel: title, signed-in admin and approval counts on a dark background. */}
        <View style={styles.hero}>
          <View style={styles.headerRow}>
            <View style={styles.flex}>
              <Text style={styles.kicker}>Admin</Text>
              <Text style={styles.title}>Issuer approvals</Text>
              <Text style={styles.subtitle}>Signed in as {user?.name}</Text>
            </View>
            <Pressable onPress={() => { logout(); router.replace('/'); }} style={styles.logoutButton} accessibilityRole="button">
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.metricLabel}>Pending</Text>
              <Text style={styles.metricValue}>{loading ? '–' : pending.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.metricLabel}>Approved</Text>
              <Text style={styles.metricValue}>{loading ? '–' : approved.length}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.help}>
          New issuers can't issue credentials until you approve them. Approve an issuer only after checking that it is a
          genuine training provider, for example its accreditation with AgriSETA or the QCTO.
        </Text>

        <View style={styles.tabs} accessibilityRole="tablist">
          {(['pending', 'approved'] as Tab[]).map((value) => {
            const count = value === 'pending' ? pending.length : approved.length;
            const active = tab === value;
            return (
              <Pressable
                key={value}
                onPress={() => { setTab(value); setConfirming(null); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {value === 'pending' ? 'Pending' : 'Approved'} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color="#1e1e1e" style={styles.loader} />
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{tab === 'pending' ? 'No issuers waiting' : 'No approved issuers yet'}</Text>
            <Text style={styles.muted}>
              {tab === 'pending' ? 'New issuer sign-ups (and issuers whose approval you withdraw) appear here.' : 'Issuers you approve appear here.'}
            </Text>
          </View>
        ) : (
          shown.map((issuer) => {
            const busy = busyId === issuer.id;
            const confirmingThis = confirming?.id === issuer.id ? confirming.action : null;
            return (
              <View key={issuer.id} style={styles.card}>
                <Text style={styles.name}>{issuer.name}</Text>
                <Text style={styles.email}>{issuer.email}</Text>
                <Text style={styles.meta}>
                  Signed up {formatDate(issuer.signedUpAt)}
                  {issuer.approved ? ` · Approved ${formatDate(issuer.approvedAt)} by ${issuer.approvedBy}` : ''}
                  {` · ${issuer.issuedCount} credential${issuer.issuedCount === 1 ? '' : 's'} issued`}
                </Text>

                <View style={styles.actions}>
                  {issuer.approved ? (
                    <ActionButton
                      label={confirmingThis === 'withdraw' ? 'Tap again to withdraw' : 'Withdraw approval'}
                      tone={confirmingThis === 'withdraw' ? 'dangerSolid' : 'danger'}
                      busy={busy}
                      onPress={() => act(issuer, 'withdraw')}
                    />
                  ) : (
                    <>
                      <ActionButton label="Approve" tone="primary" busy={busy} onPress={() => act(issuer, 'approve')} />
                      <ActionButton
                        label={confirmingThis === 'decline' ? 'Tap again to decline' : 'Decline'}
                        tone={confirmingThis === 'decline' ? 'dangerSolid' : 'danger'}
                        busy={busy}
                        onPress={() => act(issuer, 'decline')}
                      />
                    </>
                  )}
                </View>
                {confirmingThis ? (
                  <Text style={styles.confirmHint}>
                    {confirmingThis === 'decline'
                      ? 'Declining deletes this account. They can sign up again later.'
                      : 'They will no longer be able to issue or revoke. Credentials already issued stay valid.'}{' '}
                    <Text style={styles.cancel} onPress={() => setConfirming(null)}>Cancel</Text>
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function ActionButton({ label, tone, busy, onPress }: {
  label: string;
  tone: 'primary' | 'danger' | 'dangerSolid';
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      style={[styles.button, styles[tone], busy && styles.busy]}>
      <Text style={[styles.buttonText, tone === 'danger' && styles.dangerText]}>{busy ? 'Working...' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 48, alignItems: 'center' },
  page: { width: '100%', maxWidth: 760 },
  hero: { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  kicker: { color: '#bdbdbd', fontWeight: '700', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '800', color: '#ffffff', marginTop: 4 },
  subtitle: { color: '#cfcfcf', fontSize: 13, marginTop: 2 },
  logoutButton: { backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#1e1e1e', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 14, padding: 16 },
  metricLabel: { color: '#cfcfcf', fontSize: 12, marginBottom: 6 },
  metricValue: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  help: { color: '#5b5b5b', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  tabs: { flexDirection: 'row', backgroundColor: '#eaeaea', borderRadius: 12, padding: 4, marginBottom: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: '#1e1e1e' },
  tabText: { color: '#4f4f4f', fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },
  notice: { backgroundColor: '#f3f3f3', color: '#353535', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 14 },
  error: { backgroundColor: '#fdecea', color: '#8a1c12', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 14 },
  loader: { marginTop: 24 },
  empty: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, alignItems: 'center', gap: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#232323' },
  muted: { color: '#666666', fontSize: 14, textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12 },
  name: { fontSize: 17, fontWeight: '800', color: '#232323' },
  email: { color: '#1e1e1e', fontSize: 14, marginTop: 2 },
  meta: { color: '#666666', fontSize: 12, marginTop: 6, lineHeight: 17 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16, borderWidth: 1.5 },
  primary: { backgroundColor: '#1e1e1e', borderColor: '#1e1e1e' },
  danger: { backgroundColor: '#ffffff', borderColor: '#b42318' },
  dangerSolid: { backgroundColor: '#b42318', borderColor: '#b42318' },
  busy: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  dangerText: { color: '#b42318' },
  confirmHint: { color: '#7a4a00', fontSize: 12, lineHeight: 17, marginTop: 8 },
  cancel: { color: '#1e1e1e', fontWeight: '700', textDecorationLine: 'underline' },
});
