import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

// RN `boxShadow` (new architecture) renders the same on Android, iOS and web.
const PANEL_SHADOW = { boxShadow: `0 4px 14px -6px ${colors['card-shadow']}` };

type CardTone = 'lowest' | 'low' | 'container';

// White panels sit on the timberwolf background with a hairline and a soft lift so they stay
// distinct; nested tiers (low / container) are already tonal shifts inside a panel.
const toneClass: Record<CardTone, string> = {
  lowest: 'border border-card-edge bg-surface-container-lowest',
  low: 'bg-surface-container-low',
  container: 'bg-surface-container',
};

/** Panel surface; `lowest` (white) panels carry a hairline edge and soft shadow for contrast. */
export function Card({
  children,
  tone = 'lowest',
  padded = true,
  className,
}: {
  children: ReactNode;
  tone?: CardTone;
  /** false for edge-to-edge content (e.g. a photo header bar). */
  padded?: boolean;
  className?: string;
}) {
  return (
    <View
      className={cn('rounded-3xl', padded && 'p-space-md', toneClass[tone], className)}
      style={tone === 'lowest' ? PANEL_SHADOW : undefined}>
      {children}
    </View>
  );
}
