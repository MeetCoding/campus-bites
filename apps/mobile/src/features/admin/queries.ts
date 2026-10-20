import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
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

export type AdminBhawan = Pick<Tables<'bhawans'>, 'id' | 'name' | 'slug' | 'sort_order'>;
export type AdminEatery = Pick<Tables<'outlets'>, 'id' | 'name' | 'slug' | 'location_tag' | 'latitude' | 'longitude'>;

const keys = {
  whitelist: ['admin', 'whitelist'] as const,
  roles: ['admin', 'roles'] as const,
  bhawans: ['admin', 'bhawans'] as const,
  eateries: ['admin', 'eateries'] as const,
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

// ─── Campus master list ──────────────────────────────────────────────────────
// Reads go straight to Supabase; writes go through the API. Bhawans and outlets feed most
// screens (pickers, Mess Hub, canteens, eateries, whitelist), so a change refetches everything.

export function useAdminBhawans() {
  return useQuery({
    queryKey: keys.bhawans,
    queryFn: async (): Promise<AdminBhawan[]> => {
      const { data, error } = await supabase
        .from('bhawans')
        .select('id, name, slug, sort_order')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminEateries() {
  return useQuery({
    queryKey: keys.eateries,
    queryFn: async (): Promise<AdminEatery[]> => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, slug, location_tag, latitude, longitude')
        .eq('type', 'eatery')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

function useCampusMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries() });
}

export function useCreateBhawan() {
  return useCampusMutation((body: { name: string }) =>
    api<AdminBhawan>('/v1/admin/bhawans', { method: 'POST', body }),
  );
}

export function useUpdateBhawan() {
  return useCampusMutation(({ id, ...body }: { id: string; name?: string; sort_order?: number }) =>
    api<AdminBhawan>(`/v1/admin/bhawans/${id}`, { method: 'PATCH', body }),
  );
}

export function useDeleteBhawan() {
  return useCampusMutation((id: string) => api<void>(`/v1/admin/bhawans/${id}`, { method: 'DELETE' }));
}

export function useCreateEatery() {
  return useCampusMutation((body: { name: string; location_tag?: string }) =>
    api<AdminEatery>('/v1/admin/eateries', { method: 'POST', body }),
  );
}

export function useUpdateEatery() {
  return useCampusMutation(
    ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      location_tag?: string | null;
      /** Sent together; both null removes the pin. */
      latitude?: number | null;
      longitude?: number | null;
    }) =>
      api<AdminEatery>(`/v1/admin/eateries/${id}`, { method: 'PATCH', body }),
  );
}

export function useDeleteEatery() {
  return useCampusMutation((id: string) => api<void>(`/v1/admin/eateries/${id}`, { method: 'DELETE' }));
}
