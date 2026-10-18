import { Link, Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session';
import { completeWebGoogleSignIn } from '@/lib/auth';

/**
 * Deep-link target of the Google OAuth redirect (campusbites://auth-callback). On native the code
 * exchange happens in signInWithGoogle() and this screen only waits for it to land; on web the
 * whole page was redirected here, so this screen exchanges the code itself.
 */
export default function AuthCallback() {
  const { status, googleSignInPending } = useSession();
  const [timedOut, setTimedOut] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || exchanged.current) return;
    exchanged.current = true; // the code is single-use; dev double-effects must not resend it
    completeWebGoogleSignIn().then((result) => {
      if (!result.ok) setWebError(result.message);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (webError) {
    return (
      <View className="flex-1 items-center justify-center gap-space-md bg-background p-space-lg">
        <Text accessibilityRole="alert" className="text-center font-body text-body-md text-error">
          {webError}
        </Text>
        <Link href="/sign-in" className="font-body-semibold text-label-lg text-primary">
          Back to sign-in
        </Link>
      </View>
    );
  }
  if (status === 'signed-in' || (!googleSignInPending && timedOut)) {
    return <Redirect href="/" />;
  }
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator />
    </View>
  );
}
