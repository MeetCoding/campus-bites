import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/** A placeholder block with a gentle opacity pulse (still when the system asks for less motion). */
export function Skeleton({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(0.55, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduceMotion, pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={style} className={cn('rounded-xl bg-surface-dim', className)} />;
}

/** A card-shaped skeleton: title line, two text lines. */
export function SkeletonCard({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <Card className={cn('gap-space-sm', className)}>
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </Card>
  );
}

/** A list of card skeletons, announced once as busy to screen readers. */
export function SkeletonList({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <View accessible accessibilityLabel="Loading" accessibilityState={{ busy: true }} className="gap-space-sm">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}
