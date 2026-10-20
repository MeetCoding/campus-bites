import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

/** GET /v1/admin/admins (AdminOut). `invited` = listed, but hasn't signed in yet. */
export type AdminRow = {
  email: string;
  full_name: string | null;
  status: 'active' | 'invited';
  is_owner: boolean;
  created_at: string;
};

export const adminKeys = { all: ['admins'] as const };

export function useAdmins() {
  return useQuery({ queryKey: adminKeys.all, queryFn: () => api<AdminRow[]>('/v1/admin/admins') });
}

export function useAddAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api<AdminRow>('/v1/admin/admins', { method: 'POST', body: { email } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useRemoveAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      api<void>(`/v1/admin/admins/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}
