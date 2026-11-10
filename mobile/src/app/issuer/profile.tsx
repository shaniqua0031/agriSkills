import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/context/auth';

export default function IssuerProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Issuer profile</Text>
      <Text style={styles.name}>{user?.name ?? 'Unknown user'}</Text>
      <Text style={styles.email}>{user?.email ?? ''}</Text>
      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20, justifyContent: 'center' },
  heading: { fontSize: 26, fontWeight: '700', color: '#232323', marginBottom: 10 },
  name: { fontSize: 24, fontWeight: '700', color: '#232323' },
  email: { color: '#5b5b5b', marginTop: 8, marginBottom: 20 },
  button: { backgroundColor: '#1e1e1e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
