import { StyleSheet, Text, View } from 'react-native';

const LEVELS = [
  { label: 'Too short', color: '#b42318' },
  { label: 'Weak', color: '#d9480f' },
  { label: 'Fair', color: '#c99a00' },
  { label: 'Good', color: '#262626' },
  { label: 'Strong', color: '#1e1e1e' },
];
const COMMON = ['password', '12345678', 'qwerty', 'letmein', 'welcome', 'agriskills', 'iloveyou', 'admin123'];

/** Rough strength score from 0 (too short) to 4 (strong). A guide, not a guarantee. */
export function scorePassword(password: string) {
  if (password.length < 8) return 0;
  const lower = password.toLowerCase();
  if (COMMON.some((word) => lower.includes(word)) || /^(.)\1+$/.test(password)) return 1;
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  score += kinds >= 3 ? 2 : kinds === 2 ? 1 : 0;
  return Math.max(1, Math.min(4, score));
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[score];
  return (
    <View style={styles.wrap} accessibilityLabel={`Password strength: ${level.label}`} accessibilityLiveRegion="polite">
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((step) => (
          <View key={step} style={[styles.bar, { backgroundColor: score >= step ? level.color : '#e5e5e5' }]} />
        ))}
      </View>
      <Text style={[styles.label, { color: level.color }]}>
        {level.label}
        {score > 0 && score < 3 ? ' · add length, capitals, numbers or symbols' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: -6, marginBottom: 14 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 5, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 5 },
});
