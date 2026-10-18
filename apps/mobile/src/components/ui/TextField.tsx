import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Fixed text before the input, e.g. "+91". */
  prefix?: string;
};

/** White input with a ghost border that turns primary on focus (DESIGN.md "Inputs"). */
export function TextField({
  label,
  error,
  hint,
  prefix,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-space-xs">
      <Text className="font-label text-label-md text-on-surface-variant">{label}</Text>
      <View
        className={cn(
          'min-h-12 flex-row items-center overflow-hidden rounded-2xl border bg-surface-container-lowest',
          error ? 'border-error' : focused ? 'border-primary' : 'border-outline-variant/15',
        )}>
        {prefix ? (
          <View className="self-stretch justify-center bg-surface-container-low px-space-md">
            <Text className="font-body-semibold text-body-lg text-on-surface">{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.outline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className="min-h-12 flex-1 px-space-md font-body text-body-lg text-on-surface"
          {...inputProps}
        />
      </View>
      {error ? (
        <Text className="font-body text-body-sm text-error">{error}</Text>
      ) : hint ? (
        <Text className="font-body text-body-sm text-on-surface-variant">{hint}</Text>
      ) : null}
    </View>
  );
}
