import { StyleSheet, Text, View } from 'react-native';
import { useNetworkState } from 'expo-network';

/** Shows a clear notice when the device has no internet connection. */
export function OfflineBanner() {
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.title}>You’re offline</Text>
      <Text style={styles.text}>Connect to Wi-Fi or mobile data to log in. Your details stay on this screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#fff4d6', borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#c99a00' },
  title: { color: '#6b4e00', fontWeight: '800', fontSize: 14 },
  text: { color: '#6b4e00', fontSize: 13, lineHeight: 18, marginTop: 2 },
});
