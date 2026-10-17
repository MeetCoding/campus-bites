// IST helpers mirroring the SQL in supabase/migrations/004_mess.sql (mess_schedule_at).
// Campus Bites runs on Asia/Kolkata (UTC+5:30, no DST), whatever the phone's timezone.

const IST_OFFSET_MINUTES = 330;
const MINUTES_PER_DAY = 24 * 60;

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type IstNow = {
  /** YYYY-MM-DD in IST */
  date: string;
  /** minutes since IST midnight */
  minutes: number;
  dayKey: DayKey;
};

export function istNow(now: Date = new Date()): IstNow {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const date = shifted.toISOString().slice(0, 10);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  // getUTCDay: 0 = Sunday
  const dayKey = DAY_KEYS[(shifted.getUTCDay() + 6) % 7];
  return { date, minutes, dayKey };
}

/** "07:30" or "07:30:00" → 450 */
export function parseTime(value: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Strict "HH:MM" (24 h) validation for form input. */
export function isValidTimeInput(value: string): boolean {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match !== null;
}

/** "19:30:00" → "7:30 PM" */
export function formatTime(value: string): string {
  const total = parseTime(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function formatWindow(opensAt: string, closesAt: string): string {
  return `${formatTime(opensAt)} – ${formatTime(closesAt)}`;
}

/** IST wall-clock time of an instant: "2026-10-19T17:00:00Z" → "10:30 PM". */
export function formatInstant(iso: string): string {
  const { minutes } = istNow(new Date(iso));
  return formatTime(`${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`);
}

/** 45 → "45 min", 125 → "2 h 5 min" */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

// ─── Dates (YYYY-MM-DD strings, calendar arithmetic in UTC to avoid DST/offset drift) ─────
function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayKeyOf(date: string): DayKey {
  return DAY_KEYS[(toUtcDate(date).getUTCDay() + 6) % 7];
}

/** Monday of the week containing `date` (weekly menus are keyed by it). */
export function weekStart(date: string): string {
  return addDays(date, -DAY_KEYS.indexOf(dayKeyOf(date)));
}

export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = toUtcDate(value);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Mirrors format_dates() in apps/api/app/services/timings.py. */
export function formatDateRange(start: string, end: string): string {
  const s = toUtcDate(start);
  const e = toUtcDate(end);
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) => MONTHS[d.getUTCMonth()];
  if (start === end) return `${DAY_LABEL[dayKeyOf(start)]} ${day(s)} ${month(s)}`;
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${day(s)}–${day(e)} ${month(e)}`;
  }
  return `${day(s)} ${month(s)} – ${day(e)} ${month(e)}`;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

// ─── Meal status ─────────────────────────────────────────────────────────────
export type SlotStatus = 'upcoming' | 'serving' | 'done' | 'closed';

export type MealWindow = {
  slot: 'breakfast' | 'lunch' | 'dinner';
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

/** Same rule as SQL: closed wins; window is [opens_at, closes_at). Meals never cross midnight. */
export function slotStatus(window: MealWindow, nowMinutes: number): SlotStatus {
  if (window.is_closed) return 'closed';
  if (nowMinutes < parseTime(window.opens_at)) return 'upcoming';
  if (nowMinutes < parseTime(window.closes_at)) return 'serving';
  return 'done';
}

export type MealNow<T extends MealWindow> = {
  serving: T | null;
  next: T | null;
  /** minutes until `serving` closes, or until `next` opens */
  minutesLeft: number | null;
};

export function currentMeal<T extends MealWindow>(windows: T[], nowMinutes: number): MealNow<T> {
  const ordered = [...windows].sort((a, b) => parseTime(a.opens_at) - parseTime(b.opens_at));
  const serving = ordered.find((w) => slotStatus(w, nowMinutes) === 'serving') ?? null;
  if (serving) {
    return { serving, next: null, minutesLeft: parseTime(serving.closes_at) - nowMinutes };
  }
  const next = ordered.find((w) => slotStatus(w, nowMinutes) === 'upcoming') ?? null;
  return {
    serving: null,
    next,
    minutesLeft: next ? (parseTime(next.opens_at) - nowMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY : null,
  };
}

// ─── Override date presets (mess timings + canteen shift changes) ────────────
export type DatePreset = 'today' | 'tomorrow' | 'weekend' | 'custom';

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'This weekend',
  custom: 'Custom dates',
};

export function presetRange(preset: Exclude<DatePreset, 'custom'>, today: string): [string, string] {
  if (preset === 'today') return [today, today];
  if (preset === 'tomorrow') return [addDays(today, 1), addDays(today, 1)];
  // The coming (or current) Saturday–Sunday.
  const dayIndex = DAY_KEYS.indexOf(dayKeyOf(today)); // 0 = Monday … 6 = Sunday
  const saturday = dayIndex === 6 ? addDays(today, -1) : addDays(today, 5 - dayIndex);
  return [dayIndex === 6 ? today : saturday, addDays(saturday, 1)];
}
