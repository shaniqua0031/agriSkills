import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/** AgriSkills Passport logo: a sprout inside a passport-style seal, plus the wordmark. */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    // Decorative: hidden from screen readers (aria-hidden works on phones and the web).
    <View aria-hidden>
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={23} fill="#1e1e1e" />
      <Circle cx={24} cy={24} r={18.5} fill="none" stroke="#e2e2e2" strokeWidth={1.5} strokeDasharray="2.5 2.5" />
      <Path d="M24 35V21" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M24 25c0-6 4.5-9.5 10-9.5 0 6-4.5 9.5-10 9.5Z" fill="#d8d8d8" />
      <Path d="M24 29c0-5-3.8-8-8.5-8 0 5 3.8 8 8.5 8Z" fill="#bfbfbf" />
      <Path d="M17 35h14" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    </View>
  );
}

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="AgriSkills Passport">
      <BrandMark size={compact ? 36 : 44} />
      <View>
        <Text style={[styles.name, compact && styles.nameCompact, inverse && styles.inverse]}>
          AgriSkills <Text style={[styles.accent, inverse && styles.accentInverse]}>Passport</Text>
        </Text>
        {!compact && (
          <Text style={[styles.tagline, inverse && styles.taglineInverse]}>Your farming skills, verified</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 22, fontWeight: '800', color: '#232323', letterSpacing: -0.3 },
  nameCompact: { fontSize: 19 },
  accent: { color: '#1e1e1e' },
  inverse: { color: '#ffffff' },
  accentInverse: { color: '#d8d8d8' },
  tagline: { fontSize: 12, color: '#5b5b5b', fontWeight: '600', marginTop: 2 },
  taglineInverse: { color: '#eaeaea' },
});
