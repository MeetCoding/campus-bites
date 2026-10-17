import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function StaffLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: 'NotoSerif_700Bold', color: colors['on-surface'] },
      }}>
      <Stack.Screen name="console" options={{ headerShown: false }} />
      <Stack.Screen name="mess-photo" options={{ title: 'Noticeboard photo' }} />
      <Stack.Screen name="mess-menu" options={{ title: 'Weekly menu' }} />
      <Stack.Screen name="extra-items" options={{ title: 'Extra items' }} />
      <Stack.Screen name="mess-timings" options={{ title: 'Mess timings' }} />
      <Stack.Screen name="outlet/[id]" options={{ title: 'Outlet console' }} />
      <Stack.Screen name="rate-card" options={{ title: 'Institute rate card' }} />
    </Stack>
  );
}
