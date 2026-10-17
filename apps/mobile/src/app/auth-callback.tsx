import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/features/auth/session';

/**
 * Deep-link target of the Google OAuth redirect (campusbites://auth-callback). The code
 * exchange itself happens in signInWithGoogle(); this screen only waits for it to land.
 */
export default function AuthCallback() {
  const { status, googleSignInPending } = useSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'signed-in' || (!googleSignInPending && timedOut)) {
    return <Redirect href="/" />;
  }
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator />
    </View>
  );
}
