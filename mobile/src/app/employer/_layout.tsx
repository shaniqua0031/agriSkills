import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

export default function EmployerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#1e1e1e', tabBarInactiveTintColor: '#6b6b6b' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Check',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="checks"
        options={{
          title: 'Checked',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.2', android: 'groups', web: 'groups' }} tintColor={color} size={20} />
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
