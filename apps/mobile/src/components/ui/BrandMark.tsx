import { useEffect, type ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

// Vector paths from brand-kit/CampusBites_Logo.svg (the "C" bubble and two fern bite marks),
// cropped to the symbol's own bounds.
const C_PATH =
  'M 148 40 C 89 40 42 87 42 146 C 42 206 89 252 148 252 C 193 252 226 231 245 196 Q 250 186 240 180 L 217 167 Q 208 162 202 172 C 191 191 173 201 148 201 C 118 201 94 178 94 146 C 94 114 118 91 148 91 C 174 91 192 102 204 122 Q 210 130 219 124 L 243 108 Q 251 103 245 93 C 226 59 192 40 148 40 Z';
const TAIL_PATH = 'M 111 192 L 105 221 Q 104 225 108 223 L 135 206 Z';
const BITE_PATHS = [
  'M 249 132 L 279 115 Q 289 109 294 118 Q 298 126 287 132 L 258 149 Q 246 155 242 145 Q 239 138 249 132 Z',
  'M 255 165 L 286 165 Q 299 165 299 176 Q 299 186 286 185 L 255 183 Q 244 182 244 173 Q 245 165 255 165 Z',
];
const VIEWBOX = '40 38 262 216';
const ASPECT = 262 / 216;

type Tone = 'color' | 'onDark';

function toneColors(tone: Tone) {
  // On dark, as on the app icon: timberwolf "C", sage bites, cut-out in the deep green.
  return tone === 'onDark'
    ? { body: colors.background, cutout: colors['inverse-surface'], bite: colors['tertiary-container'] }
    : { body: colors.primary, cutout: colors.background, bite: colors.accent };
}

/** The Campus Bites symbol. `onDark` swaps the green "C" for timberwolf, as on the app icon. */
export function BrandSymbol({ size = 48, tone = 'color' }: { size?: number; tone?: Tone }) {
  const { body, cutout, bite } = toneColors(tone);
  return (
    <Svg width={size * ASPECT} height={size} viewBox={VIEWBOX} accessibilityLabel="Campus Bites logo">
      <Path fill={body} d={C_PATH} />
      <Path fill={cutout} d={TAIL_PATH} />
      {BITE_PATHS.map((d) => (
        <Path key={d} fill={bite} d={d} />
      ))}
    </Svg>
  );
}

const LOGO_SPRING = { damping: 16, stiffness: 260, mass: 0.7 };

/** One full-size SVG layer so each part of the symbol can move on its own. */
function Layer({ size, style, children }: { size: number; style: AnimatedStyle<ViewStyle>; children: ReactNode }) {
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, style]}>
      <Svg width={size * ASPECT} height={size} viewBox={VIEWBOX}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function useBiteStyle(progress: SharedValue<number>, chomp: SharedValue<number>, size: number) {
  const unit = size / 216;
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (-46 * (1 - progress.value) + chomp.value * 10) * unit }],
  }));
}

/**
 * The symbol's entrance: the "C" turns in and the two bite marks slide out of its mouth in
 * under half a second, then it stays still. Static when the system asks for reduced motion.
 */
export function AnimatedBrandSymbol({ size = 72, tone = 'color' }: { size?: number; tone?: Tone }) {
  const reduceMotion = useReducedMotion();
  const { body, cutout, bite } = toneColors(tone);
  const c = useSharedValue(reduceMotion ? 1 : 0);
  const bite1 = useSharedValue(reduceMotion ? 1 : 0);
  const bite2 = useSharedValue(reduceMotion ? 1 : 0);
  // Entrance only: no looping animation.
  const chomp = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    c.set(withSpring(1, LOGO_SPRING));
    bite1.set(withDelay(150, withSpring(1, LOGO_SPRING)));
    bite2.set(withDelay(220, withSpring(1, LOGO_SPRING)));
  }, [reduceMotion, c, bite1, bite2]);

  const cStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, c.value * 1.5),
    transform: [{ scale: 0.7 + 0.3 * c.value }, { rotate: `${-45 * (1 - c.value)}deg` }],
  }));
  const bite1Style = useBiteStyle(bite1, chomp, size);
  const bite2Style = useBiteStyle(bite2, chomp, size);

  return (
    <View accessibilityRole="image" accessibilityLabel="Campus Bites logo" style={{ width: size * ASPECT, height: size }}>
      <Layer size={size} style={cStyle}>
        <Path fill={body} d={C_PATH} />
        <Path fill={cutout} d={TAIL_PATH} />
      </Layer>
      <Layer size={size} style={bite1Style}>
        <Path fill={bite} d={BITE_PATHS[0]} />
      </Layer>
      <Layer size={size} style={bite2Style}>
        <Path fill={bite} d={BITE_PATHS[1]} />
      </Layer>
    </View>
  );
}

const WORDMARK = [
  ...Array.from('Campus', (ch) => ({ ch, accent: false })),
  ...Array.from('Bites', (ch) => ({ ch, accent: true })),
];

/**
 * Kinetic "CampusBites" wordmark: each letter fades up in quick succession ("Bites" in fern, sage on dark).
 * `className` sets the type size; the color follows `tone`.
 */
export function KineticWordmark({
  tone = 'color',
  className,
  delay = 80,
}: {
  tone?: Tone;
  className?: string;
  delay?: number;
}) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="CampusBites" className="flex-row">
      {WORDMARK.map(({ ch, accent }, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(delay + i * 18)
            .duration(200)
            .reduceMotion(ReduceMotion.System)}>
          <Text
            className={cn(
              'font-headline',
              accent
                ? tone === 'onDark'
                  ? 'text-tertiary-container'
                  : 'text-accent'
                : tone === 'onDark'
                  ? 'text-on-primary'
                  : 'text-primary',
              className,
            )}>
            {ch}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/** Symbol + "CampusBites" wordmark (Nunito Sans ExtraBold, "Bites" in fern, sage on dark). */
export function BrandLogo({ size = 40, tone = 'color', className }: { size?: number; tone?: Tone; className?: string }) {
  return (
    <View className={cn('flex-row items-center gap-space-sm', className)}>
      <BrandSymbol size={size} tone={tone} />
      <Text
        accessibilityRole="header"
        className={cn('font-headline', tone === 'onDark' ? 'text-on-primary' : 'text-primary')}
        style={{ fontSize: size * 0.72, lineHeight: size * 0.9, letterSpacing: -0.5 }}>
        Campus<Text className={tone === 'onDark' ? 'text-tertiary-container' : 'text-accent'}>Bites</Text>
      </Text>
    </View>
  );
}
