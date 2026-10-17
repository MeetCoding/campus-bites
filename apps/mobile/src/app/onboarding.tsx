import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';

/** First-login Bhawan picker. The DB allows setting it once (profiles_guard_bhawan). */
export default function Onboarding() {
  const { claims, refreshClaims, signOut } = useSession();
  const bhawans = useBhawans();
  const [selected, setSelected] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (bhawanId: string) => {
      if (!claims) throw new Error('Not signed in');
      const { error } = await supabase
        .from('profiles')
        .update({ bhawan_id: bhawanId })
        .eq('id', claims.sub);
      if (error) throw error;
      // New token carries bhawan_id, which lifts the onboarding guard.
      await refreshClaims();
    },
  });

  return (
    <Screen>
      <View className="gap-space-xs pt-space-lg">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">Welcome</Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">Choose your Bhawan</Text>
        <Text className="font-body text-body-md text-on-surface-variant">
          We&apos;ll show your mess menu, timings and alerts for this hostel. You can only set this once —
          ask the DoSW Office if you move.
        </Text>
      </View>

      {bhawans.isPending ? (
        <ActivityIndicator />
      ) : bhawans.isError ? (
        <Text className="font-body text-body-md text-error">{bhawans.error.message}</Text>
      ) : (
        <View accessibilityRole="radiogroup" className="gap-space-sm">
          {bhawans.data.map((bhawan) => {
            const isSelected = bhawan.id === selected;
            return (
              <Pressable
                key={bhawan.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => setSelected(bhawan.id)}
                className={cn(
                  'min-h-12 justify-center rounded-xl px-space-md py-space-sm active:opacity-80',
                  isSelected ? 'bg-primary' : 'bg-surface-container-lowest',
                )}>
                <Text
                  className={cn(
                    'font-body-semibold text-body-lg',
                    isSelected ? 'text-on-primary' : 'text-on-surface',
                  )}>
                  {bhawan.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {save.isError ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {save.error.message}
        </Text>
      ) : null}

      <Button
        label="Confirm Bhawan"
        disabled={!selected}
        loading={save.isPending}
        onPress={() => selected && save.mutate(selected)}
      />
      <Button label="Sign out" variant="tertiary" onPress={signOut} />
    </Screen>
  );
}
