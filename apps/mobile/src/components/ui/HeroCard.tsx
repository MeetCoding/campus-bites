import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { BrandSymbol } from '@/components/ui/BrandMark';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

/** A soft, still radial glow behind the hero content. */
function GlowOrb({
  color,
  size,
  opacity,
  position,
}: {
  color: string;
  size: number;
  opacity: number;
  position: { top?: number; right?: number; bottom?: number; left?: number };
}) {
  const id = `glow-${color.slice(1)}`;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, position]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The one high-contrast surface at the top of a main screen: deep green → primary gradient with
 * still sage / fern glows and a faint logo in the corner
 * (`mark={false}` where the logo is already shown), large radius, light text. Children use
 * `text-on-primary` / `text-on-primary-container`.
 */
export function HeroCard({ children, className, mark = true }: { children: ReactNode; className?: string; mark?: boolean }) {
  return (
    <View className="overflow-hidden rounded-3xl">
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
        />
        <GlowOrb
          color={colors['primary-container']}
          size={200}
          opacity={0.35}
          position={{ bottom: -110, left: -70 }}
        />
        {mark ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute -bottom-5 -right-3 opacity-15">
            <BrandSymbol size={112} tone="onDark" />
          </View>
        ) : null}
        <View className={cn('gap-space-md p-space-lg', className)}>{children}</View>
      </LinearGradient>
    </View>
  );
}
