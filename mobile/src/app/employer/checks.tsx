import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { StatusPill } from '@/components/verification-result';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';
import { statusStyle, type EmployerCheck } from '@/lib/verification';

type Filter = 'ALL' | 'VERIFIED' | 'ATTENTION';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'ATTENTION', label: 'Need a look' },
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function EmployerChecksScreen() {
  const { token } = useAuth();
  const [checks, setChecks] = useState<EmployerCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ checks: EmployerCheck[] }>('/employer/checks', { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => { setChecks(data.checks ?? []); setError(''); })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Could not load your checks.'))
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(load);

  const replace = (updated: EmployerCheck) =>
    setChecks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  const remove = (id: string) => setChecks((current) => current.filter((item) => item.id !== id));

  const shown = checks.filter((item) =>
    filter === 'ALL' ? true : filter === 'VERIFIED' ? item.result === 'VERIFIED' : item.result !== 'VERIFIED');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading} accessibilityRole="header">Checked credentials</Text>
      <Text style={styles.subheading}>
        Everyone you have checked. Tap “Check again” before you hire, to see if anything changed.
      </Text>

      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((option) => {
          const selected = filter === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setFilter(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.filter, selected && styles.filterSelected]}>
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Loading your checks…</Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      ) : shown.length === 0 ? (
        <Text style={styles.emptyText}>
          {checks.length === 0 ? 'Nobody checked yet. Use the Check tab to check a credential link.' : 'No checks match this filter.'}
        </Text>
      ) : (
        shown.map((item) => (
          <CheckCard key={item.id} check={item} token={token ?? ''} onChange={replace} onDelete={remove} />
        ))
      )}
    </ScrollView>
  );
}

function CheckCard({ check, token, onChange, onDelete }: {
  check: EmployerCheck;
  token: string;
  onChange: (check: EmployerCheck) => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState<'' | 'recheck' | 'note' | 'delete'>('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(check.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const run = async (kind: 'recheck' | 'note' | 'delete', action: () => Promise<void>) => {
    setBusy(kind);
    setMessage('');
    try {
      await action();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'Something went wrong. Try again.');
    } finally {
      setBusy('');
    }
  };

  const recheck = () => run('recheck', async () => {
    const before = check.result;
    const data = await apiFetch<{ check: EmployerCheck }>(`/employer/checks/${check.id}/recheck`, { method: 'POST', headers });
    onChange(data.check);
    setMessage(data.check.result === before
      ? `Checked again: still ${statusStyle(data.check.result).label.toLowerCase()}.`
      : `Changed: now ${statusStyle(data.check.result).label.toLowerCase()}.`);
  });

  const saveNote = () => run('note', async () => {
    const data = await apiFetch<{ check: EmployerCheck }>(`/employer/checks/${check.id}`, {
      method: 'PATCH',
      headers,
      body: { note: draft.trim() },
    });
    onChange(data.check);
    setEditing(false);
  });

  const deleteCheck = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    void run('delete', async () => {
      await apiFetch(`/employer/checks/${check.id}`, { method: 'DELETE', headers });
      onDelete(check.id);
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{check.learnerName ?? 'Unknown learner'}</Text>
          <Text style={styles.cardMeta}>{check.credentialTitle ?? 'Credential details hidden'}</Text>
          {check.issuerName ? <Text style={styles.cardMeta}>Issued by {check.issuerName}</Text> : null}
        </View>
        <StatusPill status={check.result} />
      </View>
      <Text style={styles.time}>Last checked {formatDateTime(check.checkedAt)}</Text>

      {editing ? (
        <View style={styles.noteEditor}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. Interviewed 12 Nov"
            placeholderTextColor="#969696"
            maxLength={500}
            multiline
            accessibilityLabel="Note"
            style={styles.noteInput}
          />
          <View style={styles.actions}>
            <SmallButton label={busy === 'note' ? 'Saving…' : 'Save note'} onPress={saveNote} disabled={Boolean(busy)} primary />
            <SmallButton label="Cancel" onPress={() => { setEditing(false); setDraft(check.note ?? ''); }} disabled={Boolean(busy)} />
          </View>
        </View>
      ) : check.note ? (
        <Text style={styles.note}>📝 {check.note}</Text>
      ) : null}

      {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}

      {!editing ? (
        <View style={styles.actions}>
          {check.canRecheck ? (
            <SmallButton label={busy === 'recheck' ? 'Checking…' : 'Check again'} onPress={recheck} disabled={Boolean(busy)} primary />
          ) : null}
          <SmallButton label={check.note ? 'Edit note' : 'Add note'} onPress={() => setEditing(true)} disabled={Boolean(busy)} />
          <SmallButton
            label={busy === 'delete' ? 'Deleting…' : confirmDelete ? 'Tap again to delete' : 'Delete'}
            onPress={deleteCheck}
            disabled={Boolean(busy)}
            danger
          />
        </View>
      ) : null}
    </View>
  );
}

function SmallButton({ label, onPress, disabled, primary, danger }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.smallButton,
        primary && styles.smallPrimary,
        danger && styles.smallDanger,
        (pressed || disabled) && styles.smallPressed,
      ]}>
      <Text style={[styles.smallText, primary && styles.smallTextPrimary, danger && styles.smallTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 26, fontWeight: '700', color: '#232323' },
  subheading: { color: '#5b5b5b', fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filter: { borderRadius: 999, borderWidth: 1.5, borderColor: '#dfdfdf', backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 8 },
  filterSelected: { borderColor: '#1e1e1e', backgroundColor: '#1e1e1e' },
  filterText: { color: '#353535', fontWeight: '700' },
  filterTextSelected: { color: '#ffffff' },
  emptyText: { color: '#5b5b5b' },
  errorText: { color: '#8a1c12' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#232323' },
  cardMeta: { color: '#5b5b5b', marginTop: 3 },
  time: { color: '#7a7a7a', fontSize: 12 },
  note: { color: '#353535', backgroundColor: '#f5f5f5', borderRadius: 10, padding: 10, fontSize: 14, lineHeight: 20 },
  noteEditor: { gap: 8 },
  noteInput: { borderWidth: 1.5, borderColor: '#dfdfdf', borderRadius: 10, padding: 10, minHeight: 60, fontSize: 15, color: '#232323', backgroundColor: '#ffffff' },
  message: { color: '#353535', fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  smallButton: { borderRadius: 10, borderWidth: 1.5, borderColor: '#dfdfdf', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#ffffff' },
  smallPrimary: { backgroundColor: '#1e1e1e', borderColor: '#1e1e1e' },
  smallDanger: { borderColor: '#f1c4bf' },
  smallPressed: { opacity: 0.6 },
  smallText: { color: '#1e1e1e', fontWeight: '700', fontSize: 13 },
  smallTextPrimary: { color: '#ffffff' },
  smallTextDanger: { color: '#9a352c' },
});
