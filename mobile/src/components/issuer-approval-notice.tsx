import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth';

/** Shown to issuers not (or no longer) approved by an admin; they can browse but not issue. */
export function IssuerApprovalNotice() {
  const { user, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  if (user?.role !== 'ISSUER' || user.issuerApproved) return null;

  const checkAgain = async () => {
    setChecking(true);
    setMessage('');
    try {
      await refreshUser();
      setMessage('Still waiting for an admin to approve this account.');
    } catch {
      setMessage("Couldn't check right now. Try again in a moment.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>Waiting for admin approval</Text>
      <Text style={styles.text}>
        For safety, an admin checks every issuer before it can issue credentials. You can look around now; issuing and
        revoking are switched on as soon as an admin approves this account.
      </Text>
      <Pressable onPress={checkAgain} disabled={checking} accessibilityRole="button" style={styles.button}>
        <Text style={styles.buttonText}>{checking ? 'Checking...' : 'Check again'}</Text>
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#fff4d6', borderRadius: 14, padding: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#c99a00' },
  title: { color: '#5c4a00', fontWeight: '800', fontSize: 15 },
  text: { color: '#5c4a00', fontSize: 14, lineHeight: 20, marginTop: 4 },
  button: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1.5, borderColor: '#8a6d00', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  buttonText: { color: '#5c4a00', fontWeight: '700', fontSize: 13 },
  message: { color: '#5c4a00', fontSize: 12, marginTop: 6 },
});
