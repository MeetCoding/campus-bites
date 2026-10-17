import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, Button, Card, Screen, TextField } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { sendVendorOtp, toIndianE164, verifyVendorOtp } from '@/lib/auth';
import { colors } from '@/theme/tokens';

const crest = require('@/assets/images/iitr-crest.png');

const STUDENT_SERVICES = ['Weekly Mess Menus', 'Official Rate Cards', 'Rebate Filing', 'Complaint Redressal'];

/** Dual login per stitch-reference/dual_login_onboarding (borders replaced by surface tiers). */
export default function SignIn() {
  return (
    <Screen className="gap-space-lg">
      <View className="items-center gap-space-sm pt-space-lg">
        <View className="rounded-2xl bg-surface-container-lowest p-space-sm">
          <Image source={crest} style={{ width: 88, height: 88 }} accessibilityLabel="IIT Roorkee crest" />
        </View>
        <Badge label="Official campus portal" tone="official" />
        <Text className="text-center font-label text-label-sm uppercase text-on-surface-variant">
          Indian Institute of Technology Roorkee
        </Text>
        <Text className="font-headline text-headline-xl-mobile text-primary">Campus Bites</Text>
        <Text className="text-center font-body text-body-lg text-on-surface-variant">
          IIT Roorkee Dining & Accountability Hub
        </Text>
      </View>

      <StudentSignIn />

      <Text className="text-center font-label-bold text-label-sm uppercase text-on-surface-variant">
        Eatery owners & canteen managers
      </Text>

      <VendorSignIn />

      <Text className="pb-space-lg text-center font-body text-body-sm text-on-surface-variant">
        Council of Student Affairs (CoSA) & Dean of Student Welfare (DoSW) • IIT Roorkee
      </Text>
    </Screen>
  );
}

function StudentSignIn() {
  const { signInWithGoogle, googleSignInPending, authError, clearAuthError } = useSession();

  return (
    <Card className="gap-space-md">
      <View className="flex-row items-center justify-between gap-space-sm">
        <Text className="flex-1 font-headline text-headline-sm text-on-surface">Students & Campus Staff</Text>
        <Badge label="Institute SSO" tone="neutral" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: googleSignInPending }}
        disabled={googleSignInPending}
        onPress={() => {
          clearAuthError();
          void signInWithGoogle();
        }}
        className="min-h-12 flex-row items-center justify-center gap-space-sm rounded-xl bg-surface-container-high px-space-md active:opacity-80">
        <MaterialCommunityIcons name="google" size={20} color={colors.primary} />
        <Text className="font-body-semibold text-label-lg text-primary">
          {googleSignInPending ? 'Waiting for Google…' : 'Continue with IITR Google Account'}
        </Text>
      </Pressable>

      {authError ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {authError}
        </Text>
      ) : null}

      <View className="rounded-xl bg-surface-container-low p-space-md">
        <Text className="font-body text-body-sm text-on-surface-variant">
          Accepts <Text className="font-body-bold text-on-surface">@&lt;dept&gt;.iitr.ac.in</Text> emails
          (e.g. @ece.iitr.ac.in, @cse.iitr.ac.in, @iitr.ac.in).
        </Text>
      </View>

      <View className="gap-space-sm">
        <Text className="font-label-bold text-label-sm uppercase text-on-surface-variant">
          Included student services
        </Text>
        <View className="flex-row flex-wrap gap-space-xs">
          {STUDENT_SERVICES.map((service) => (
            <Badge key={service} label={service} tone="neutral" />
          ))}
        </View>
      </View>
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
      <View className="flex-row items-center justify-between gap-space-sm">
        <Text className="flex-1 font-headline text-headline-sm text-on-surface">Vendor Portal Access</Text>
        <Badge label="Whitelisted only" tone="neutral" />
      </View>

      {sentTo === null ? (
        <>
          <TextField
            label="Registered Mobile Number"
            prefix="+91"
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={14}
            value={phoneInput}
            onChangeText={setPhoneInput}
            error={error ?? undefined}
            hint="Admin pre-whitelisted numbers only"
          />
          <Button label="Send OTP" onPress={sendCode} loading={pending} />
        </>
      ) : (
        <>
          <Text className="font-body text-body-md text-on-surface-variant">
            Enter the code for <Text className="font-body-semibold text-on-surface">{sentTo}</Text>.
          </Text>
          <TextField
            label="6-Digit Vendor OTP / Passcode"
            placeholder="••••••"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            error={error ?? undefined}
          />
          <Button label="Verify & sign in" onPress={verifyCode} loading={pending} />
          <Button
            label="Use a different number"
            variant="tertiary"
            onPress={() => {
              setSentTo(null);
              setCode('');
              setError(null);
            }}
          />
        </>
      )}

      <Text className="text-center font-body text-body-sm text-on-surface-variant">
        For new canteen tenders or credential whitelisting, contact the DoSW Office.
      </Text>
    </Card>
  );
}
