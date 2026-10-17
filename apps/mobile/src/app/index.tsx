import { Redirect } from 'expo-router';

import { MODE_HOME } from '@/features/auth/modes';
import { useSession } from '@/features/auth/session';

/** Anchor route: sends each user to the right place for their session state and mode. */
export default function Index() {
  const { status, modes, mode, needsOnboarding } = useSession();

  if (status !== 'signed-in') return <Redirect href="/sign-in" />;
  if (modes.length === 0 || !mode) return <Redirect href="/no-access" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href={MODE_HOME[mode]} />;
}
