import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { AuthButton } from '@/components/auth/auth-button';
import { FormField } from '@/components/auth/form-field';
import { ProfileResultCard, StatusPill, VerificationResultCard } from '@/components/verification-result';
import { useAuth } from '@/context/auth';
import { API_BASE_URL, apiFetch } from '@/lib/api';
import { parseShareLink, type EmployerCheck, type ProfileVerification, type VerificationResult } from '@/lib/verification';

type CheckResponse = { check: EmployerCheck | null; verification: VerificationResult };

export default function EmployerDashboardScreen() {
  const { user, token, logout } = useAuth();
  const params = useLocalSearchParams<{ link?: string }>();
  const [checks, setChecks] = useState<EmployerCheck[]>([]);
  const [loadError, setLoadError] = useState('');
  const [link, setLink] = useState(typeof params.link === 'string' ? params.link : '');
  const [note, setNote] = useState('');
  const [linkError, setLinkError] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  // Profile links (several credentials) are shown but not saved: the Checked list holds single credentials.
  const [profile, setProfile] = useState<ProfileVerification | null>(null);

  const auth = { Authorization: `Bearer ${token}` };

  const loadChecks = useCallback(() => {
    if (!token) return;
    apiFetch<{ checks: EmployerCheck[] }>('/employer/checks', { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => { setChecks(data.checks ?? []); setLoadError(''); })
      .catch((requestError: unknown) => {
        setLoadError(requestError instanceof Error ? requestError.message : 'Could not load your checks.');
      });
  }, [token]);

  useFocusEffect(loadChecks);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const check = async () => {
    setResult(null);
    setProfile(null);
    setError('');
    const parsed = parseShareLink(link);
    if (!parsed) {
      setLinkError('Paste the full verification link the learner shared, e.g. https://…/verify/AbC123…');
      return;
    }
    setChecking(true);
    try {
      if (parsed.kind === 'profile') {
        // Public endpoint; it answers 404/410 with a normal result body.
        const response = await fetch(`${API_BASE_URL}/api/profile/${parsed.token}`);
        const body = (await response.json()) as ProfileVerification;
        if (!body?.status) throw new Error("Couldn't check this link right now.");
        setProfile(body);
        return;
      }
      const data = await apiFetch<CheckResponse>('/employer/checks', {
        method: 'POST',
        headers: auth,
        body: { link: link.trim(), note: note.trim() || undefined },
      });
      setResult(data);
      if (data.check) {
        setLink('');
        setNote('');
        loadChecks();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn't check this link right now.");
    } finally {
      setChecking(false);
    }
  };

  const verified = checks.filter((item) => item.result === 'VERIFIED').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header panel: employer name and summary counts on a dark background. */}
      <View style={styles.hero}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Employer dashboard</Text>
            <Text style={styles.title}>{user?.name}</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton} accessibilityRole="button">
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.metricLabel}>Checked</Text>
            <Text style={styles.metricValue}>{checks.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.metricLabel}>Verified</Text>
            <Text style={styles.metricValue}>{verified}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.metricLabel}>Need a look</Text>
            <Text style={styles.metricValue}>{checks.length - verified}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Check a credential</Text>
        <Text style={styles.help}>
          Paste the link a job applicant shared with you, or scan their QR code with your phone camera and copy the link.
          The result is saved to your Checked list.
        </Text>
        <FormField
          label="Verification link"
          value={link}
          onChangeText={(value) => { setLink(value); setLinkError(''); }}
          error={linkError}
          placeholder="https://…/verify/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!checking}
        />
        <FormField
          label="Note for yourself (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Applied for tractor driver, Farm A"
          maxLength={500}
          returnKeyType="go"
          onSubmitEditing={check}
          editable={!checking}
        />
        <AuthButton label="Check credential" loadingLabel="Checking..." loading={checking} onPress={check} />

        {error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <>
            <VerificationResultCard result={result.verification} />
            <Text style={styles.savedText}>
              {result.check ? 'Saved to your Checked list.' : 'Not saved: this link does not match any shared credential.'}
            </Text>
          </>
        ) : null}

        {profile ? (
          <>
            <ProfileResultCard result={profile} />
            <Text style={styles.savedText}>
              Profile links are not saved to your Checked list. Ask the learner for single credential links if you want to keep them.
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Recently checked</Text>
        {checks.length > 0 ? (
          <Link href="/employer/checks" asChild>
            <Pressable accessibilityRole="link" hitSlop={6}>
              <Text style={styles.seeAll}>See all →</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
      {loadError ? (
        <Text accessibilityRole="alert" style={styles.errorText}>{loadError}</Text>
      ) : checks.length === 0 ? (
        <Text style={styles.emptyText}>Nobody checked yet. Credentials you check appear here.</Text>
      ) : (
        checks.slice(0, 3).map((item) => (
          <Link href="/employer/checks" key={item.id} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{item.learnerName ?? 'Unknown learner'}</Text>
                <Text style={styles.cardMeta}>{item.credentialTitle ?? 'Credential details hidden'}</Text>
              </View>
              <StatusPill status={item.result} />
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  hero: { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, marginBottom: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerCopy: { flex: 1 },
  kicker: { color: '#bdbdbd', fontWeight: '700', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginTop: 6 },
  logoutButton: { backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#1e1e1e', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 14, padding: 14 },
  metricLabel: { color: '#cfcfcf', fontSize: 12, marginBottom: 6 },
  metricValue: { fontSize: 26, fontWeight: '700', color: '#ffffff' },
  panel: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#232323', marginBottom: 8 },
  seeAll: { color: '#1e1e1e', fontWeight: '700', marginBottom: 8 },
  help: { color: '#5b5b5b', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  savedText: { color: '#5b5b5b', fontSize: 13, marginTop: 10 },
  errorBox: { backgroundColor: '#fdecea', borderRadius: 12, padding: 12, marginTop: 14, borderLeftWidth: 4, borderLeftColor: '#b42318' },
  errorText: { color: '#8a1c12', fontSize: 14, lineHeight: 20 },
  emptyText: { color: '#5b5b5b' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#232323' },
  cardMeta: { color: '#5b5b5b', marginTop: 4 },
});
