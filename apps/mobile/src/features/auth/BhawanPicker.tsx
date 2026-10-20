import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';

const NO_HOSTEL = 'none';

/**
 * Pick your Bhawan (set once; profiles_guard_bhawan) or, with `allowNoHostel`, say you don't live in
 * one (staff, faculty, day scholars): that only stamps onboarded_at, so a Bhawan can still be
 * chosen later. A fresh token (refreshClaims) lifts the onboarding gate either way.
 */
export function BhawanPicker({ allowNoHostel = false, onDone }: { allowNoHostel?: boolean; onDone?: () => void }) {
  const { claims, refreshClaims } = useSession();
  const bhawans = useBhawans();
  const [selected, setSelected] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (choice: string) => {
      if (!claims) throw new Error('Not signed in');
      const { error } = await supabase
        .from('profiles')
        .update(choice === NO_HOSTEL ? { onboarded_at: new Date().toISOString() } : { bhawan_id: choice })
        .eq('id', claims.sub);
      if (error) throw error;
      await refreshClaims();
    },
    onSuccess: () => onDone?.(),
  });

  const options = [
    ...(bhawans.data ?? []).map((b) => ({ id: b.id, label: b.name, hint: null as string | null })),
    ...(allowNoHostel
      ? [{ id: NO_HOSTEL, label: "I don't live in a hostel", hint: 'Staff, faculty or day scholar' }]
      : []),
  ];

  return (
    <View className="gap-space-md">
      {bhawans.isPending ? (
        <ActivityIndicator />
      ) : bhawans.isError ? (
        <Text className="font-body text-body-md text-error">{bhawans.error.message}</Text>
      ) : (
        <View accessibilityRole="radiogroup" className="gap-space-sm">
          {options.map((option) => {
            const isSelected = option.id === selected;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => setSelected(option.id)}
                className={cn(
                  'min-h-12 justify-center rounded-xl px-space-md py-space-sm active:opacity-80',
                  isSelected ? 'bg-primary' : option.id === NO_HOSTEL ? 'bg-surface-container-high' : 'bg-surface-container-lowest',
                )}>
                <Text
                  className={cn('font-body-semibold text-body-lg', isSelected ? 'text-on-primary' : 'text-on-surface')}>
                  {option.label}
                </Text>
                {option.hint ? (
                  <Text
                    className={cn(
                      'font-body text-body-sm',
                      isSelected ? 'text-on-primary-container' : 'text-on-surface-variant',
                    )}>
                    {option.hint}
                  </Text>
                ) : null}
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
        label={selected === NO_HOSTEL ? 'Continue without a hostel' : 'Confirm Bhawan'}
        disabled={!selected}
        loading={save.isPending}
        onPress={() => selected && save.mutate(selected)}
      />
    </View>
  );
}
