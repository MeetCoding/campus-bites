import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

type CardTone = 'lowest' | 'low' | 'container';

const toneClass: Record<CardTone, string> = {
  lowest: 'bg-surface-container-lowest',
  low: 'bg-surface-container-low',
  container: 'bg-surface-container',
};

/** No borders: separation comes from the surface tier (DESIGN.md "No-Line Rule"). */
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
    <View className={cn('rounded-3xl', padded && 'p-space-md', toneClass[tone], className)}>
      {children}
    </View>
  );
}
