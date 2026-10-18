import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

export type IconTone = 'primary' | 'tertiary' | 'open' | 'warning' | 'error' | 'neutral' | 'onDark';

const TONE: Record<IconTone, { container: string; color: string }> = {
  primary: { container: 'bg-primary/10', color: colors.primary },
  tertiary: { container: 'bg-tertiary/10', color: colors.tertiary },
  open: { container: 'bg-status-open/10', color: colors['on-status-open-container'] },
  warning: { container: 'bg-status-warning/15', color: colors['on-status-warning-container'] },
  error: { container: 'bg-error/10', color: colors.error },
  neutral: { container: 'bg-surface-container-high', color: colors['on-surface-variant'] },
  onDark: { container: 'bg-on-primary/15', color: colors['on-primary'] },
};

const SIZE = { sm: { box: 'h-8 w-8', icon: 16 }, md: { box: 'h-11 w-11', icon: 20 }, lg: { box: 'h-14 w-14', icon: 26 } };

/** Circular, softly tinted icon container used as a visual anchor on cards. */
export function IconBadge({
  icon: Icon,
  tone = 'primary',
  size = 'md',
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: keyof typeof SIZE;
}) {
  const t = TONE[tone];
  return (
    <View className={cn('items-center justify-center rounded-full', SIZE[size].box, t.container)}>
      <Icon size={SIZE[size].icon} color={t.color} strokeWidth={2.2} />
    </View>
  );
}
