import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  accessibilityLabel: string;
  error?: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, accessibilityLabel, error, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange(!checked)}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={accessibilityLabel}
        hitSlop={6}
        style={styles.row}>
        <View style={[styles.box, checked && styles.boxChecked, error ? styles.boxError : null]}>
          {checked ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <View style={styles.labelWrap}>{typeof label === 'string' ? <Text style={styles.label}>{label}</Text> : label}</View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#afafaf',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: { backgroundColor: '#1e1e1e', borderColor: '#1e1e1e' },
  boxError: { borderColor: '#b42318' },
  tick: { color: '#ffffff', fontWeight: '800', fontSize: 14, lineHeight: 16 },
  labelWrap: { flex: 1 },
  label: { color: '#353535', fontSize: 14, lineHeight: 20 },
  error: { color: '#b42318', fontSize: 13, marginTop: 4, marginLeft: 32 },
});
