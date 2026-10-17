import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';

/** Selectable chip, e.g. the Bhawan selector and complaint category chips. */
export function Pill({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'rounded-full px-3.5 py-1.5 active:opacity-80',
        selected ? 'bg-primary' : 'bg-surface-container-low',
      )}>
      <Text
        className={cn(
          'font-label text-label-md',
          selected ? 'text-on-primary' : 'text-on-surface-variant',
        )}>
        {label}
      </Text>
    </Pressable>
  );
}
