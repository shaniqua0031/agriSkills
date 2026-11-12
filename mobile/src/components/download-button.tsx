import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * A button that makes a PDF. `run` returns whether a QR code was added; without one
 * (no connection) the learner is told why.
 */
export function DownloadButton({
  label,
  hint,
  run,
  variant = 'dark',
}: {
  label: string;
  hint?: string;
  run: () => Promise<{ withQr: boolean }>;
  variant?: 'dark' | 'light';
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const onPress = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { withQr } = await run();
      if (!withQr) {
        setMessage({ text: 'Made without a QR code because there is no connection. Download again when online to add one.', error: false });
      } else if (Platform.OS === 'web') {
        setMessage({ text: 'In the print window, choose "Save as PDF" as the printer.', error: false });
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not make the PDF.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const light = variant === 'light';
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityHint={hint}
        accessibilityState={{ busy, disabled: busy }}
        style={({ pressed }) => [styles.button, light && styles.buttonLight, (pressed || busy) && styles.pressed]}>
        {busy ? <ActivityIndicator color={light ? '#1e1e1e' : '#fff'} /> : null}
        <Text style={[styles.text, light && styles.textLight]}>{busy ? 'Preparing PDF…' : label}</Text>
      </Pressable>
      {message ? (
        <Text style={[styles.message, message.error && styles.error]} accessibilityRole={message.error ? 'alert' : undefined}>
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  button: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonLight: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#1e1e1e' },
  pressed: { opacity: 0.75 },
  text: { color: '#fff', fontWeight: '700', fontSize: 15 },
  textLight: { color: '#1e1e1e' },
  message: { color: '#5b5b5b', fontSize: 13, marginTop: 6, lineHeight: 18 },
  error: { color: '#9a352c' },
});
