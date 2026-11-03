import { Easing, FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

const EASE_OUT = Easing.out(Easing.cubic);

/** Fast fade-up entrance (≈200 ms). The stagger caps at the 5th slot so long lists never lag. */
export function enterUp(index: number, baseDelay = 0) {
  return FadeInDown.delay(baseDelay + Math.min(index, 5) * 30)
    .duration(200)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);
}

/** Quick fade for icons and small elements; stagger with `index`. */
export function popIn(index: number, baseDelay = 0) {
  return FadeIn.delay(baseDelay + Math.min(index, 5) * 40)
    .duration(180)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);
}
