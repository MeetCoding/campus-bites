import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { selectionTap } from '@/lib/haptics';
import { colors } from '@/theme/tokens';

const PADDING = 4;
const SPRING = { damping: 20, stiffness: 260, mass: 0.7 };

/** Tab switch with a white thumb that slides to the selected option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - PADDING * 2) / options.length : 0;
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const thumb = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(index * segment, SPRING) }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="flex-row rounded-full bg-surface-container-high p-1">
      {segment > 0 ? (
        // Reanimated views aren't NativeWind-aware, so the thumb is styled from tokens directly.
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: PADDING,
              bottom: PADDING,
              left: PADDING,
              borderRadius: 9999,
              backgroundColor: colors['surface-container-lowest'],
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              selectionTap();
              onChange(option.value);
            }}
            className="flex-1 items-center rounded-full px-space-sm py-2.5">
            <Text
              numberOfLines={1}
              className={cn(
                'font-label-bold text-label-md',
                selected ? 'text-primary' : 'text-on-surface-variant',
              )}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
