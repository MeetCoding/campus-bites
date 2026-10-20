import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type OutletType = 'mess' | 'day_canteen' | 'night_canteen' | 'eatery';

export type Outlet = {
  id: string;
  name: string;
  type: OutletType;
  location_tag: string | null;
};

export const outletKeys = { all: ['outlets'] as const };

/** Every outlet (read straight from Supabase under RLS); eateries and canteens alike. */
export function useOutlets() {
  return useQuery({
    queryKey: outletKeys.all,
    queryFn: async (): Promise<Outlet[]> => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, type, location_tag')
        .order('name');
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export type EateryInput = { name: string; location_tag: string | null };

function useInvalidateOutlets() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: outletKeys.all }),
      // Deleting an eatery cascades its vendor links.
      queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    ]);
}

export function useCreateEatery() {
  const invalidate = useInvalidateOutlets();
  return useMutation({
    mutationFn: (body: EateryInput) => api<Outlet>('/v1/admin/eateries', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateEatery() {
  const invalidate = useInvalidateOutlets();
  return useMutation({
    mutationFn: ({ id, ...body }: EateryInput & { id: string }) =>
      api<Outlet>(`/v1/admin/eateries/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteEatery() {
  const invalidate = useInvalidateOutlets();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/admin/eateries/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
