import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { Link, router } from 'expo-router';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthShell } from '@/components/auth/auth-shell';
import { Checkbox } from '@/components/auth/checkbox';
import { FormField } from '@/components/auth/form-field';
import { PasswordStrength } from '@/components/auth/password-strength';
import { useAuth } from '@/context/auth';
import { dashboardFor, validateEmail, validateNewPassword } from '@/lib/auth-helpers';

type Role = 'LEARNER' | 'ISSUER';
type Errors = { name?: string; email?: string; password?: string; confirm?: string; privacy?: string };

const ROLES: { value: Role; title: string; description: string }[] = [
  { value: 'LEARNER', title: 'Learner', description: 'Keep and share my skills' },
  { value: 'ISSUER', title: 'Issuer', description: 'Training provider issuing credentials' },
];

export default function RegisterScreen() {
  const { user, register, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('LEARNER');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    const destination = user ? dashboardFor(user.role) : null;
    if (destination) router.replace(destination);
  }, [user]);

  const clear = (field: keyof Errors) => setErrors((current) => ({ ...current, [field]: '' }));

  const handleRegister = async () => {
    const next: Errors = {
      name: name.trim() ? '' : 'Enter your full name.',
      email: validateEmail(email),
      password: validateNewPassword(password),
      confirm: confirm === password ? '' : 'The passwords do not match.',
      privacy: acceptedPrivacy ? '' : 'Please read and accept the privacy notice to continue.',
    };
    setErrors(next);
    setError('');
    if (Object.values(next).some(Boolean)) return;

    try {
      // Logs the user in; the effect above then opens their dashboard.
      await register({ name: name.trim(), email: email.trim(), password, role, acceptedPrivacy }, true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create your account.');
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start your digital record of agricultural skills and qualifications.">
      {error ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>I am a</Text>
      <View style={styles.roleRow} accessibilityRole="radiogroup">
        {ROLES.map((option) => {
          const selected = role === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setRole(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[styles.role, selected && styles.roleSelected]}>
              <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>{option.title}</Text>
              <Text style={styles.roleDescription}>{option.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <FormField
        label="Full name"
        value={name}
        onChangeText={(value) => { setName(value); clear('name'); }}
        error={errors.name}
        placeholder={role === 'ISSUER' ? 'Organisation or trainer name' : 'Your full name'}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        editable={!isLoading}
      />
      <FormField
        ref={emailRef}
        label="Email address"
        value={email}
        onChangeText={(value) => { setEmail(value); clear('email'); }}
        error={errors.email}
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
        onChangeText={(value) => { setPassword(value); clear('password'); }}
        error={errors.password}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        editable={!isLoading}
      />
      <PasswordStrength password={password} />
      <FormField
        ref={confirmRef}
        label="Confirm password"
        password
        value={confirm}
        onChangeText={(value) => { setConfirm(value); clear('confirm'); }}
        error={errors.confirm}
        placeholder="Type the password again"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleRegister}
        editable={!isLoading}
      />

      {role === 'ISSUER' ? (
        <Text style={styles.note}>
          For safety, an admin checks every issuer account before it can issue credentials. You can log in straight away,
          and issuing is switched on once an admin approves your organisation.
        </Text>
      ) : null}

      <Checkbox
        checked={acceptedPrivacy}
        onChange={(value) => { setAcceptedPrivacy(value); clear('privacy'); }}
        accessibilityLabel="I have read and accept the privacy notice"
        error={errors.privacy}
        disabled={isLoading}
        label={
          <Text style={styles.checkLabel}>
            I have read and accept the{' '}
            <Link href="/privacy" style={styles.inlineLink}>privacy notice</Link>, which explains what data is kept and why.
          </Text>
        }
      />

      <AuthButton label="Create account" loadingLabel="Creating account..." loading={isLoading} onPress={handleRegister} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
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
  banner: { backgroundColor: '#fdecea', borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#b42318' },
  bannerText: { color: '#8a1c12', fontSize: 14, lineHeight: 20 },
  label: { color: '#353535', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  note: { color: '#5c4a00', backgroundColor: 'rgba(255, 244, 214, 0.95)', borderRadius: 10, padding: 10, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  checkLabel: { color: '#353535', fontSize: 14, lineHeight: 20 },
  inlineLink: { color: '#1e1e1e', fontWeight: '700', textDecorationLine: 'underline' },
  role: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#dfdfdf', borderRadius: 12, padding: 12 },
  roleSelected: { borderColor: '#1e1e1e', backgroundColor: '#f3f3f3' },
  roleTitle: { color: '#353535', fontWeight: '800', fontSize: 15 },
  roleTitleSelected: { color: '#1e1e1e' },
  roleDescription: { color: '#666666', fontSize: 12, marginTop: 3, lineHeight: 16 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 18 },
  footerText: { color: '#5b5b5b', fontSize: 14 },
  link: { color: '#1e1e1e', fontWeight: '700', fontSize: 14 },
});
