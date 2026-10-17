import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AppRole } from '@/lib/jwt';

// Mirrors apps/api/app/schemas/admin.py
export type WhitelistEntry = {
  id: string;
  phone_e164: string;
  outlet_id: string;
  outlet_name: string | null;
  label: string | null;
  active: boolean;
  created_at: string;
};

export type AssignableRole = Exclude<AppRole, 'student' | 'vendor'>;

export type RoleAssignment = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  bhawan_id: string | null;
  bhawan_name: string | null;
  created_at: string;
};

export const BHAWAN_SCOPED_ROLES: readonly AssignableRole[] = [
  'mess_secretary',
  'bhawan_secretary',
  'mess_authority',
];

const keys = {
  whitelist: ['admin', 'whitelist'] as const,
  roles: ['admin', 'roles'] as const,
};

export function useWhitelist() {
  return useQuery({
    queryKey: keys.whitelist,
    queryFn: () => api<WhitelistEntry[]>('/v1/admin/vendor-whitelist'),
  });
}

export function useAddWhitelist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { phone: string; outlet_id: string; label?: string }) =>
      api<WhitelistEntry>('/v1/admin/vendor-whitelist', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.whitelist }),
  });
}

export function useRemoveWhitelist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/admin/vendor-whitelist/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.whitelist }),
  });
}

export function useRoleAssignments() {
  return useQuery({
    queryKey: keys.roles,
    queryFn: () => api<RoleAssignment[]>('/v1/admin/role-assignments'),
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: AssignableRole; bhawan_id?: string }) =>
      api<RoleAssignment>('/v1/admin/role-assignments', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.roles }),
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/admin/role-assignments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.roles }),
  });
}
