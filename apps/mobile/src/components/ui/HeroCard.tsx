import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { AnimatedBrandSymbol } from '@/components/ui/BrandMark';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

/** A soft radial glow that drifts slowly back and forth behind the hero content. */
function GlowOrb({
  color,
  size,
  opacity,
  position,
  drift,
  duration,
}: {
  color: string;
  size: number;
  opacity: number;
  position: { top?: number; right?: number; bottom?: number; left?: number };
  drift: { x: number; y: number };
  duration: number;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, duration, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * drift.x },
      { translateY: t.value * drift.y },
      { scale: 1 + t.value * 0.12 },
    ],
  }));

  const id = `glow-${color.slice(1)}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, position, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The one high-contrast surface at the top of a main screen: deep green → primary gradient with
 * drifting sage / fern glows and a faint animated logo in the corner (the sign-in motion piece;
 * `mark={false}` where the logo is already shown), large radius, light text. Children use
 * `text-on-primary` / `text-on-primary-container`.
 */
export function HeroCard({ children, className, mark = true }: { children: ReactNode; className?: string; mark?: boolean }) {
  return (
    <View className="overflow-hidden rounded-4xl">
      {/* LinearGradient is not NativeWind-aware, so it takes a style. */}
      <LinearGradient
        colors={[colors.hero, colors['on-primary-fixed-variant'], colors.primary]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <GlowOrb
          color={colors['tertiary-container']}
          size={240}
          opacity={0.4}
          position={{ top: -110, right: -80 }}
          drift={{ x: -36, y: 24 }}
          duration={7000}
        />
        <GlowOrb
          color={colors['primary-container']}
          size={200}
          opacity={0.35}
          position={{ bottom: -110, left: -70 }}
          drift={{ x: 40, y: -18 }}
          duration={9000}
        />
        {mark ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute -bottom-5 -right-3 opacity-15">
            <AnimatedBrandSymbol size={112} tone="onDark" />
          </View>
        ) : null}
        <View className={cn('gap-space-md p-space-lg', className)}>{children}</View>
      </LinearGradient>
    </View>
  );
}
