import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { cn } from '@/lib/cn';
import { selectionTap } from '@/lib/haptics';

const LENGTH = 6;

/**
 * Six digit boxes over one hidden TextInput, so paste and SMS autofill (`oneTimeCode`) still
 * work. Tapping any box focuses the input.
 */
export function OtpInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  error?: string;
}) {
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-space-sm">
      <Text className="font-label text-label-md text-on-surface-variant">{label}</Text>
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        className="flex-row justify-between gap-space-xs">
        {Array.from({ length: LENGTH }, (_, i) => {
          const digit = value[i];
          const active = focused && i === Math.min(value.length, LENGTH - 1);
          return (
            <View
              key={i}
              className={cn(
                'h-14 flex-1 items-center justify-center rounded-2xl border-2',
                error
                  ? 'border-error bg-error-container/40'
                  : active
                    ? 'border-primary bg-surface-container-lowest'
                    : digit
                      ? 'border-transparent bg-primary/10'
                      : 'border-transparent bg-surface-container-low',
              )}>
              <Text className="font-headline text-headline-md text-on-surface">{digit ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, LENGTH);
          if (digits.length !== value.length) selectionTap();
          onChange(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={LENGTH}
        autoFocus
        caretHidden
        // Kept in the layout (not display:none) so it can take focus and receive autofill.
        className="absolute h-px w-px opacity-0"
      />
      {error ? <Text className="font-body text-body-sm text-error">{error}</Text> : null}
    </View>
  );
}
