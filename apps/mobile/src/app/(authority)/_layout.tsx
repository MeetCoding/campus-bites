import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function AuthorityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: 'NotoSerif_700Bold', color: colors['on-surface'] },
      }}>
      <Stack.Screen name="review" options={{ headerShown: false }} />
      <Stack.Screen name="rebate/[id]" options={{ title: 'Rebate application' }} />
    </Stack>
  );
}
