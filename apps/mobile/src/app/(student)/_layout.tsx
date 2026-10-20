import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function StudentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: 'NotoSerif_700Bold', color: colors['on-surface'] },
      }}>
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="mess" options={{ title: 'Mess Hub' }} />
      <Stack.Screen name="canteens" options={{ title: 'Canteens' }} />
      <Stack.Screen name="eateries" options={{ title: 'Food directory' }} />
      <Stack.Screen name="eateries-map" options={{ title: 'Eateries map' }} />
      <Stack.Screen name="eatery/[id]" options={{ title: 'Eatery' }} />
      <Stack.Screen name="rebates" options={{ title: 'Rebates' }} />
      <Stack.Screen name="complaints" options={{ title: 'Complaints' }} />
      <Stack.Screen name="raise-complaint" options={{ title: 'Raise a complaint' }} />
    </Stack>
  );
}
