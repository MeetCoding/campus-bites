import { useEffect, useState } from 'react';

/** Current time, re-rendered every `intervalMs` (for countdowns like "closes in 12 min"). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
