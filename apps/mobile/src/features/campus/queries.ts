import { useQuery } from '@tanstack/react-query';

import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Bhawan = Pick<Tables<'bhawans'>, 'id' | 'name' | 'slug'>;
export type Outlet = Pick<Tables<'outlets'>, 'id' | 'name' | 'type' | 'bhawan_id'>;

export const campusKeys = {
  bhawans: ['bhawans'] as const,
  outlets: ['outlets'] as const,
};

/** All 11 Bhawans in official order (readable by any signed-in user). */
export function useBhawans() {
  return useQuery({
    queryKey: campusKeys.bhawans,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Bhawan[]> => {
      const { data, error } = await supabase
        .from('bhawans')
        .select('id, name, slug')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

/** All outlets (messes, canteens, eateries). */
export function useOutlets() {
  return useQuery({
    queryKey: campusKeys.outlets,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Outlet[]> => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, type, bhawan_id')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}
