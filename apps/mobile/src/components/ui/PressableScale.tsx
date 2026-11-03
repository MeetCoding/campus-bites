import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { impactTap, selectionTap } from '@/lib/haptics';

const PRESSED_SCALE = 0.98;
const PRESS_MS = 80;

type PressableScaleProps = Omit<PressableProps, 'children'> & {
  children: ReactNode;
  /** 'impact' for actions, 'selection' for choices, 'none' when the caller fires its own. */
  haptic?: 'impact' | 'selection' | 'none';
  /** Layout classes for the touch target (width, flex). Visual styling belongs on the child. */
  className?: string;
};

/**
 * Pressable whose content dips to 98 % while held, with a haptic tick on press.
 * Forwards every Pressable prop, so it works as an expo-router `<Link asChild>` child.
 */
export function PressableScale({ children, haptic = 'impact', onPress, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        scale.set(withTiming(PRESSED_SCALE, { duration: PRESS_MS }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: PRESS_MS }));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic === 'impact') impactTap();
        else if (haptic === 'selection') selectionTap();
        onPress?.(event);
      }}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}
