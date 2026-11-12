import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatSavedAt } from '@/lib/passport-cache';

/** Shown above credentials when they come from the copy saved on this device. */
export function OfflineCopyNotice({ savedAt, onRetry }: { savedAt: string; onRetry?: () => void }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.copy}>
        <Text style={styles.title}>Offline copy</Text>
        <Text style={styles.text}>
          No connection. Showing your passport as saved {formatSavedAt(savedAt)}. Status changes since then are not shown.
        </Text>
      </View>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fff4d6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#c99a00',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: { flex: 1 },
  title: { color: '#6b4e00', fontWeight: '800', fontSize: 14 },
  text: { color: '#6b4e00', fontSize: 13, lineHeight: 18, marginTop: 2 },
  retry: { backgroundColor: '#6b4e00', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
