import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Coffee, Moon, Store, Sunrise } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, HeroCard, IconBadge, PressableScale, Screen, Segmented, TextField } from '@/components/ui';
import { OtpInput } from '@/features/auth/OtpInput';
import { useSession } from '@/features/auth/session';
import { sendVendorOtp, toIndianE164, verifyVendorOtp } from '@/lib/auth';
import { colors } from '@/theme/tokens';

const crest = require('@/assets/images/iitr-crest.png');

type Audience = 'student' | 'vendor';

/** Dual login per stitch-reference/dual_login_onboarding: one hero, a Student / Vendor switch. */
export default function SignIn() {
  const [audience, setAudience] = useState<Audience>('student');

  return (
    <Screen className="gap-space-lg">
      <HeroCard className="items-center">
        <View className="rounded-full bg-surface-container-lowest p-space-sm">
          <Image source={crest} style={{ width: 72, height: 72 }} accessibilityLabel="IIT Roorkee crest" />
        </View>
        <View className="items-center gap-space-xs">
          <Text className="font-headline text-headline-xl-mobile text-on-primary">Campus Bites</Text>
          <Text className="font-body text-body-md text-on-primary-container">Every meal at IIT Roorkee, live</Text>
        </View>
        <View className="flex-row gap-space-sm">
          {[Sunrise, Coffee, Store, Moon].map((icon, i) => (
            <IconBadge key={i} icon={icon} tone="onDark" size="sm" />
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

      {audience === 'student' ? <StudentSignIn /> : <VendorSignIn />}

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
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const phone = toIndianE164(phoneInput);
    if (!phone) {
      setError('Enter your registered 10-digit mobile number.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await sendVendorOtp(phone);
    setPending(false);
    if (result.ok) {
      setSentTo(phone);
    } else {
      setError(result.message);
    }
  }

  async function verifyCode() {
    if (!sentTo || !/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit OTP / passcode.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await verifyVendorOtp(sentTo, code);
    setPending(false);
    // On success the session listener routes the vendor to their console.
    if (!result.ok) setError(result.message);
  }

  return (
    <Card className="gap-space-md">
      {sentTo === null ? (
        <>
          <TextField
            label="Registered mobile number"
            prefix="+91"
            placeholder="10-digit number"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={14}
            value={phoneInput}
            onChangeText={setPhoneInput}
            error={error ?? undefined}
          />
          <Button label="Send OTP" onPress={sendCode} loading={pending} />
        </>
      ) : (
        <>
          <OtpInput
            label="6-Digit Vendor OTP / Passcode"
            value={code}
            onChange={(next) => {
              setCode(next);
              setError(null);
            }}
            error={error ?? undefined}
          />
          <Button label="Verify & sign in" onPress={verifyCode} loading={pending} disabled={code.length !== 6} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSentTo(null);
              setCode('');
              setError(null);
            }}
            hitSlop={8}
            className="self-center active:opacity-60">
            <Text className="font-label text-label-md text-primary">Sent to {sentTo} · Change</Text>
          </Pressable>
        </>
      )}

      <Text className="text-center font-body text-body-sm text-on-surface-variant">
        Not whitelisted? Contact the DoSW office.
      </Text>
    </Card>
  );
}
