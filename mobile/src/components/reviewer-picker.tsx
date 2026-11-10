import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Reviewer } from '@/lib/evidence';

/** Lets a learner choose which approved training provider reviews their skills evidence. */
export function ReviewerPicker({
  reviewers,
  selectedId,
  onSelect,
  loading,
}: {
  reviewers: Reviewer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  if (loading) return <Text style={styles.help}>Loading training providers...</Text>;
  if (reviewers.length === 0) {
    return <Text style={styles.help}>No approved training providers yet. You can choose a reviewer later from this evidence.</Text>;
  }
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {reviewers.map((reviewer) => {
        const selected = reviewer.id === selectedId;
        return (
          <Pressable
            key={reviewer.id}
            onPress={() => onSelect(reviewer.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.option, selected && styles.optionSelected]}>
            <View style={[styles.dot, selected && styles.dotSelected]} />
            <Text style={[styles.name, selected && styles.nameSelected]}>{reviewer.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  help: { color: '#666666', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  list: { gap: 8, marginBottom: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionSelected: { borderColor: '#1e1e1e', backgroundColor: '#f3f3f3' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#9a9a9a' },
  dotSelected: { borderColor: '#1e1e1e', backgroundColor: '#1e1e1e' },
  name: { color: '#353535', fontSize: 15, flex: 1 },
  nameSelected: { color: '#1e1e1e', fontWeight: '700' },
});
