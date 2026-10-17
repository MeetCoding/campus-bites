import type { Href } from 'expo-router';

import type { AppRole } from '@/lib/jwt';

/** A "mode" is one of the app's role groups; multi-role users switch between them. */
export type Mode = 'student' | 'staff' | 'authority' | 'admin';

const MODE_BY_ROLE: Record<AppRole, Mode> = {
  student: 'student',
  vendor: 'staff',
  mess_secretary: 'staff',
  bhawan_secretary: 'staff',
  mess_authority: 'authority',
  adosw: 'authority',
  admin: 'admin',
};

const MODE_ORDER: Mode[] = ['student', 'staff', 'authority', 'admin'];

export const MODE_LABEL: Record<Mode, string> = {
  student: 'Student',
  staff: 'Staff console',
  authority: 'Authority',
  admin: 'Admin',
};

export const MODE_HOME: Record<Mode, Href> = {
  student: '/home',
  staff: '/console',
  authority: '/review',
  admin: '/admin',
};

export const ROLE_LABEL: Record<AppRole, string> = {
  student: 'Student',
  vendor: 'Vendor',
  mess_secretary: 'Mess Secretary',
  bhawan_secretary: 'Bhawan & Maintenance Secretary',
  mess_authority: 'Mess Authority',
  adosw: 'ADoSW',
  admin: 'Admin',
};

export function modesFor(roles: AppRole[]): Mode[] {
  const modes = new Set(roles.map((role) => MODE_BY_ROLE[role]));
  return MODE_ORDER.filter((mode) => modes.has(mode));
}

export function defaultMode(appRole: AppRole | null, modes: Mode[]): Mode | null {
  if (appRole && modes.includes(MODE_BY_ROLE[appRole])) {
    return MODE_BY_ROLE[appRole];
  }
  return modes[0] ?? null;
}
