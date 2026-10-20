import { Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { BhawanPicker } from '@/features/auth/BhawanPicker';
import { useSession } from '@/features/auth/session';

/** First-login Bhawan picker, with "I don't live in a hostel" for staff, faculty and day scholars. */
export default function Onboarding() {
  const { signOut } = useSession();

  return (
    <Screen>
      <View className="gap-space-xs pt-space-lg">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">Welcome</Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">Choose your Bhawan</Text>
        <Text className="font-body text-body-md text-on-surface-variant">
          We&apos;ll show your mess menu, timings and alerts for this hostel. You can only set it once — ask
          the DoSW Office if you move. Not in a hostel? Pick the last option; you can still choose a Bhawan
          later from Home.
        </Text>
      </View>

      <BhawanPicker allowNoHostel />
      <Button label="Sign out" variant="tertiary" onPress={signOut} />
    </Screen>
  );
}
