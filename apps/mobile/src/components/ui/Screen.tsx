import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
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
  const padding = { paddingTop: insets.top, paddingBottom: insets.bottom };
  const body = cn('gap-space-md px-margin', className);

  if (!scroll) {
    return (
      <View className={cn('flex-1 bg-background', body)} style={padding}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={padding}>
      <View className={cn('py-space-md', body)}>{children}</View>
    </ScrollView>
  );
}
