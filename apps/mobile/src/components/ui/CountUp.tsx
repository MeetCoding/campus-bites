import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const DURATION_MS = 900;

/** A number that rolls from its previous value to `value` (ease-out cubic). */
export function CountUp({ value, suffix = '', className }: { value: number; suffix?: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    const start = Date.now();
    const origin = from.current;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / DURATION_MS);
      const next = Math.round(origin + (value - origin) * (1 - (1 - t) ** 3));
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduceMotion]);

  return (
    <Text className={className} accessibilityLabel={`${value}${suffix}`}>
      {reduceMotion ? value : shown}
      {suffix}
    </Text>
  );
}
