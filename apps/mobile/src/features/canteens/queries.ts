import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import { campusKeys } from '@/features/campus/queries';
import type { Enums, Tables, TablesInsert } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type OutletType = Enums<'outlet_type'>;
export type FixedRateItem = Tables<'fixed_rate_items'>;
export type OutletShift = Tables<'outlet_shifts'>;

/** A row of the outlet_live_status view (canteens + eateries, computed in IST by SQL). */
export type OutletStatus = {
  outlet_id: string;
  type: OutletType;
  bhawan_id: string | null;
  name: string;
  location_tag: string | null;
  is_open: boolean;
  source: 'schedule' | 'manual' | 'none';
  closes_at: string | null;
  next_opens_at: string | null;
  shift_starts_at: string | null;
  shift_ends_at: string | null;
  status_updated_at: string | null;
  /** Map pin (016); both null when unset. */
  latitude: number | null;
  longitude: number | null;
};

export type SearchHit = {
  outlet_id: string;
  outlet_name: string;
  outlet_type: OutletType;
  bhawan_id: string | null;
  location_tag: string | null;
  score: number;
};

export const OUTLET_TYPE_LABEL: Record<OutletType, string> = {
  mess: 'Mess',
  day_canteen: 'Day canteen',
  night_canteen: 'Night canteen',
  eatery: 'Campus eatery',
};

export const canteenKeys = {
  all: ['canteens'] as const,
  status: ['canteens', 'status'] as const,
  shift: (outletId: string) => ['canteens', 'shift', outletId] as const,
  rates: (bhawanId: string) => ['canteens', 'rates', bhawanId] as const,
  search: (query: string) => ['canteens', 'search', query] as const,
};

/** Live status of every canteen and eatery (26 rows): one cheap query shared by all screens. */
export function useLiveStatus() {
  return useQuery({
    queryKey: canteenKeys.status,
    // Shift boundaries pass with time even when nothing changes in the database.
    refetchInterval: 60_000,
    queryFn: async (): Promise<OutletStatus[]> => {
      const { data, error } = await supabase.from('outlet_live_status').select('*').order('name');
      if (error) throw error;
      // View columns are typed nullable; outlet_status_at always returns these.
      return data as OutletStatus[];
    },
  });
}

export function useOutletStatus(outletId: string | null | undefined) {
  const status = useLiveStatus();
  return { ...status, data: status.data?.find((s) => s.outlet_id === outletId) ?? null };
}

export function useOutletShift(outletId: string | null | undefined) {
  return useQuery({
    queryKey: canteenKeys.shift(outletId ?? ''),
    enabled: !!outletId,
    queryFn: async (): Promise<OutletShift | null> => {
      const { data, error } = await supabase
        .from('outlet_shifts')
        .select('*')
        .eq('outlet_id', outletId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useFixedRates(bhawanId: string | null | undefined) {
  return useQuery({
    queryKey: canteenKeys.rates(bhawanId ?? ''),
    enabled: !!bhawanId,
    queryFn: async (): Promise<FixedRateItem[]> => {
      const { data, error } = await supabase
        .from('fixed_rate_items')
        .select('*')
        .eq('bhawan_id', bhawanId!)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** pg_trgm search across canteen and eatery names (public.search_food); menus are photos. */
export function useFoodSearch(query: string) {
  const term = query.trim();
  return useQuery({
    queryKey: canteenKeys.search(term.toLowerCase()),
    enabled: term.length >= 2,
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<SearchHit[]> => {
      const { data, error } = await supabase.rpc('search_food', { p_query: term });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Realtime (M4.6): a vendor's toggle or shift edit invalidates the cached queries on every
 * other device. Subscriptions only invalidate; TanStack Query holds the state.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const id = useId();
  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: canteenKeys.all });
    const channel = supabase
      .channel(`outlets-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlets' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlet_shifts' }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);
}

// ─── Vendor / Bhawan Secretary writes (RLS: app.can_run_outlet) ───────────────

/** Open/closed toggle. It holds until the next scheduled shift start or end (SQL). */
export function useSetOpen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { outletId: string; isOpen: boolean }) => {
      const { data, error } = await supabase
        .from('outlets')
        // status_updated_at is pinned to now() by a trigger; sending it makes a re-assertion count.
        .update({ is_open: params.isOpen, status_updated_at: new Date().toISOString() })
        .eq('id', params.outletId)
        .select('id');
      if (error) throw error;
      if (data.length === 0) throw new Error("You don't manage this outlet.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: canteenKeys.status }),
  });
}

export function useSetLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { outletId: string; locationTag: string | null }) => {
      const { error } = await supabase
        .from('outlets')
        .update({ location_tag: params.locationTag })
        .eq('id', params.outletId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: canteenKeys.status }),
        queryClient.invalidateQueries({ queryKey: campusKeys.outlets }),
      ]),
  });
}

/** Map pin (016): column grant + RLS app.can_run_outlet. null removes the pin. */
export function useSetPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { outletId: string; pin: { latitude: number; longitude: number } | null }) => {
      const { data, error } = await supabase
        .from('outlets')
        .update({ latitude: params.pin?.latitude ?? null, longitude: params.pin?.longitude ?? null })
        .eq('id', params.outletId)
        .select('id');
      if (error) throw error;
      // RLS hides outlets you don't run from UPDATE instead of erroring.
      if (data.length === 0) throw new Error("You can't change this outlet's location.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: canteenKeys.status }),
  });
}

export function useSaveShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shift: {
      outlet_id: string;
      opens_at: string;
      closes_at: string;
      /** Saturday/Sunday hours (020); both null = same as weekdays. */
      weekend_opens_at: string | null;
      weekend_closes_at: string | null;
    }) => {
      const { error } = await supabase.from('outlet_shifts').upsert(shift, { onConflict: 'outlet_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: canteenKeys.all }),
  });
}

export function useSaveFixedRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: TablesInsert<'fixed_rate_items'> & { id?: string }) => {
      const { error } = item.id
        ? await supabase.from('fixed_rate_items').update(item).eq('id', item.id)
        : await supabase.from('fixed_rate_items').insert(item);
      if (error) {
        if (error.code === '23505') throw new Error('This item is already on the rate card.');
        throw error;
      }
    },
    onSuccess: (_data, item) => queryClient.invalidateQueries({ queryKey: canteenKeys.rates(item.bhawan_id) }),
  });
}

export function useDeleteFixedRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: { id: string; bhawan_id: string }) => {
      const { error } = await supabase.from('fixed_rate_items').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: (_data, item) => queryClient.invalidateQueries({ queryKey: canteenKeys.rates(item.bhawan_id) }),
  });
}
