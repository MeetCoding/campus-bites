import { addDays, DAY_LABEL, formatDuration, formatInstant, istNow } from '@/lib/time';

/** The parts of an outlet_live_status row the pill needs (computed in SQL, IST). */
export type LiveStatus = {
  is_open: boolean;
  closes_at: string | null;
  next_opens_at: string | null;
};

export type StatusTone = 'open' | 'closing' | 'closed';

const CLOSING_SOON_MINUTES = 30;

/**
 * "OPEN NOW • Closes at 10:30 PM" / "OPENS TOMORROW 10:30 AM" / "CLOSED".
 * The row is a snapshot from the last fetch, so a boundary that has already passed is applied here.
 */
export function describeLiveStatus(status: LiveStatus, now: Date = new Date()): { tone: StatusTone; label: string } {
  const nowMs = now.getTime();
  if (status.is_open) {
    if (!status.closes_at) return { tone: 'open', label: 'OPEN NOW' };
    const minutesLeft = (Date.parse(status.closes_at) - nowMs) / 60_000;
    if (minutesLeft <= 0) return { tone: 'closed', label: 'CLOSED' };
    if (minutesLeft <= CLOSING_SOON_MINUTES) {
      return { tone: 'closing', label: `OPEN NOW • Closes in ${formatDuration(Math.ceil(minutesLeft))}` };
    }
    return { tone: 'open', label: `OPEN NOW • Closes at ${formatInstant(status.closes_at)}` };
  }
  if (status.next_opens_at) {
    if (Date.parse(status.next_opens_at) <= nowMs) return { tone: 'open', label: 'OPEN NOW' };
    return { tone: 'closed', label: `OPENS ${opensWhen(status.next_opens_at, now)}` };
  }
  return { tone: 'closed', label: 'CLOSED' };
}

function opensWhen(iso: string, now: Date): string {
  const today = istNow(now).date;
  const opens = istNow(new Date(iso));
  const time = formatInstant(iso);
  if (opens.date === today) return `AT ${time}`;
  if (opens.date === addDays(today, 1)) return `TOMORROW ${time}`;
  return `${DAY_LABEL[opens.dayKey].toUpperCase()} ${time}`;
}

/** "10:30 PM – 10:30 AM" for a shift occurrence. */
export function formatShift(startsAt: string, endsAt: string): string {
  return `${formatInstant(startsAt)} – ${formatInstant(endsAt)}`;
}
