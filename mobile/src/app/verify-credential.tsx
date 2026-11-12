import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthShell } from '@/components/auth/auth-shell';
import { FormField } from '@/components/auth/form-field';
import { ProfileResultCard, VerificationResultCard } from '@/components/verification-result';
import { API_BASE_URL } from '@/lib/api';
import { parseShareLink, type ProfileVerification, type VerificationResult } from '@/lib/verification';

// Anyone can check a credential without an account: paste the link (or code) the learner shared
// and see the same public result as the link's own verification page. A profile link
// (…/profile/…) shows several credentials, each with its own result. Employers who sign up also
// get a dashboard that keeps a list of the people they checked.

type Checked =
  | { kind: 'credential'; result: VerificationResult }
  | { kind: 'profile'; result: ProfileVerification };

export default function VerifyCredentialScreen() {
  const params = useLocalSearchParams<{ link?: string }>();
  const [input, setInput] = useState(typeof params.link === 'string' ? params.link : '');
  const [inputError, setInputError] = useState('');
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    const link = parseShareLink(input);
    setChecked(null);
    setError('');
    if (!link) {
      setInputError('Paste the full verification link the learner shared, e.g. https://…/verify/AbC123…');
      return;
    }
    setLoading(true);
    try {
      // The API answers 404/410 with a normal result body, so read it whatever the status.
      const path = link.kind === 'profile' ? 'profile' : 'verify';
      const response = await fetch(`${API_BASE_URL}/api/${path}/${link.token}`);
      const body = await response.json();
      if (!body?.status) throw new Error('Unexpected response.');
      setChecked({ kind: link.kind, result: body } as Checked);
    } catch {
      setError("Couldn't check this link right now. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Verify a credential"
      subtitle="Paste the verification or profile link a learner shared with you. No account is needed.">
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

      {checked?.kind === 'credential' ? <VerificationResultCard result={checked.result} /> : null}
      {checked?.kind === 'profile' ? <ProfileResultCard result={checked.result} /> : null}

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

const styles = StyleSheet.create({
  errorBox: { backgroundColor: '#fdecea', borderRadius: 12, padding: 12, marginTop: 14, borderLeftWidth: 4, borderLeftColor: '#b42318' },
  errorText: { color: '#8a1c12', fontSize: 14, lineHeight: 20 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 18 },
  footerText: { color: '#5b5b5b', fontSize: 14 },
  link: { color: '#1e1e1e', fontWeight: '700', fontSize: 14 },
});
