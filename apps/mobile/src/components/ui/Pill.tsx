import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';
import { selectionTap } from '@/lib/haptics';
import { colors } from '@/theme/tokens';

/** Selectable chip, e.g. the Bhawan selector, day picker and complaint category chips. */
export function Pill({
  label,
  selected = false,
  onPress,
  icon: Icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        if (!selected) selectionTap();
        onPress?.();
      }}
      className={cn(
        'flex-row items-center gap-1.5 rounded-full px-4 py-2 active:scale-95',
        selected ? 'bg-primary' : 'bg-surface-container-lowest',
      )}>
      {Icon ? <Icon size={14} color={selected ? colors['on-primary'] : colors['on-surface-variant']} /> : null}
      <Text
        className={cn(
          'font-label-bold text-label-md',
          selected ? 'text-on-primary' : 'text-on-surface-variant',
        )}>
        {label}
      </Text>
    </Pressable>
  );
}
