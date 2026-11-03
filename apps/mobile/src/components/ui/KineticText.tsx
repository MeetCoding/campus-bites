import { Text } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { enterUp } from '@/components/ui/motion';

/**
 * A headline that fades up once, quickly. (Kept under its old name; the per-letter spring was
 * slow and busy.) `className` styles the text. Replays when `text` changes.
 */
export function KineticText({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View key={text} entering={reduceMotion ? undefined : enterUp(0, delay)}>
      <Text accessibilityRole="header" className={className}>
        {text}
      </Text>
    </Animated.View>
  );
}

/** Same quick fade for prominent, changing labels (e.g. the current meal). */
export function RevealText({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return <KineticText text={text} className={className} delay={delay} />;
}
