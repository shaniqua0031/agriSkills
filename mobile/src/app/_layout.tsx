import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { AuthProvider, useAuth } from '@/context/auth';

// While a saved login is being checked, show a short loading screen instead of
// flashing the login page (or bouncing a logged-in user back to it).
function AppNavigator() {
  const { isRestoring, user } = useAuth();
  if (isRestoring) {
    return (
      <View style={styles.splash} accessibilityLabel="Loading AgriSkills Passport">
        <ActivityIndicator size="large" color="#1e1e1e" />
      </View>
    );
  }
  // Each signed-in area (/learner, /issuer, /admin) only exists while a user with that role is logged in,
  // so opening one while logged out (or after logging out) falls back to the login page at "/".
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={user?.role === 'LEARNER'}>
        <Stack.Screen name="learner" />
      </Stack.Protected>
      <Stack.Protected guard={user?.role === 'ISSUER'}>
        <Stack.Screen name="issuer" />
      </Stack.Protected>
      <Stack.Protected guard={user?.role === 'ADMIN'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
});
