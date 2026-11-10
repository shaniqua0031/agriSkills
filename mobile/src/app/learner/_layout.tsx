import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

export default function LearnerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#1e1e1e', tabBarInactiveTintColor: '#6b6b6b' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Passport',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'checkmark.seal', android: 'verified', web: 'verified' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="credentials"
        options={{
          title: 'Credentials',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'rosette', android: 'workspace_premium', web: 'workspace_premium' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="evidence"
        options={{
          title: 'Evidence',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          title: 'Share',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'qrcode', android: 'qr_code_2', web: 'qr_code_2' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} tintColor={color} size={20} />
          ),
        }}
      />
    </Tabs>
  );
}
