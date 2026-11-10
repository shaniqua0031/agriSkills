import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

export default function IssuerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#1e1e1e', tabBarInactiveTintColor: '#6b6b6b' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'chart.bar', android: 'dashboard', web: 'dashboard' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="issued"
        options={{
          title: 'Issued',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'doc.text', android: 'inventory_2', web: 'inventory_2' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="issue"
        options={{
          title: 'Issue',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }} tintColor={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'checklist', android: 'fact_check', web: 'fact_check' }} tintColor={color} size={20} />
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
