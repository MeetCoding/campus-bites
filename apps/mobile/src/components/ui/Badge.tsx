import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type BadgeTone = 'open' | 'warning' | 'longStanding' | 'official' | 'neutral';

const toneClass: Record<BadgeTone, { container: string; text: string }> = {
  open: { container: 'bg-status-open-container', text: 'text-on-status-open-container' },
  warning: { container: 'bg-status-warning-container', text: 'text-on-status-warning-container' },
  longStanding: { container: 'bg-error-container', text: 'text-on-error-container' },
  official: { container: 'bg-tertiary-fixed', text: 'text-on-tertiary-fixed-variant' },
  neutral: { container: 'bg-surface-container-high', text: 'text-on-surface-variant' },
};

/** Small uppercase status label, e.g. "OPEN NOW", "LONG-STANDING ISSUE". */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const { container, text } = toneClass[tone];
  return (
    <View className={cn('self-start rounded-full px-2 py-0.5', container)}>
      <Text className={cn('font-label-bold text-label-sm uppercase', text)}>{label}</Text>
    </View>
  );
}
