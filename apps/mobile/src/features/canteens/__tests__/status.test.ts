import { describe, expect, it } from '@jest/globals';

import { describeLiveStatus, formatShift } from '@/features/canteens/status';
import { formatInstant } from '@/lib/time';

// All instants in UTC; IST = UTC + 5:30.
const at = (iso: string) => new Date(iso);

describe('describeLiveStatus', () => {
  it('shows the closing time of an open canteen', () => {
    // 22:00 IST, day canteen closes 22:30 IST → within 30 min
    expect(
      describeLiveStatus(
        { is_open: true, closes_at: '2026-10-19T17:00:00Z', next_opens_at: null },
        at('2026-10-19T16:00:00Z'),
      ),
    ).toEqual({ tone: 'open', label: 'OPEN NOW • Closes at 10:30 PM' });
  });

  it('handles an overnight shift that closes the next morning', () => {
    // 01:30 IST Tue, night canteen closes 10:30 IST Tue
    expect(
      describeLiveStatus(
        { is_open: true, closes_at: '2026-10-20T05:00:00Z', next_opens_at: null },
        at('2026-10-19T20:00:00Z'),
      ).label,
    ).toBe('OPEN NOW • Closes at 10:30 AM');
  });

  it('warns when closing within 30 minutes', () => {
    expect(
      describeLiveStatus(
        { is_open: true, closes_at: '2026-10-19T17:00:00Z', next_opens_at: null },
        at('2026-10-19T16:40:00Z'),
      ),
    ).toEqual({ tone: 'closing', label: 'OPEN NOW • Closes in 20 min' });
  });

  it('says when a closed canteen opens: today, tomorrow or a weekday', () => {
    const closed = (next: string) => ({ is_open: false, closes_at: null, next_opens_at: next });
    // 09:00 IST Mon → opens 10:30 IST Mon
    expect(describeLiveStatus(closed('2026-10-19T05:00:00Z'), at('2026-10-19T03:30:00Z')).label).toBe('OPENS AT 10:30 AM');
    // 23:00 IST Mon → opens 10:30 IST Tue
    expect(describeLiveStatus(closed('2026-10-20T05:00:00Z'), at('2026-10-19T17:30:00Z')).label).toBe('OPENS TOMORROW 10:30 AM');
    // closed for Diwali Tue → opens Wed
    expect(describeLiveStatus(closed('2026-10-21T05:00:00Z'), at('2026-10-19T17:30:00Z')).label).toBe('OPENS WED 10:30 AM');
  });

  it('is CLOSED with no published hours, and opened manually it has no closing time', () => {
    expect(describeLiveStatus({ is_open: false, closes_at: null, next_opens_at: null }).label).toBe('CLOSED');
    expect(describeLiveStatus({ is_open: true, closes_at: null, next_opens_at: null }).label).toBe('OPEN NOW');
  });

  it('applies a boundary that passed since the last fetch', () => {
    expect(
      describeLiveStatus(
        { is_open: true, closes_at: '2026-10-19T17:00:00Z', next_opens_at: null },
        at('2026-10-19T17:00:00Z'),
      ).label,
    ).toBe('CLOSED');
    expect(
      describeLiveStatus(
        { is_open: false, closes_at: null, next_opens_at: '2026-10-19T17:00:00Z' },
        at('2026-10-19T17:01:00Z'),
      ).label,
    ).toBe('OPEN NOW');
  });
});

describe('IST formatting of instants', () => {
  it('formats in IST regardless of the device timezone', () => {
    expect(formatInstant('2026-10-19T18:30:00Z')).toBe('12:00 AM');
    expect(formatShift('2026-10-19T17:00:00Z', '2026-10-20T05:00:00Z')).toBe('10:30 PM – 10:30 AM');
  });
});
