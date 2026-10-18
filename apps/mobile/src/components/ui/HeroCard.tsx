import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

/**
 * The one high-contrast surface at the top of a main screen: deep navy → primary gradient,
 * large radius, light text. Children use `text-on-primary` / `text-on-primary-container`.
 */
export function HeroCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className="overflow-hidden rounded-4xl">
      {/* LinearGradient is not NativeWind-aware, so it takes a style. */}
      <LinearGradient
        colors={[colors.hero, colors['on-primary-fixed-variant'], colors.primary]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <View className={cn('gap-space-md p-space-lg', className)}>{children}</View>
      </LinearGradient>
    </View>
  );
}
