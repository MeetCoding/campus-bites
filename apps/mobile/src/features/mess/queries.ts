import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import { useBhawans, useOutlets } from '@/features/campus/queries';
import { canteenKeys } from '@/features/canteens/queries';
import { api } from '@/lib/api';
import type { Enums, Tables } from '@/lib/database.types';
import { deleteMenuPhoto, uploadMenuPhoto } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import { istNow } from '@/lib/time';

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
/** menu = menu / noticeboard photos (every outlet); extras = a mess's pay-to-get price list (020). */
export type PhotoKind = 'menu' | 'extras';

export const messKeys = {
  all: ['mess'] as const,
  schedule: (bhawanId: string) => ['mess', 'schedule', bhawanId] as const,
  overrides: (outletId: string) => ['mess', 'overrides', outletId] as const,
  photos: (outletId: string, kind?: PhotoKind) =>
    kind ? (['mess', 'photos', outletId, kind] as const) : (['mess', 'photos', outletId] as const),
  photoLimit: ['mess', 'photo-limit'] as const,
  photoReports: (photoId: string) => ['mess', 'photo-reports', photoId] as const,
  secretaryBhawans: (role: SecretaryRole) => ['mess', 'secretary-bhawans', role] as const,
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

/** The outlet's published photo stack, newest first. */
export function useMenuPhotos(outletId: string | null | undefined, kind: PhotoKind = 'menu') {
  return useQuery({
    queryKey: messKeys.photos(outletId ?? '', kind),
    enabled: !!outletId,
    queryFn: async (): Promise<MenuPhoto[]> => {
      const { data, error } = await supabase
        .from('menu_photos')
        .select('*')
        .eq('outlet_id', outletId!)
        .eq('kind', kind)
        .eq('is_current', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** app_settings.max_menu_photos (never hard-coded): uploads beyond it are refused by the DB. */
export function useMenuPhotoLimit() {
  return useQuery({
    queryKey: messKeys.photoLimit,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from('app_settings').select('max_menu_photos').single();
      if (error) throw error;
      return data.max_menu_photos;
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

// ─── Mess Secretary ──────────────────────────────────────────────────────────

export type SecretaryRole = 'mess_secretary' | 'bhawan_secretary';

/** Bhawans where the signed-in user holds `role` (live from role_assignments, not the JWT). */
export function useSecretaryBhawans(role: SecretaryRole = 'mess_secretary') {
  return useQuery({
    queryKey: messKeys.secretaryBhawans(role),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_assignments')
        .select('bhawan_id, bhawans(name)')
        .eq('role', role);
      if (error) throw error;
      return data
        .filter((row): row is typeof row & { bhawan_id: string } => row.bhawan_id !== null)
        .map((row) => ({ id: row.bhawan_id, name: row.bhawans?.name ?? 'Bhawan' }));
    },
  });
}

/**
 * Bhawans whose mess the user publishes for (noticeboard photos, weekly menu, extra items): as
 * Mess Secretary (live) or as a vendor whitelisted for that mess (JWT outlet_ids, e.g. a master
 * vendor). Mirrors app.can_manage_mess(); RLS is the real check. Timing overrides stay
 * secretary-only (useSecretaryBhawans).
 */
export function useMessManagerBhawans() {
  const { claims } = useSession();
  const secretary = useSecretaryBhawans('mess_secretary');
  const outlets = useOutlets();
  const bhawans = useBhawans();

  const vendorBhawanIds = new Set(
    (outlets.data ?? [])
      .filter((o) => o.type === 'mess' && o.bhawan_id !== null && claims?.outlet_ids.includes(o.id))
      .map((o) => o.bhawan_id as string),
  );
  const secretaryIds = new Set((secretary.data ?? []).map((b) => b.id));
  const data =
    secretary.data && bhawans.data
      ? bhawans.data
          .filter((b) => secretaryIds.has(b.id) || vendorBhawanIds.has(b.id))
          .map((b) => ({ id: b.id, name: b.name }))
      : undefined;

  return {
    data,
    isPending: secretary.isPending || outlets.isPending || bhawans.isPending,
    error: secretary.error ?? outlets.error ?? bhawans.error,
  };
}

export function useUploadMenuPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadMenuPhoto,
    onSuccess: (_data, { outletId }) =>
      queryClient.invalidateQueries({ queryKey: messKeys.photos(outletId) }),
  });
}

export function useDeleteMenuPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMenuPhoto,
    onSuccess: (_data, photo) =>
      queryClient.invalidateQueries({ queryKey: messKeys.photos(photo.outlet_id) }),
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

/** FastAPI: validates and broadcasts the change to residents (ARCHITECTURE.md §6.1). Also used
 * for canteen/eatery shift changes (slot null, optional `notify`). */
export function useCreateOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { outletId: string; body: OverrideInput }) =>
      api<TimingOverride & { notified: boolean }>(`/v1/outlets/${params.outletId}/timing-overrides`, {
        method: 'POST',
        body: params.body,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: messKeys.all }),
        queryClient.invalidateQueries({ queryKey: canteenKeys.all }),
      ]),
  });
}

export function useRevokeOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (overrideId: string) =>
      api<void>(`/v1/timing-overrides/${overrideId}`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: messKeys.all }),
        queryClient.invalidateQueries({ queryKey: canteenKeys.all }),
      ]),
  });
}
