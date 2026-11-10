import { Stack } from 'expo-router';

// The list and its detail/add pages share this tab, stacked so "Back" returns to the list.
export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
