import { FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';

/** Shared spring for entrances: quick settle, a touch of overshoot. */
export const ENTER_SPRING = { damping: 18, stiffness: 170, mass: 0.8 };

/** Staggered fade-up entrance; later items cap at the 8th slot so long lists don't lag. */
export function enterUp(index: number, baseDelay = 0) {
  return FadeInDown.delay(baseDelay + Math.min(index, 8) * 60)
    .springify()
    .damping(ENTER_SPRING.damping)
    .stiffness(ENTER_SPRING.stiffness)
    .mass(ENTER_SPRING.mass)
    .reduceMotion(ReduceMotion.System);
}

/** Springy zoom-in (the sign-in hero's icon row); stagger with `index`. */
export function popIn(index: number, baseDelay = 0) {
  return ZoomIn.delay(baseDelay + Math.min(index, 8) * 90)
    .springify()
    .damping(10)
    .reduceMotion(ReduceMotion.System);
}
