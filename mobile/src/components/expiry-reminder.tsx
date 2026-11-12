import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { expiryLabel, isExpiringSoon } from '@/lib/expiry';

type Credential = { id: string; title: string; status: string; expiryDate?: string | null; issuer?: { name: string } };

/** Passport banner: valid credentials that expire within 30 days, soonest first. */
export function ExpiryReminder({ credentials }: { credentials: Credential[] }) {
  const expiring = credentials
    .filter((credential) => isExpiringSoon(credential))
    .sort((a, b) => Date.parse(a.expiryDate!) - Date.parse(b.expiryDate!));
  if (expiring.length === 0) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>
        {expiring.length === 1 ? '1 credential expires soon' : `${expiring.length} credentials expire soon`}
      </Text>
      <Text style={styles.text}>
        Ask the issuer about renewing before it expires. After that, employers will see it as expired.
      </Text>
      {expiring.map((credential) => (
        <Link key={credential.id} href={`/learner/credentials/${credential.id}`} asChild>
          <Pressable
            style={styles.row}
            accessibilityRole="link"
            accessibilityLabel={`${credential.title}, ${expiryLabel(credential)}. Open details`}>
            <Text style={styles.rowTitle}>{credential.title}</Text>
            <Text style={styles.rowWhen}>{expiryLabel(credential)}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

/** Small label on a credential card, e.g. "Expires in 12 days". Nothing when not within 30 days. */
export function ExpiryTag({ credential }: { credential: Credential }) {
  if (!isExpiringSoon(credential)) return null;
  return <Text style={styles.tag}>{expiryLabel(credential)}</Text>;
}


const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fff4d6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#c99a00',
  },
  title: { color: '#5c4300', fontWeight: '800', fontSize: 15 },
  text: { color: '#5c4300', fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#efdca6',
    minHeight: 44,
  },
  rowTitle: { flex: 1, color: '#3d2d00', fontWeight: '700', fontSize: 14 },
  rowWhen: { color: '#5c4300', fontWeight: '700', fontSize: 13 },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff4d6',
    color: '#5c4300',
    fontWeight: '700',
    fontSize: 11,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
});
