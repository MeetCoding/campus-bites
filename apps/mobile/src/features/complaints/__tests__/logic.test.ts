import { describe, expect, it } from '@jest/globals';

import {
  availableActions,
  elapsedLabel,
  isLongStanding,
  nudgeState,
  trackerStep,
  type ComplaintStatus,
} from '@/features/complaints/logic';

const rules = { long_standing_after_hours: 48, nudge_eligible_after_hours: 168, nudge_cooldown_hours: 24 };
const NOW = new Date('2026-10-18T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('long-standing badge', () => {
  it('flags unresolved complaints at 48 h, not before', () => {
    expect(isLongStanding({ status: 'open', opened_at: hoursAgo(49) }, rules, NOW)).toBe(true);
    expect(isLongStanding({ status: 'in_progress', opened_at: hoursAgo(48) }, rules, NOW)).toBe(true);
    expect(isLongStanding({ status: 'open', opened_at: hoursAgo(47.9) }, rules, NOW)).toBe(false);
  });

  it('never flags work awaiting the student or resolved', () => {
    expect(isLongStanding({ status: 'awaiting_confirmation', opened_at: hoursAgo(90) }, rules, NOW)).toBe(false);
    expect(isLongStanding({ status: 'resolved', opened_at: hoursAgo(90) }, rules, NOW)).toBe(false);
  });
});

describe('elapsed clock', () => {
  it('reads T+52h 14m', () => {
    expect(elapsedLabel(new Date(NOW.getTime() - (52 * 60 + 14) * 60_000).toISOString(), NOW)).toBe('T+52h 14m');
    expect(elapsedLabel(hoursAgo(0), NOW)).toBe('T+0h 00m');
  });
});

describe('tracker', () => {
  it.each<[ComplaintStatus, number, boolean]>([
    ['open', 1, false],
    ['in_progress', 2, false],
    ['reopened', 2, false],
    ['awaiting_confirmation', 3, false],
    ['resolved', 3, true],
  ])('%s → step %i', (status, step, done) => {
    expect(trackerStep(status)).toEqual({ step, done });
  });
});

describe('nudge button', () => {
  const base = { status: 'in_progress' as ComplaintStatus, last_nudged_at: null };

  it('is hidden until day 7', () => {
    expect(nudgeState({ ...base, created_at: hoursAgo(167) }, rules, NOW)).toEqual({ kind: 'hidden' });
    expect(nudgeState({ ...base, created_at: hoursAgo(168) }, rules, NOW)).toEqual({ kind: 'ready' });
  });

  it('counts down the 24 h cooldown', () => {
    expect(nudgeState({ ...base, created_at: hoursAgo(200), last_nudged_at: hoursAgo(20) }, rules, NOW)).toEqual({
      kind: 'cooldown',
      minutesLeft: 240,
    });
    expect(nudgeState({ ...base, created_at: hoursAgo(200), last_nudged_at: hoursAgo(24) }, rules, NOW)).toEqual({
      kind: 'ready',
    });
  });

  it('is hidden once resolved', () => {
    expect(nudgeState({ ...base, status: 'resolved', created_at: hoursAgo(300) }, rules, NOW)).toEqual({ kind: 'hidden' });
  });
});

describe('actions', () => {
  const labels = (status: ComplaintStatus, who: { isOwner: boolean; isHandler: boolean }) =>
    availableActions(status, who).map((a) => a.label);

  it('handlers move the work forward', () => {
    expect(labels('open', { isOwner: false, isHandler: true })).toEqual(['Reply & start work']);
    expect(labels('reopened', { isOwner: false, isHandler: true })).toEqual(['Reply & start work']);
    expect(labels('in_progress', { isOwner: false, isHandler: true })).toEqual(['Mark fixed', 'Post update']);
    expect(labels('awaiting_confirmation', { isOwner: false, isHandler: true })).toEqual([]);
  });

  it('only the complainant confirms or reopens', () => {
    expect(labels('awaiting_confirmation', { isOwner: true, isHandler: false })).toEqual([
      'Confirm resolved',
      'Still unresolved',
    ]);
    expect(labels('in_progress', { isOwner: true, isHandler: false })).toEqual([]);
    expect(labels('awaiting_confirmation', { isOwner: false, isHandler: false })).toEqual([]);
  });

  it('nobody acts on a resolved complaint', () => {
    expect(labels('resolved', { isOwner: true, isHandler: true })).toEqual([]);
  });
});
