import '../global.css';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { NotoSerif_400Regular, NotoSerif_500Medium, NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { PublicSans_500Medium, PublicSans_700Bold } from '@expo-google-fonts/public-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider, useSession } from '@/features/auth/session';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/**
 * Route access by session state (ARCHITECTURE.md §3.3). A screen whose guard turns false
 * redirects to `index`, which dispatches to the right home for the current mode.
 */
function RootNavigator() {
  const { status, modes, mode, needsOnboarding } = useSession();
  const signedIn = status === 'signed-in';
  const hasAccess = signedIn && modes.length > 0;
  const ready = hasAccess && !needsOnboarding;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth-callback" />

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasAccess}>
        <Stack.Screen name="no-access" />
      </Stack.Protected>
      <Stack.Protected guard={hasAccess && needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={ready && mode === 'student'}>
        <Stack.Screen name="(student)" />
      </Stack.Protected>
      <Stack.Protected guard={ready && mode === 'staff'}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
      <Stack.Protected guard={ready && mode === 'authority'}>
        <Stack.Screen name="(authority)" />
      </Stack.Protected>
      <Stack.Protected guard={ready && mode === 'admin'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
      {/* Shared by every role; RLS decides who can read a complaint. */}
      <Stack.Protected guard={ready}>
        <Stack.Screen
          name="complaint/[id]"
          options={{
            headerShown: true,
            title: 'Complaint',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.primary,
            headerTitleStyle: { fontFamily: 'NotoSerif_700Bold', color: colors['on-surface'] },
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="design-preview" />
      </Stack.Protected>
    </Stack>
  );
}

function SplashGate({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useSession();
  const ready = fontsReady && status !== 'loading';

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // Tapping an alert opens the related screen: rebates, a complaint, the Mess Hub, or a canteen.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'rebate') {
        router.push('/rebates');
        return;
      }
      if (data?.type === 'complaint' && typeof data.complaint_id === 'string') {
        router.push({ pathname: '/complaint/[id]', params: { id: data.complaint_id } });
        return;
      }
      if (data?.type !== 'timing_override') return;
      if (data.outlet_type === 'day_canteen' || data.outlet_type === 'night_canteen') {
        router.push({ pathname: '/canteens', params: { outlet: String(data.outlet_id) } });
      } else {
        router.push('/mess');
      }
    });
    return () => subscription.remove();
  }, []);

  return ready ? <RootNavigator /> : null;
}

export default function RootLayout() {
  // Keys must match fontFamily values in src/theme/tokens.js.
  const [fontsLoaded, fontError] = useFonts({
    NotoSerif_400Regular,
    NotoSerif_500Medium,
    NotoSerif_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PublicSans_500Medium,
    PublicSans_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <SplashGate fontsReady={fontsLoaded || !!fontError} />
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
