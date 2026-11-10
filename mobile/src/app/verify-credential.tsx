import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthShell } from '@/components/auth/auth-shell';
import { FormField } from '@/components/auth/form-field';
import { API_BASE_URL } from '@/lib/api';

// Employers and other verifiers don't need an account: they paste the link (or code) the
// learner shared, and see the same public result as the link's own verification page.

type Result = {
  valid: boolean;
  status: string;
  message: string;
  learner: { name: string } | null;
  credential: {
    title: string;
    issuer: string;
    issueDate: string;
    expiryDate: string | null;
    publicId: string;
    skills: string[];
  } | null;
  linkExpiresAt: string | null;
};

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Accepts a full share link (…/verify/<token>) or just the token. */
function extractToken(input: string) {
  const trimmed = input.trim();
  if (TOKEN.test(trimmed)) return trimmed;
  const match = /\/verify\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/.exec(trimmed);
  return match?.[1] ?? null;
}

const STATUS_STYLE: Record<string, { label: string; color: string; background: string }> = {
  VERIFIED: { label: 'Verified', color: '#141414', background: '#dcfce7' },
  EXPIRED: { label: 'Expired', color: '#7a4a00', background: '#fff1d6' },
  PENDING: { label: 'Not active yet', color: '#7a4a00', background: '#fff1d6' },
  REVOKED: { label: 'Revoked', color: '#8a1c12', background: '#fdecea' },
  INVALID: { label: 'Verification failed', color: '#8a1c12', background: '#fdecea' },
  LINK_EXPIRED: { label: 'Link expired', color: '#7a4a00', background: '#fff1d6' },
  LINK_REVOKED: { label: 'Link turned off', color: '#7a4a00', background: '#fff1d6' },
  NOT_FOUND: { label: 'Not found', color: '#8a1c12', background: '#fdecea' },
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'No expiry');

export default function VerifyCredentialScreen() {
  const params = useLocalSearchParams<{ link?: string }>();
  const [input, setInput] = useState(typeof params.link === 'string' ? params.link : '');
  const [inputError, setInputError] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    const token = extractToken(input);
    setResult(null);
    setError('');
    if (!token) {
      setInputError('Paste the full verification link the learner shared, e.g. https://…/verify/AbC123…');
      return;
    }
    setLoading(true);
    try {
      // The API answers 404/410 with a normal result body, so read it whatever the status.
      const response = await fetch(`${API_BASE_URL}/api/verify/${token}`);
      const body = (await response.json()) as Result;
      if (!body?.status) throw new Error('Unexpected response.');
      setResult(body);
    } catch {
      setError("Couldn't check this link right now. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const look = result ? STATUS_STYLE[result.status] ?? STATUS_STYLE.NOT_FOUND : null;

  return (
    <AuthShell
      title="Verify a credential"
      subtitle="Paste the verification link a learner shared with you. No account is needed.">
      <FormField
        label="Verification link"
        value={input}
        onChangeText={(value) => { setInput(value); setInputError(''); }}
        error={inputError}
        placeholder="https://…/verify/…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={check}
        editable={!loading}
      />
      <AuthButton label="Check credential" loadingLabel="Checking..." loading={loading} onPress={check} />

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {result && look ? (
        <View style={styles.result} accessibilityLiveRegion="polite">
          <View style={[styles.status, { backgroundColor: look.background }]}>
            <Text style={[styles.statusLabel, { color: look.color }]}>{result.valid ? '✓ ' : ''}{look.label}</Text>
            <Text style={[styles.statusMessage, { color: look.color }]}>{result.message}</Text>
          </View>
          {result.credential ? (
            <View style={styles.details}>
              <Text style={styles.credentialTitle}>{result.credential.title}</Text>
              <Detail label="Holder" value={result.learner?.name ?? 'Unknown'} />
              <Detail label="Issued by" value={result.credential.issuer} />
              <Detail label="Issue date" value={formatDate(result.credential.issueDate)} />
              <Detail label="Expiry date" value={formatDate(result.credential.expiryDate)} />
              {result.credential.skills.length > 0 ? <Detail label="Skills" value={result.credential.skills.join(', ')} /> : null}
              <Detail label="Reference" value={result.credential.publicId} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Have an account?</Text>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" hitSlop={6}>
            <Text style={styles.link}>Log in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorBox: { backgroundColor: '#fdecea', borderRadius: 12, padding: 12, marginTop: 14, borderLeftWidth: 4, borderLeftColor: '#b42318' },
  errorText: { color: '#8a1c12', fontSize: 14, lineHeight: 20 },
  result: { marginTop: 18, gap: 12 },
  status: { borderRadius: 14, padding: 14 },
  statusLabel: { fontSize: 18, fontWeight: '800' },
  statusMessage: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  details: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, gap: 8 },
  credentialTitle: { fontSize: 17, fontWeight: '800', color: '#232323', marginBottom: 2 },
  detail: { gap: 2 },
  detailLabel: { color: '#666666', fontSize: 12, fontWeight: '700' },
  detailValue: { color: '#252525', fontSize: 15, lineHeight: 21 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 18 },
  footerText: { color: '#5b5b5b', fontSize: 14 },
  link: { color: '#1e1e1e', fontWeight: '700', fontSize: 14 },
});
