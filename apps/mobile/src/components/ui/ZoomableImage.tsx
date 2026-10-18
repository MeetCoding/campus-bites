import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type ZoomableImageProps = {
  uri: string;
  visible: boolean;
  onClose: () => void;
  /** Shown under the image, e.g. "Uploaded by the Mess Secretary · 2 h ago". */
  caption?: string;
  accessibilityLabel: string;
};

/** Full-screen lightbox: pinch to zoom, drag when zoomed, double-tap to toggle zoom. */
export function ZoomableImage({ uri, visible, onClose, caption, accessibilityLabel }: ZoomableImageProps) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  // Keep the zoomed image covering the viewport: max offset is half the overflow.
  const clamp = (value: number, size: number, s: number) => {
    'worklet';
    const limit = ((s - 1) * size) / 2;
    return Math.min(limit, Math.max(-limit, value));
  };

  const pinch = usePinchGesture({
    onUpdate: (event) => {
      'worklet';
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * event.scale));
    },
    onDeactivate: () => {
      'worklet';
      if (scale.value <= 1.01) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      x.value = clamp(x.value, width, scale.value);
      y.value = clamp(y.value, height, scale.value);
      savedX.value = x.value;
      savedY.value = y.value;
    },
  });

  const pan = usePanGesture({
    minPointers: 1,
    onUpdate: (event) => {
      'worklet';
      if (scale.value <= 1) return;
      x.value = clamp(savedX.value + event.translationX, width, scale.value);
      y.value = clamp(savedY.value + event.translationY, height, scale.value);
    },
    onDeactivate: () => {
      'worklet';
      savedX.value = x.value;
      savedY.value = y.value;
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const close = () => {
    for (const value of [x, y, savedX, savedY]) value.set(0);
    scale.set(1);
    savedScale.set(1);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent>
      {/* Modals render outside the app root, so they need their own gesture root. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors['inverse-surface'] }}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <Image
              source={{ uri }}
              style={{ width, height }}
              contentFit="contain"
              accessibilityLabel={accessibilityLabel}
              accessible
            />
          </Animated.View>
        </GestureDetector>

        <View className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-margin pt-12">
          <Text className="font-label text-label-md text-inverse-on-surface">Pinch or double-tap to zoom</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={close}
            hitSlop={12}
            className="h-11 w-11 items-center justify-center rounded-full bg-inverse-surface/80">
            <X size={24} color={colors['inverse-on-surface']} />
          </Pressable>
        </View>

        {caption ? (
          <View className="absolute bottom-0 left-0 right-0 px-margin pb-10">
            <Text className="font-body text-body-sm text-inverse-on-surface">{caption}</Text>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
