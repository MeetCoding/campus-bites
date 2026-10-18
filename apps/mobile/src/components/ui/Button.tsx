import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

const labelClass: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-primary',
  tertiary: 'text-primary underline',
};

const contentClass = 'min-h-12 items-center justify-center px-5 py-3';

/** Alexandria buttons: primary = gradient fill, secondary = surface-high, tertiary = text. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  className,
}: ButtonProps) {
  const inactive = disabled || loading;
  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? colors['on-primary'] : colors.primary} />
  ) : (
    <Text className={cn('font-body-semibold text-label-lg', labelClass[variant])}>{label}</Text>
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      haptic={variant === 'tertiary' ? 'selection' : 'impact'}
      className={className}>
      <View
        className={cn(
          'overflow-hidden rounded-full',
          variant === 'secondary' && 'bg-surface-container-high',
          inactive && 'opacity-50',
        )}>
        {variant === 'primary' ? (
          // LinearGradient is not a NativeWind-aware component, so it takes a style.
          <LinearGradient
            colors={[colors.primary, colors['primary-container']]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <View className={contentClass}>{content}</View>
          </LinearGradient>
        ) : (
          <View className={contentClass}>{content}</View>
        )}
      </View>
    </PressableScale>
  );
}
