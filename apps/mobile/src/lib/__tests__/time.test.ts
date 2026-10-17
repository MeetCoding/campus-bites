import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  currentMeal,
  dayKeyOf,
  formatDateRange,
  formatDuration,
  formatTime,
  formatWindow,
  isValidDateInput,
  isValidTimeInput,
  istNow,
  parseTime,
  slotStatus,
  timeAgo,
  weekStart,
  type MealWindow,
} from '@/lib/time';

const meals: MealWindow[] = [
  { slot: 'dinner', opens_at: '19:30:00', closes_at: '21:30:00', is_closed: false },
  { slot: 'breakfast', opens_at: '07:30:00', closes_at: '09:30:00', is_closed: false },
  { slot: 'lunch', opens_at: '12:30:00', closes_at: '14:30:00', is_closed: false },
];

describe('istNow', () => {
  it('converts UTC to IST (+5:30) including the date rollover', () => {
    // 2026-10-18 20:00 UTC = 2026-10-19 01:30 IST (Monday)
    expect(istNow(new Date('2026-10-18T20:00:00Z'))).toEqual({ date: '2026-10-19', minutes: 90, dayKey: 'mon' });
  });

  it('matches the SQL test fixture: 02:45 UTC Monday is 08:15 IST', () => {
    expect(istNow(new Date('2026-10-19T02:45:00Z')).minutes).toBe(8 * 60 + 15);
  });
});

describe('time formatting', () => {
  it.each([
    ['07:30:00', '7:30 AM'],
    ['00:05', '12:05 AM'],
    ['12:00:00', '12:00 PM'],
    ['21:30:00', '9:30 PM'],
  ])('formatTime(%s) = %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });

  it('formats a window with an en dash', () => {
    expect(formatWindow('07:30:00', '09:30:00')).toBe('7:30 AM – 9:30 AM');
  });

  it('parses and validates times', () => {
    expect(parseTime('07:30:00')).toBe(450);
    expect(isValidTimeInput('7:05')).toBe(true);
    expect(isValidTimeInput('23:59')).toBe(true);
    expect(isValidTimeInput('24:00')).toBe(false);
    expect(isValidTimeInput('7.30')).toBe(false);
  });

  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [125, '2 h 5 min'],
  ])('formatDuration(%s) = %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('dates', () => {
  it('finds the Monday of a week', () => {
    expect(weekStart('2026-10-17')).toBe('2026-10-12'); // Saturday
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Monday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dayKeyOf('2026-11-01')).toBe('sun');
  });

  it('mirrors the API date-range wording', () => {
    expect(formatDateRange('2026-10-18', '2026-10-18')).toBe('Sun 18 Oct');
    expect(formatDateRange('2026-10-18', '2026-10-19')).toBe('18–19 Oct');
    expect(formatDateRange('2026-10-30', '2026-11-02')).toBe('30 Oct – 2 Nov');
  });

  it('validates YYYY-MM-DD input', () => {
    expect(isValidDateInput('2026-10-19')).toBe(true);
    expect(isValidDateInput('2026-02-30')).toBe(false);
    expect(isValidDateInput('19-10-2026')).toBe(false);
  });

  it('describes relative time', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    expect(timeAgo('2026-10-17T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-17T11:48:00Z', now)).toBe('12 min ago');
    expect(timeAgo('2026-10-17T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-10-15T12:00:00Z', now)).toBe('2 days ago');
  });
});

describe('meal status', () => {
  it('mirrors SQL status rules with an end-exclusive window', () => {
    const breakfast = meals[1];
    expect(slotStatus(breakfast, parseTime('07:29'))).toBe('upcoming');
    expect(slotStatus(breakfast, parseTime('07:30'))).toBe('serving');
    expect(slotStatus(breakfast, parseTime('09:30'))).toBe('done');
    expect(slotStatus({ ...breakfast, is_closed: true }, parseTime('08:00'))).toBe('closed');
  });

  it('finds the meal being served and time to close', () => {
    const now = currentMeal(meals, parseTime('13:45'));
    expect(now.serving?.slot).toBe('lunch');
    expect(now.minutesLeft).toBe(45);
  });

  it('finds the next meal between services', () => {
    const now = currentMeal(meals, parseTime('16:00'));
    expect(now.serving).toBeNull();
    expect(now.next?.slot).toBe('dinner');
    expect(now.minutesLeft).toBe(210);
  });

  it('skips a closed meal', () => {
    const closedLunch = meals.map((m) => (m.slot === 'lunch' ? { ...m, is_closed: true } : m));
    expect(currentMeal(closedLunch, parseTime('11:00')).next?.slot).toBe('dinner');
  });

  it('has nothing left after dinner', () => {
    expect(currentMeal(meals, parseTime('22:00'))).toEqual({ serving: null, next: null, minutesLeft: null });
  });
});
