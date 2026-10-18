import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

type DotTone = 'open' | 'warning' | 'error' | 'onDark';

const DOT_COLOR: Record<DotTone, string> = {
  open: colors['status-open'],
  warning: colors['status-warning'],
  error: colors.error,
  onDark: colors['tertiary-fixed'],
};

/** Status dot with a soft expanding halo; `pulse={false}` renders a still dot. */
export function LiveDot({ tone = 'open', pulse = true, size = 8 }: { tone?: DotTone; pulse?: boolean; size?: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (pulse) {
      progress.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    } else {
      progress.set(0);
    }
  }, [pulse, progress]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 1.6 }],
  }));

  const color = DOT_COLOR[tone];
  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      {pulse ? <Animated.View style={[dot, { position: 'absolute' }, halo]} /> : null}
      <View style={dot} />
    </View>
  );
}
