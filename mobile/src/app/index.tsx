import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { Link, router } from 'expo-router';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthShell } from '@/components/auth/auth-shell';
import { Checkbox } from '@/components/auth/checkbox';
import { FormField } from '@/components/auth/form-field';
import { useAuth } from '@/context/auth';
import { dashboardFor, validateEmail } from '@/lib/auth-helpers';

export default function LoginScreen() {
  const { user, login, logout, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);

  // Role-based navigation: send each signed-in user to their own dashboard.
  useEffect(() => {
    if (!user) return;
    const destination = dashboardFor(user.role);
    if (destination) {
      router.replace(destination);
    } else {
      setError('Employer accounts do not have a dashboard yet. Employers can open shared verification links without signing in.');
      logout();
    }
  }, [user, logout]);

  const handleLogin = async () => {
    const errors = {
      email: validateEmail(email),
      password: password ? '' : 'Enter your password.',
    };
    setFieldErrors(errors);
    setError('');
    if (errors.email || errors.password) return;

    try {
      await login(email.trim(), password, remember);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to view, verify and share your agricultural skills.">
      {error ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      <FormField
        label="Email address"
        value={email}
        onChangeText={(value) => { setEmail(value); setFieldErrors((e) => ({ ...e, email: '' })); }}
        error={fieldErrors.email}
        placeholder="name@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!isLoading}
      />

      <FormField
        ref={passwordRef}
        label="Password"
        password
        value={password}
        onChangeText={(value) => { setPassword(value); setFieldErrors((e) => ({ ...e, password: '' })); }}
        error={fieldErrors.password}
        placeholder="Your password"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        editable={!isLoading}
      />

      <View style={styles.optionsRow}>
        <Checkbox
          checked={remember}
          onChange={setRemember}
          label="Remember me"
          accessibilityLabel="Remember me on this device"
          disabled={isLoading}
        />
        <Link href={{ pathname: '/forgot-password', params: email.trim() ? { email: email.trim() } : {} }} asChild>
          <Pressable accessibilityRole="link" hitSlop={6}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        </Link>
      </View>

      <AuthButton label="Log in" loadingLabel="Logging in..." loading={isLoading} onPress={handleLogin} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to AgriSkills Passport?</Text>
        <Link href="/register" asChild>
          <Pressable accessibilityRole="link" hitSlop={6}>
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </Link>
      </View>

      {/* Employers don't need an account: send them straight to credential verification. */}
      <Link href="/verify-credential" asChild>
        <Pressable accessibilityRole="link" style={styles.employer}>
          <Text style={styles.employerTitle}>Checking someone’s credential?</Text>
          <Text style={styles.employerText}>Verify a credential without an account →</Text>
        </Pressable>
      </Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#fdecea', borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#b42318' },
  bannerText: { color: '#8a1c12', fontSize: 14, lineHeight: 20 },
  optionsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  employer: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: 'rgba(243, 243, 243, 0.9)', borderWidth: 1, borderColor: '#dddddd' },
  employerTitle: { color: '#353535', fontWeight: '700', fontSize: 14 },
  employerText: { color: '#1e1e1e', fontWeight: '700', fontSize: 13, marginTop: 2 },
  link: { color: '#1e1e1e', fontWeight: '700', fontSize: 14 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 18 },
  footerText: { color: '#5b5b5b', fontSize: 14 },
});
