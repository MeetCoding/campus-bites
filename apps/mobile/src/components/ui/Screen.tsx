import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

/** Page shell: background surface, safe-area padding, optional scrolling. */
export function Screen({
  children,
  scroll = true,
  className,
}: {
  children: ReactNode;
  scroll?: boolean;
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
        <View className={cn('py-space-md', body)}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
