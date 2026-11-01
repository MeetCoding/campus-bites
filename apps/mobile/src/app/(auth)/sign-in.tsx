import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Coffee, Moon, Store, Sunrise } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import {
  AnimatedBrandSymbol,
  Button,
  Card,
  enterUp,
  HeroCard,
  IconBadge,
  KineticWordmark,
  popIn,
  PressableScale,
  Screen,
  Segmented,
  TextField,
} from '@/components/ui';
import { OtpInput } from '@/features/auth/OtpInput';
import { useSession } from '@/features/auth/session';
import { signInVendor, toIndianE164 } from '@/lib/auth';
import { colors } from '@/theme/tokens';

type Audience = 'student' | 'vendor';

/** Dual login per stitch-reference/dual_login_onboarding: one hero, a Student / Vendor switch. */
export default function SignIn() {
  const [audience, setAudience] = useState<Audience>('student');

  return (
    <Screen className="gap-space-lg">
      <HeroCard className="items-center" mark={false}>
        <AnimatedBrandSymbol size={72} tone="onDark" />
        <View className="items-center gap-space-xs">
          <KineticWordmark tone="onDark" className="text-headline-xl-mobile" />
          <Animated.View entering={FadeIn.delay(750).duration(500).reduceMotion(ReduceMotion.System)}>
            <Text className="font-body text-body-md text-on-primary-container">Every meal at IIT Roorkee, live</Text>
          </Animated.View>
        </View>
        <View className="flex-row gap-space-sm">
          {[Sunrise, Coffee, Store, Moon].map((icon, i) => (
            <Animated.View
              key={i}
              entering={popIn(i, 900)}>
              <IconBadge icon={icon} tone="onDark" size="sm" />
            </Animated.View>
          ))}
        </View>
      </HeroCard>

      <Segmented
        options={[
          { value: 'student', label: 'Student & staff' },
          { value: 'vendor', label: 'Vendor' },
        ]}
        value={audience}
        onChange={setAudience}
      />

      <Animated.View key={audience} entering={enterUp(0)}>
        {audience === 'student' ? <StudentSignIn /> : <VendorSignIn />}
      </Animated.View>

      <Text className="pb-space-lg text-center font-label text-label-sm uppercase text-on-surface-variant">
        CoSA · DoSW · IIT Roorkee
      </Text>
    </Screen>
  );
}

function StudentSignIn() {
  const { signInWithGoogle, googleSignInPending, authError, clearAuthError } = useSession();

  return (
    <Card className="gap-space-md">
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ busy: googleSignInPending }}
        disabled={googleSignInPending}
        onPress={() => {
          clearAuthError();
          void signInWithGoogle();
        }}>
        <View className="min-h-14 flex-row items-center justify-center gap-space-sm rounded-full bg-inverse-surface px-space-md">
          {googleSignInPending ? (
            <ActivityIndicator color={colors['inverse-on-surface']} />
          ) : (
            <View className="h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest">
              <MaterialCommunityIcons name="google" size={16} color={colors.primary} />
            </View>
          )}
          <Text className="font-body-semibold text-label-lg text-inverse-on-surface">
            {googleSignInPending ? 'Waiting for Google…' : 'Continue with IITR Google'}
          </Text>
        </View>
      </PressableScale>

      {authError ? (
        <Text accessibilityRole="alert" className="text-center font-body text-body-sm text-error">
          {authError}
        </Text>
      ) : (
        <Text className="text-center font-body text-body-sm text-on-surface-variant">
          Use your <Text className="font-body-semibold text-on-surface">@&lt;dept&gt;.iitr.ac.in</Text> account
        </Text>
      )}
    </Card>
  );
}

function VendorSignIn() {
  const [phoneInput, setPhoneInput] = useState('');
  const [passcode, setPasscode] = useState('');
  const [pending, setPending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const phone = toIndianE164(phoneInput);
    if (!phone) {
      setPhoneError('Enter your registered 10-digit mobile number.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await signInVendor(phone, passcode);
    setPending(false);
    // On success the session listener routes the vendor to their console.
    if (!result.ok) setError(result.message);
  }

  return (
    <Card className="gap-space-md">
      <TextField
        label="Registered mobile number"
        prefix="+91"
        placeholder="10-digit number"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={14}
        value={phoneInput}
        onChangeText={(next) => {
          setPhoneInput(next);
          setPhoneError(null);
        }}
        error={phoneError ?? undefined}
      />
      <OtpInput
        label="6-Digit Vendor Passcode"
        value={passcode}
        onChange={(next) => {
          setPasscode(next);
          setError(null);
        }}
        error={error ?? undefined}
        autoFocus={false}
      />
      <Button label="Sign in" onPress={signIn} loading={pending} disabled={passcode.length !== 6} />

      <Text className="text-center font-body text-body-sm text-on-surface-variant">
        No passcode yet? Contact the DoSW office.
      </Text>
    </Card>
  );
}
