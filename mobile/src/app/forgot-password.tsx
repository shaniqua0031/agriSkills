import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthShell } from '@/components/auth/auth-shell';
import { FormField } from '@/components/auth/form-field';
import { PasswordStrength } from '@/components/auth/password-strength';
import { apiFetch } from '@/lib/api';
import { validateEmail, validateNewPassword } from '@/lib/auth-helpers';

type Step = 'request' | 'sent' | 'reset' | 'done';
type Errors = { email?: string; password?: string; confirm?: string };

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const resetToken = typeof params.token === 'string' ? params.token : '';
  const [step, setStep] = useState<Step>(resetToken ? 'reset' : 'request');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devHint, setDevHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    setStep(resetToken ? 'reset' : 'request');
  }, [resetToken]);

  const clear = (field: keyof Errors) => setErrors((current) => ({ ...current, [field]: '' }));

  const requestResetLink = async () => {
    const emailError = validateEmail(email);
    setErrors({ email: emailError });
    setError('');
    if (emailError) return;

    setLoading(true);
    try {
      const data = await apiFetch<{ message: string; delivery: 'email' | 'console' | 'unavailable' }>('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setNotice(data.message);
      setDevHint(data.delivery === 'console');
      setStep('sent');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send a reset link.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const next: Errors = {
      password: validateNewPassword(password),
      confirm: confirm === password ? '' : 'The passwords do not match.',
    };
    setErrors(next);
    setError('');
    if (Object.values(next).some(Boolean)) return;
    if (!resetToken) {
      setError('Open the password reset link from your email to continue.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: { token: resetToken, password },
      });
      setNotice(data.message);
      setStep('done');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Step, [string, string]> = {
    request: ['Forgot password?', "Enter your account's email address and we'll send you a secure reset link."],
    sent: ['Check your email', 'If an account exists for that email, we sent a password reset link. Open the link to choose a new password.'],
    reset: ['Choose a new password', 'Enter your new password and confirm it below.'],
    done: ['Password changed', 'You can now log in with your new password.'],
  };

  return (
    <AuthShell title={titles[step][0]} subtitle={titles[step][1]}>
      {error ? (
        <View style={[styles.banner, styles.bannerError]} accessibilityRole="alert">
          <Text style={styles.bannerErrorText}>{error}</Text>
        </View>
      ) : null}
      {notice && !error ? (
        <View style={[styles.banner, styles.bannerInfo]} accessibilityLiveRegion="polite">
          <Text style={styles.bannerInfoText}>{notice}</Text>
          {devHint && step === 'sent' ? (
            <Text style={styles.devHint}>Development mode: email delivery is not configured. The one-time reset link is printed in the server terminal.</Text>
          ) : null}
        </View>
      ) : null}

      {step === 'request' && (
        <>
          <FormField
            label="Email address"
            value={email}
            onChangeText={(value) => { setEmail(value); clear('email'); }}
            error={errors.email}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={requestResetLink}
            editable={!loading}
          />
          <AuthButton label="Send reset link" loadingLabel="Sending..." loading={loading} onPress={requestResetLink} />
        </>
      )}

      {step === 'sent' && (
        <AuthButton
          label="Back to log in"
          onPress={() => router.replace('/')}
        />
      )}

      {step === 'reset' && (
        <>
          <FormField
            ref={passwordRef}
            label="New password"
            password
            value={password}
            onChangeText={(value) => { setPassword(value); clear('password'); }}
            error={errors.password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            editable={!loading}
          />
          <PasswordStrength password={password} />
          <FormField
            ref={confirmRef}
            label="Confirm new password"
            password
            value={confirm}
            onChangeText={(value) => { setConfirm(value); clear('confirm'); }}
            error={errors.confirm}
            placeholder="Type the password again"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={resetPassword}
            editable={!loading}
          />
          <AuthButton label="Change password" loadingLabel="Saving..." loading={loading} onPress={resetPassword} />
        </>
      )}

      {step === 'done' && <AuthButton label="Back to log in" onPress={() => router.replace('/')} />}

      {step !== 'done' && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Remembered it?</Text>
          <Link href="/" asChild>
            <Pressable accessibilityRole="link" hitSlop={6}>
              <Text style={styles.link}>Back to log in</Text>
            </Pressable>
          </Link>
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 4 },
  bannerError: { backgroundColor: '#fdecea', borderLeftColor: '#b42318' },
  bannerErrorText: { color: '#8a1c12', fontSize: 14, lineHeight: 20 },
  bannerInfo: { backgroundColor: '#f3f3f3', borderLeftColor: '#1e1e1e' },
  bannerInfoText: { color: '#353535', fontSize: 14, lineHeight: 20 },
  devHint: { color: '#7a5d00', fontSize: 12, lineHeight: 17, marginTop: 6, fontWeight: '600' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 18 },
  footerText: { color: '#5b5b5b', fontSize: 14 },
  link: { color: '#1e1e1e', fontWeight: '700', fontSize: 14 },
});
