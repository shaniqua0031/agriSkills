import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  onPress: () => void;
};

export function AuthButton({ label, loadingLabel, loading, disabled, variant = 'primary', onPress }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}>
      <View style={styles.content}>
        {loading && <ActivityIndicator size="small" color={primary ? '#ffffff' : '#1e1e1e'} />}
        <Text style={[styles.text, !primary && styles.secondaryText]}>{loading ? loadingLabel ?? 'Please wait...' : label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primary: { backgroundColor: '#1e1e1e' },
  secondary: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#1e1e1e' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  secondaryText: { color: '#1e1e1e' },
});
