import { Pressable, Text, View } from 'react-native';

/** Serif section title with an optional text action on the right. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text accessibilityRole="header" className="font-headline text-headline-sm text-on-surface">
        {title}
      </Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text className="font-label text-label-md text-primary">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
