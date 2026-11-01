import { Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useReducedMotion,
  withDelay,
  withTiming,
  type EntryAnimationsValues,
  type LayoutAnimation,
} from 'react-native-reanimated';

/**
 * A headline with the sign-in wordmark's motion: letters spring up one after another, words wrap
 * as units. `className` styles every letter (font, size, colour). Replays when `text` changes.
 */
export function KineticText({ text, className, delay = 120 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(' ');
  // Index of each word's first letter in the whole title, so the stagger runs across words.
  const starts = words.map((_, w) => words.slice(0, w).reduce((n, word) => n + word.length, 0));

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={text} className="flex-row flex-wrap">
      {words.map((word, w) => (
        <View key={`${text}-${w}`} className="flex-row">
          {Array.from(word, (ch, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(delay + Math.min(starts[w] + i, 24) * 30)
                .springify()
                .damping(12)
                .stiffness(180)
                .reduceMotion(ReduceMotion.System)}>
              <Text className={className}>{ch}</Text>
            </Animated.View>
          ))}
          {w < words.length - 1 ? <Text className={className}> </Text> : null}
        </View>
      ))}
    </View>
  );
}

const REVEAL_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/** Rises from below its own height (the parent clips it), so the text slides out of a mask. */
function maskRise(delay: number) {
  return (values: EntryAnimationsValues): LayoutAnimation => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: values.targetHeight }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: 450, easing: REVEAL_EASING })),
        transform: [{ translateY: withDelay(delay, withTiming(0, { duration: 750, easing: REVEAL_EASING })) }],
      },
    };
  };
}

/**
 * A calmer headline motion for prominent, changing labels (e.g. the current meal): each word
 * glides up out of a clipping mask with a long ease-out, no bounce. Replays when `text` changes;
 * static when the system asks for reduced motion.
 */
export function RevealText({ text, className, delay = 150 }: { text: string; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  const words = text.split(' ');

  return (
    <View key={text} accessible accessibilityRole="header" accessibilityLabel={text} className="flex-row flex-wrap">
      {words.map((word, w) => (
        <View key={w} className="overflow-hidden">
          <Animated.View entering={reduceMotion ? undefined : maskRise(delay + w * 90)}>
            <Text className={className}>
              {word}
              {w < words.length - 1 ? ' ' : ''}
            </Text>
          </Animated.View>
        </View>
      ))}
    </View>
  );
}
