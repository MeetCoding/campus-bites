import { Children, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enterUp } from '@/components/ui/motion';
import { cn } from '@/lib/cn';

/**
 * Page shell: background surface, safe-area padding, optional scrolling. Scrolling screens bring
 * their sections in with a staggered fade-up (`animateIn={false}` to opt out); fixed screens don't,
 * since their children often rely on `flex-1`.
 */
export function Screen({
  children,
  scroll = true,
  animateIn = true,
  className,
}: {
  children: ReactNode;
  scroll?: boolean;
  animateIn?: boolean;
  className?: string;
}) {
  const insets = useSafeAreaInsets();
  const body = cn('gap-space-md px-margin', className);

  if (!scroll) {
    return (
      <View
        className={cn('flex-1 bg-background', body)}
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {children}
      </View>
    );
  }
  // The top inset pads the outer view, not the scroll content, so content scrolls under a solid
  // strip instead of behind the status bar. KeyboardAvoidingView per Expo's keyboard guide:
  // 'padding' on iOS, no behavior on Android.
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <View className={cn('py-space-md', body)}>
          {animateIn
            ? Children.toArray(children).map((child, index) => (
                // toArray gives every child a stable key, so sections that appear later
                // (after a query resolves) animate in on their own.
                <Animated.View key={(child as { key?: string }).key ?? index} entering={enterUp(index)}>
                  {child}
                </Animated.View>
              ))
            : children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
