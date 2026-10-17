import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOutlets } from '@/features/campus/queries';
import { api } from '@/lib/api';
import type { Enums, Json, Tables, TablesInsert } from '@/lib/database.types';
import { uploadMenuPhoto } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import { istNow, type DayKey } from '@/lib/time';

export type MealSlot = Enums<'meal_slot'>;
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
export const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export type ScheduleRow = {
  slot: MealSlot;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  override_reason: string | null;
  service_date: string;
};
export type TimingOverride = Tables<'timing_overrides'>;
export type MenuPhoto = Tables<'menu_photos'>;
export type ExtraItem = Tables<'extra_items'>;
/** weekly_menus.items: { mon: { breakfast: ['Poha', 'Tea'], … }, … } (validated in SQL) */
export type WeeklyMenuItems = Partial<Record<DayKey, Partial<Record<MealSlot, string[]>>>>;

export const messKeys = {
  all: ['mess'] as const,
  schedule: (bhawanId: string) => ['mess', 'schedule', bhawanId] as const,
  overrides: (outletId: string) => ['mess', 'overrides', outletId] as const,
  photo: (outletId: string) => ['mess', 'photo', outletId] as const,
  photoReports: (photoId: string) => ['mess', 'photo-reports', photoId] as const,
  menu: (bhawanId: string, weekStart: string) => ['mess', 'menu', bhawanId, weekStart] as const,
  extras: (bhawanId: string) => ['mess', 'extras', bhawanId] as const,
  secretaryBhawans: ['mess', 'secretary-bhawans'] as const,
};

/** The mess outlet of a Bhawan (from the cached outlet list). */
export function useMessOutlet(bhawanId: string | null | undefined) {
  const outlets = useOutlets();
  return outlets.data?.find((o) => o.type === 'mess' && o.bhawan_id === bhawanId) ?? null;
}

/** Today's effective meal windows (defaults + overrides, computed in SQL in IST). */
export function useMessSchedule(bhawanId: string | null | undefined) {
  return useQuery({
    queryKey: messKeys.schedule(bhawanId ?? ''),
    enabled: !!bhawanId,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async (): Promise<ScheduleRow[]> => {
      const { data, error } = await supabase
        .from('mess_schedule_today')
        .select('slot, opens_at, closes_at, is_closed, override_reason, service_date')
        .eq('bhawan_id', bhawanId!);
      if (error) throw error;
      // View columns are typed nullable; the function never returns nulls for these.
      return data as ScheduleRow[];
    },
  });
}

/** Active overrides that haven't ended yet (for the banner and the secretary console). */
export function useActiveOverrides(outletId: string | null | undefined) {
  return useQuery({
    queryKey: messKeys.overrides(outletId ?? ''),
    enabled: !!outletId,
    queryFn: async (): Promise<TimingOverride[]> => {
      const { data, error } = await supabase
        .from('timing_overrides')
        .select('*')
        .eq('outlet_id', outletId!)
        .is('revoked_at', null)
        .gte('ends_on', istNow().date)
        .order('starts_on')
        .order('slot');
      if (error) throw error;
      return data;
    },
  });
}

export function useCurrentPhoto(outletId: string | null | undefined) {
  return useQuery({
    queryKey: messKeys.photo(outletId ?? ''),
    enabled: !!outletId,
    queryFn: async (): Promise<MenuPhoto | null> => {
      const { data, error } = await supabase
        .from('menu_photos')
        .select('*')
        .eq('outlet_id', outletId!)
        .eq('is_current', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Reports on a photo. Students see only their own; outlet managers see all (RLS). */
export function usePhotoReports(photoId: string | null | undefined) {
  return useQuery({
    queryKey: messKeys.photoReports(photoId ?? ''),
    enabled: !!photoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photo_reports')
        .select('id, reason, reported_by, created_at')
        .eq('photo_id', photoId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useReportPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { photoId: string; reason: 'outdated' | 'blurry' | 'other' }) => {
      const { error } = await supabase
        .from('photo_reports')
        .insert({ photo_id: params.photoId, reason: params.reason });
      if (error) {
        // 23505 = already reported by this student
        if (error.code === '23505') return;
        throw error;
      }
    },
    onSuccess: (_data, { photoId }) =>
      queryClient.invalidateQueries({ queryKey: messKeys.photoReports(photoId) }),
  });
}

export function useWeeklyMenu(bhawanId: string | null | undefined, weekStart: string) {
  return useQuery({
    queryKey: messKeys.menu(bhawanId ?? '', weekStart),
    enabled: !!bhawanId,
    queryFn: async (): Promise<{ items: WeeklyMenuItems; updated_at: string } | null> => {
      const { data, error } = await supabase
        .from('weekly_menus')
        .select('items, updated_at')
        .eq('bhawan_id', bhawanId!)
        .eq('week_start', weekStart)
        .maybeSingle();
      if (error) throw error;
      return data ? { items: data.items as WeeklyMenuItems, updated_at: data.updated_at } : null;
    },
  });
}

export function useExtraItems(bhawanId: string | null | undefined) {
  return useQuery({
    queryKey: messKeys.extras(bhawanId ?? ''),
    enabled: !!bhawanId,
    queryFn: async (): Promise<ExtraItem[]> => {
      const { data, error } = await supabase
        .from('extra_items')
        .select('*')
        .eq('bhawan_id', bhawanId!)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

// ─── Mess Secretary ──────────────────────────────────────────────────────────

/** Bhawans where the signed-in user is Mess Secretary (live from role_assignments). */
export function useSecretaryBhawans() {
  return useQuery({
    queryKey: messKeys.secretaryBhawans,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_assignments')
        .select('bhawan_id, bhawans(name)')
        .eq('role', 'mess_secretary');
      if (error) throw error;
      return data
        .filter((row): row is typeof row & { bhawan_id: string } => row.bhawan_id !== null)
        .map((row) => ({ id: row.bhawan_id, name: row.bhawans?.name ?? 'Bhawan' }));
    },
  });
}

export function useSaveWeeklyMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { bhawanId: string; weekStart: string; items: WeeklyMenuItems }) => {
      const { error } = await supabase
        .from('weekly_menus')
        .upsert(
          { bhawan_id: params.bhawanId, week_start: params.weekStart, items: params.items as Json },
          { onConflict: 'bhawan_id,week_start' },
        );
      if (error) throw error;
    },
    onSuccess: (_data, { bhawanId, weekStart }) =>
      queryClient.invalidateQueries({ queryKey: messKeys.menu(bhawanId, weekStart) }),
  });
}

export function useSaveExtraItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: TablesInsert<'extra_items'> & { id?: string }) => {
      const { error } = item.id
        ? await supabase.from('extra_items').update(item).eq('id', item.id)
        : await supabase.from('extra_items').insert(item);
      if (error) {
        if (error.code === '23505') throw new Error('An item with this name already exists.');
        throw error;
      }
    },
    onSuccess: (_data, item) =>
      queryClient.invalidateQueries({ queryKey: messKeys.extras(item.bhawan_id) }),
  });
}

export function useDeleteExtraItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: { id: string; bhawan_id: string }) => {
      const { error } = await supabase.from('extra_items').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: (_data, item) =>
      queryClient.invalidateQueries({ queryKey: messKeys.extras(item.bhawan_id) }),
  });
}

export function useUploadMenuPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadMenuPhoto,
    onSuccess: (_data, { outletId }) =>
      queryClient.invalidateQueries({ queryKey: messKeys.photo(outletId) }),
  });
}

export type OverrideInput = {
  slot: MealSlot | null;
  starts_on: string;
  ends_on: string;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  reason: string;
  notify?: boolean;
};

/** FastAPI: validates and broadcasts the change to residents (ARCHITECTURE.md §5.6). */
export function useCreateOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { outletId: string; body: OverrideInput }) =>
      api<TimingOverride & { notified: boolean }>(`/v1/outlets/${params.outletId}/timing-overrides`, {
        method: 'POST',
        body: params.body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messKeys.all }),
  });
}

export function useRevokeOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (overrideId: string) =>
      api<void>(`/v1/timing-overrides/${overrideId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messKeys.all }),
  });
}
