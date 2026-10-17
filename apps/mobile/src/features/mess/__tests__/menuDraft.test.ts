import { describe, expect, it } from '@jest/globals';

import { draftFromItems, itemsFromDraft } from '@/features/mess/menuDraft';

describe('weekly menu draft', () => {
  it('round-trips items through the editor format', () => {
    const items = { mon: { breakfast: ['Poha', 'Tea'], dinner: ['Dal', 'Rice'] } };
    const draft = draftFromItems(items);

    expect(draft.mon.breakfast).toBe('Poha\nTea');
    expect(draft.tue.lunch).toBe('');
    expect(itemsFromDraft(draft)).toEqual({ ok: true, items });
  });

  it('trims lines and drops empty meals and days', () => {
    const draft = draftFromItems(undefined);
    draft.wed.lunch = '  Rajma \n\n Rice  \n';

    expect(itemsFromDraft(draft)).toEqual({ ok: true, items: { wed: { lunch: ['Rajma', 'Rice'] } } });
  });

  it('enforces the same limits as the database', () => {
    const tooMany = draftFromItems(undefined);
    tooMany.fri.dinner = Array.from({ length: 21 }, (_, i) => `Dish ${i}`).join('\n');
    expect(itemsFromDraft(tooMany).ok).toBe(false);

    const tooLong = draftFromItems(undefined);
    tooLong.sat.breakfast = 'x'.repeat(81);
    expect(itemsFromDraft(tooLong).ok).toBe(false);
  });
});
