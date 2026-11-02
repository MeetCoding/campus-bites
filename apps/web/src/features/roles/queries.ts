import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

/** Roles an admin hands out on the Roles page (admins have their own page). */
export type OfficeRole = 'mess_secretary' | 'bhawan_secretary' | 'mess_authority' | 'adosw';

/** GET /v1/admin/role-assignments (RoleAssignmentOut). */
export type RoleAssignment = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: OfficeRole | 'admin';
  bhawan_id: string | null;
  bhawan_name: string | null;
  created_at: string;
};

export const roleKeys = { all: ['role-assignments'] as const };

export function useRoleAssignments() {
  return useQuery({
    queryKey: roleKeys.all,
    queryFn: () => api<RoleAssignment[]>('/v1/admin/role-assignments'),
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: OfficeRole; bhawan_id: string | null }) =>
      api<RoleAssignment>('/v1/admin/role-assignments', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/admin/role-assignments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
