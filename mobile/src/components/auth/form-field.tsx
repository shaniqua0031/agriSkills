import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label: string;
  error?: string;
  /** Adds a Show/Hide button and hides the text by default. */
  password?: boolean;
};

/** Labelled text input with an inline error message and an optional password visibility toggle. */
export const FormField = forwardRef<TextInputInstance, Props>(function FormField({ label, error, password, style, ...inputProps }, ref) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused, error ? styles.inputRowError : null]}>
        <TextInput
          ref={ref}
          {...inputProps}
          accessibilityLabel={label}
          secureTextEntry={password && !visible}
          placeholderTextColor="#969696"
          onFocus={(event) => { setFocused(true); inputProps.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); inputProps.onBlur?.(event); }}
          style={[styles.input, style]}
        />
        {password && (
          <Pressable
            onPress={() => setVisible((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={styles.toggle}>
            <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { color: '#353535', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#dfdfdf',
    borderRadius: 12,
  },
  inputRowFocused: { borderColor: '#1e1e1e' },
  inputRowError: { borderColor: '#b42318' },
  input: { flex: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, color: '#232323', minHeight: 46 },
  toggle: { paddingHorizontal: 14, paddingVertical: 10 },
  toggleText: { color: '#1e1e1e', fontWeight: '700', fontSize: 13 },
  error: { color: '#b42318', fontSize: 13, marginTop: 5 },
});
