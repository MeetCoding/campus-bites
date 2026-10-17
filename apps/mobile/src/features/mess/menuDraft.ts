import type { MealSlot, WeeklyMenuItems } from '@/features/mess/queries';
import { DAY_KEYS, type DayKey } from '@/lib/time';

// Limits mirror app.is_valid_weekly_menu() in supabase/migrations/004_mess.sql.
export const MAX_DISHES_PER_MEAL = 20;
export const MAX_DISH_LENGTH = 80;

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** Editor state: one multiline string ("one dish per line") per day × meal. */
export type MenuDraft = Record<DayKey, Record<MealSlot, string>>;

export function draftFromItems(items: WeeklyMenuItems | undefined): MenuDraft {
  const draft = {} as MenuDraft;
  for (const day of DAY_KEYS) {
    draft[day] = { breakfast: '', lunch: '', dinner: '' };
    for (const slot of SLOTS) {
      draft[day][slot] = (items?.[day]?.[slot] ?? []).join('\n');
    }
  }
  return draft;
}

export type DraftResult = { ok: true; items: WeeklyMenuItems } | { ok: false; error: string };

export function itemsFromDraft(draft: MenuDraft): DraftResult {
  const items: WeeklyMenuItems = {};
  for (const day of DAY_KEYS) {
    for (const slot of SLOTS) {
      const dishes = draft[day][slot]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (dishes.length === 0) continue;
      if (dishes.length > MAX_DISHES_PER_MEAL) {
        return { ok: false, error: `${day.toUpperCase()} ${slot}: at most ${MAX_DISHES_PER_MEAL} dishes.` };
      }
      const tooLong = dishes.find((dish) => dish.length > MAX_DISH_LENGTH);
      if (tooLong) {
        return { ok: false, error: `"${tooLong.slice(0, 20)}…" is longer than ${MAX_DISH_LENGTH} characters.` };
      }
      items[day] = { ...items[day], [slot]: dishes };
    }
  }
  return { ok: true, items };
}
