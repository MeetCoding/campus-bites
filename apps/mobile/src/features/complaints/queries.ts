import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import type { ComplaintCategory, ComplaintDomain, ComplaintRules, ComplaintStatus } from '@/features/complaints/logic';
import { useSecretaryBhawans } from '@/features/mess/queries';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';
import type { Database, Tables, TablesInsert } from '@/lib/database.types';
import { ATTACHMENT_COMPRESSION, compressForUpload, type PickedImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import { istNow } from '@/lib/time';

export type ComplaintEvent = Tables<'complaint_events'>;
export type Complaint = Tables<'complaints'> & {
  complaint_events: ComplaintEvent[];
  outlets: { name: string } | null;
};
export type BoardRow = Database['public']['Functions']['complaint_board']['Returns'][number];

export const COMPLAINT_BUCKET = 'complaint-attachments';
export const MAX_PHOTOS = 2;

export const complaintKeys = {
  all: ['complaints'] as const,
  rules: ['complaints', 'rules'] as const,
  mine: ['complaints', 'mine'] as const,
  visible: ['complaints', 'visible'] as const,
  board: (bhawanId: string | null, domain: ComplaintDomain | null) =>
    ['complaints', 'board', bhawanId ?? 'all', domain ?? 'all'] as const,
  detail: (id: string) => ['complaints', 'detail', id] as const,
  attachment: (path: string) => ['complaints', 'attachment', path] as const,
};

const WITH_DETAIL = '*, complaint_events(*), outlets(name)';

function sortEvents(c: Complaint): Complaint {
  return { ...c, complaint_events: [...c.complaint_events].sort((a, b) => a.created_at.localeCompare(b.created_at)) };
}

export function useComplaintRules() {
  return useQuery({
    queryKey: complaintKeys.rules,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<ComplaintRules> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('long_standing_after_hours, nudge_eligible_after_hours, nudge_cooldown_hours')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useMyComplaints(userId: string | null | undefined) {
  return useQuery({
    queryKey: complaintKeys.mine,
    enabled: !!userId,
    queryFn: async (): Promise<Complaint[]> => {
      const { data, error } = await supabase
        .from('complaints')
        .select(WITH_DETAIL)
        .eq('created_by', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(sortEvents);
    },
  });
}

/** Everything RLS lets the caller see: handler queues, Warden office, ADoSW oversight. */
export function useVisibleComplaints() {
  return useQuery({
    queryKey: complaintKeys.visible,
    queryFn: async (): Promise<Complaint[]> => {
      const { data, error } = await supabase
        .from('complaints')
        .select(WITH_DETAIL)
        .order('opened_at', { ascending: true })
        .limit(300);
      if (error) throw error;
      return data.map(sortEvents);
    },
  });
}

export function useComplaint(id: string | null | undefined) {
  return useQuery({
    queryKey: complaintKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Complaint | null> => {
      const { data, error } = await supabase.from('complaints').select(WITH_DETAIL).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data ? sortEvents(data) : null;
    },
  });
}

/** Anonymised public issue board (long-standing pinned first; computed in SQL). */
export function useComplaintBoard(bhawanId: string | null, domain: ComplaintDomain | null) {
  return useQuery({
    queryKey: complaintKeys.board(bhawanId, domain),
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await supabase.rpc('complaint_board', {
        ...(bhawanId ? { p_bhawan: bhawanId } : {}),
        ...(domain ? { p_domain: domain } : {}),
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useAttachmentUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: complaintKeys.attachment(path ?? ''),
    enabled: !!path,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(COMPLAINT_BUCKET).createSignedUrl(path!, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Is the signed-in user the routed handler? Live role rows, mirroring app.can_handle_complaint. */
export function useIsHandler(complaint: Pick<Complaint, 'domain' | 'bhawan_id'> | null | undefined): boolean {
  const { claims } = useSession();
  const messSecretaryOf = useSecretaryBhawans('mess_secretary');
  const bhawanSecretaryOf = useSecretaryBhawans('bhawan_secretary');
  if (!complaint) return false;
  if (complaint.domain === 'campus_eatery') return claims?.roles.includes('adosw') ?? false;
  const scope = complaint.domain === 'mess' ? messSecretaryOf.data : bhawanSecretaryOf.data;
  return scope?.some((b) => b.id === complaint.bhawan_id) ?? false;
}

/** Status changes from anyone reach every open complaint screen (RLS-filtered Realtime). */
export function useComplaintsLive() {
  const queryClient = useQueryClient();
  const id = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`complaints-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () =>
        queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Compress (≤ 1600 px) and upload to complaint-attachments/{uid}/{date}-{random}.jpg. */
async function uploadPhoto(image: PickedImage, userId: string): Promise<string> {
  const { bytes } = await compressForUpload(image, ATTACHMENT_COMPRESSION);
  const path = `${userId}/${istNow().date}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage
    .from(COMPLAINT_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Direct insert: RLS + the routing trigger decide domain, Bhawan, handler and status. */
export function useRaiseComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      outletId: string;
      category: ComplaintCategory;
      title: string;
      body: string;
      photos: PickedImage[];
    }) => {
      const paths = await Promise.all(params.photos.slice(0, MAX_PHOTOS).map((p) => uploadPhoto(p, params.userId)));
      const { data, error } = await supabase
        .from('complaints')
        // domain / assignee_role are NOT NULL but filled by the complaints_prepare trigger (and
        // students have no column grant for them), so the generated Insert type over-asks.
        .insert({
          outlet_id: params.outletId,
          category: params.category,
          title: params.title,
          body: params.body,
          attachment_paths: paths,
        } as TablesInsert<'complaints'>)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
  });
}

/** FastAPI: state machine, scope checks, push to the other party. */
export function useComplaintTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      userId: string;
      toStatus: ComplaintStatus;
      message: string | null;
      proof: PickedImage | null;
    }) => {
      const attachment = params.proof ? await uploadPhoto(params.proof, params.userId) : null;
      return api<Tables<'complaints'>>(`/v1/complaints/${params.id}/transition`, {
        method: 'POST',
        body: { to_status: params.toStatus, message: params.message, attachment_path: attachment },
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
  });
}

export function useNudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Tables<'complaints'>>(`/v1/complaints/${id}/nudge`, { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: complaintKeys.all }),
  });
}
