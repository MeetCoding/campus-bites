import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { KineticText, Screen } from '@/components/ui';
import { BhawanPicker } from '@/features/auth/BhawanPicker';

/** For "no hostel" accounts that later move into one: a Bhawan can be set once (DB guard). */
export default function ChooseBhawan() {
  return (
    <Screen>
      <View className="gap-space-xs">
        <KineticText text="Choose your Bhawan" className="font-headline text-headline-lg-mobile text-on-surface" />
        <Text className="font-body text-body-md text-on-surface-variant">
          Your home screen will show this mess and its canteens. You can only set it once — ask the DoSW
          Office if you move later.
        </Text>
      </View>
      <BhawanPicker onDone={() => router.back()} />
    </Screen>
  );
}
