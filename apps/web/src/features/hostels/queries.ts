import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { outletKeys } from '@/features/eateries/queries';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type Hostel = { id: string; name: string; slug: string; sort_order: number };

export const hostelKeys = { all: ['bhawans'] as const };

/** Bhawans in official order (read straight from Supabase under RLS). */
export function useHostels() {
  return useQuery({
    queryKey: hostelKeys.all,
    queryFn: async (): Promise<Hostel[]> => {
      const { data, error } = await supabase
        .from('bhawans')
        .select('id, name, slug, sort_order')
        .order('sort_order');
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

// A Bhawan comes and goes with its Mess, Day Canteen and Night Canteen (admin_*_bhawan RPCs), and
// new outlets are auto-assigned to master vendors, so refresh outlets and vendors too.
function useInvalidateHostels() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: hostelKeys.all }),
      queryClient.invalidateQueries({ queryKey: outletKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    ]);
}

export function useCreateHostel() {
  const invalidate = useInvalidateHostels();
  return useMutation({
    mutationFn: (name: string) => api<Hostel>('/v1/admin/bhawans', { method: 'POST', body: { name } }),
    onSuccess: invalidate,
  });
}

export function useRenameHostel() {
  const invalidate = useInvalidateHostels();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<Hostel>(`/v1/admin/bhawans/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: invalidate,
  });
}

export function useDeleteHostel() {
  const invalidate = useInvalidateHostels();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/admin/bhawans/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
