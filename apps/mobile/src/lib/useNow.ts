import { useSyncExternalStore } from 'react';

/**
 * One shared ticker per interval, however many components ask for the time. A long list of
 * cards used to start a timer each; now they all subscribe to a single one (started on the first
 * subscriber, stopped with the last).
 */
type Ticker = { now: Date; listeners: Set<() => void>; timer: ReturnType<typeof setInterval> | null };
const tickers = new Map<number, Ticker>();

function tickerFor(intervalMs: number): Ticker {
  let ticker = tickers.get(intervalMs);
  if (!ticker) {
    ticker = { now: new Date(), listeners: new Set(), timer: null };
    tickers.set(intervalMs, ticker);
  }
  return ticker;
}

function subscribeTo(intervalMs: number) {
  return (listener: () => void) => {
    const ticker = tickerFor(intervalMs);
    ticker.listeners.add(listener);
    if (!ticker.timer) {
      ticker.now = new Date();
      ticker.timer = setInterval(() => {
        ticker.now = new Date();
        ticker.listeners.forEach((notify) => notify());
      }, intervalMs);
    }
    return () => {
      ticker.listeners.delete(listener);
      if (ticker.listeners.size === 0 && ticker.timer) {
        clearInterval(ticker.timer);
        ticker.timer = null;
      }
    };
  };
}

const subscriptions = new Map<number, (listener: () => void) => () => void>();

/** Current time, re-rendered every `intervalMs` (for countdowns like "closes in 12 min"). */
export function useNow(intervalMs = 30_000): Date {
  let subscribe = subscriptions.get(intervalMs);
  if (!subscribe) {
    subscribe = subscribeTo(intervalMs);
    subscriptions.set(intervalMs, subscribe);
  }
  return useSyncExternalStore(subscribe, () => tickerFor(intervalMs).now);
}
