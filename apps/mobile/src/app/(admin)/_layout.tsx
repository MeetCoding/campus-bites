import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: 'NotoSerif_700Bold', color: colors['on-surface'] },
      }}>
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="whitelist" options={{ title: 'Vendor whitelist' }} />
      <Stack.Screen name="roles" options={{ title: 'Roles' }} />
      <Stack.Screen name="manage-bhawans" options={{ title: 'Bhawans' }} />
      <Stack.Screen name="manage-eateries" options={{ title: 'Eateries' }} />
    </Stack>
  );
}
