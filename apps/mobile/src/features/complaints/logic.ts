import type { Enums } from '@/lib/database.types';

export type ComplaintStatus = Enums<'complaint_status'>;
export type ComplaintCategory = Enums<'complaint_category'>;
export type ComplaintDomain = Enums<'complaint_domain'>;

/** app_settings thresholds (never hard-coded). */
export type ComplaintRules = {
  long_standing_after_hours: number;
  nudge_eligible_after_hours: number;
  nudge_cooldown_hours: number;
};

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  awaiting_confirmation: 'Awaiting your confirmation',
  resolved: 'Resolved',
  reopened: 'Reopened',
};

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  hygiene: 'Hygiene',
  seating: 'Seating',
  lighting: 'Lighting',
  food_quality: 'Food quality',
  overcharging: 'Overcharging',
  other: 'Other',
};

export const DOMAIN_LABEL: Record<ComplaintDomain, string> = {
  mess: 'Mess',
  hostel_canteen: 'Hostel canteen',
  campus_eatery: 'Campus eatery',
};

/** Who a complaint is routed to (PRD §3D.1). */
export const HANDLER_LABEL: Record<ComplaintDomain, string> = {
  mess: 'Mess Secretary',
  hostel_canteen: 'Bhawan Secretary',
  campus_eatery: 'ADoSW',
};

const HOUR = 3_600_000;

type Clocked = { status: ComplaintStatus; opened_at: string };

/** Same rule as the complaint_board SQL: unresolved work older than the threshold. */
export function isLongStanding(c: Clocked, rules: ComplaintRules, now: Date): boolean {
  return (
    (c.status === 'open' || c.status === 'in_progress' || c.status === 'reopened') &&
    now.getTime() - Date.parse(c.opened_at) >= rules.long_standing_after_hours * HOUR
  );
}

/** "T+52h 14m" since the clock started (opened_at; restarts on reopen). */
export function elapsedLabel(openedAt: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(openedAt)) / 60_000));
  return `T+${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** 3-step tracker: 1 Raised → 2 In work → 3 Student sign-off. */
export function trackerStep(status: ComplaintStatus): { step: 1 | 2 | 3; done: boolean } {
  switch (status) {
    case 'open':
      return { step: 1, done: false };
    case 'in_progress':
    case 'reopened':
      return { step: 2, done: false };
    case 'awaiting_confirmation':
      return { step: 3, done: false };
    case 'resolved':
      return { step: 3, done: true };
  }
}

export type NudgeState =
  | { kind: 'hidden' }
  | { kind: 'ready' }
  | { kind: 'cooldown'; minutesLeft: number };

type Nudgeable = { status: ComplaintStatus; created_at: string; last_nudged_at: string | null };

/** The Nudge button is hidden until N hours after raising, then rate-limited (API re-checks). */
export function nudgeState(c: Nudgeable, rules: ComplaintRules, now: Date): NudgeState {
  if (c.status === 'resolved') return { kind: 'hidden' };
  if (now.getTime() - Date.parse(c.created_at) < rules.nudge_eligible_after_hours * HOUR) {
    return { kind: 'hidden' };
  }
  if (c.last_nudged_at) {
    const next = Date.parse(c.last_nudged_at) + rules.nudge_cooldown_hours * HOUR;
    if (now.getTime() < next) return { kind: 'cooldown', minutesLeft: Math.ceil((next - now.getTime()) / 60_000) };
  }
  return { kind: 'ready' };
}

export type ComplaintAction = {
  to: ComplaintStatus;
  label: string;
  /** a reply is required (handler starting work) */
  needsMessage: boolean;
  primary: boolean;
};

/** Buttons to show; mirrors HANDLER_/STUDENT_TRANSITIONS in apps/api/app/services/complaints.py. */
export function availableActions(
  status: ComplaintStatus,
  { isOwner, isHandler }: { isOwner: boolean; isHandler: boolean },
): ComplaintAction[] {
  const actions: ComplaintAction[] = [];
  if (isHandler) {
    if (status === 'open' || status === 'reopened') {
      actions.push({ to: 'in_progress', label: 'Reply & start work', needsMessage: true, primary: true });
    }
    if (status === 'in_progress') {
      actions.push({ to: 'awaiting_confirmation', label: 'Mark fixed', needsMessage: false, primary: true });
      actions.push({ to: 'in_progress', label: 'Post update', needsMessage: true, primary: false });
    }
  }
  if (isOwner && status === 'awaiting_confirmation') {
    actions.push({ to: 'resolved', label: 'Confirm resolved', needsMessage: false, primary: true });
    actions.push({ to: 'reopened', label: 'Still unresolved', needsMessage: false, primary: false });
  }
  return actions;
}
