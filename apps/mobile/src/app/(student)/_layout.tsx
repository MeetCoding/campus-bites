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
    </Stack>
  );
}
