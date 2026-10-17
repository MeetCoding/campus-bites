import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { api } from '@/lib/api';
import type { Enums, Tables } from '@/lib/database.types';
import { compressForUpload, pickImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import { istNow } from '@/lib/time';

export type RebateStatus = Enums<'rebate_status'>;
export type RebateEvent = Tables<'rebate_events'>;
export type Rebate = Tables<'rebate_applications'> & { rebate_events: RebateEvent[] };

export const REBATE_BUCKET = 'rebate-documents';
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // bucket limit

export const rebateKeys = {
  all: ['rebates'] as const,
  rules: ['rebates', 'rules'] as const,
  mine: ['rebates', 'mine'] as const,
  queue: ['rebates', 'queue'] as const,
  detail: (id: string) => ['rebates', 'detail', id] as const,
  document: (path: string) => ['rebates', 'document', path] as const,
};

const WITH_EVENTS = '*, rebate_events(*)';

function sortEvents(rebate: Rebate): Rebate {
  return {
    ...rebate,
    rebate_events: [...rebate.rebate_events].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

/** min_rebate_days / rebate_backdate_days from app_settings (never hard-coded). */
export function useRebateRules() {
  return useQuery({
    queryKey: rebateKeys.rules,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('min_rebate_days, rebate_backdate_days')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** The signed-in student's applications, newest first, with their audit trail. */
export function useMyRebates(studentId: string | null | undefined) {
  return useQuery({
    queryKey: rebateKeys.mine,
    enabled: !!studentId,
    queryFn: async (): Promise<Rebate[]> => {
      const { data, error } = await supabase
        .from('rebate_applications')
        .select(WITH_EVENTS)
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(sortEvents);
    },
  });
}

/** Mess Authority queue: RLS limits it to Bhawans where the caller is Mess Authority. Oldest first. */
export function useRebateQueue() {
  return useQuery({
    queryKey: rebateKeys.queue,
    queryFn: async (): Promise<Rebate[]> => {
      const { data, error } = await supabase
        .from('rebate_applications')
        .select(WITH_EVENTS)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data.map(sortEvents);
    },
  });
}

export function useRebate(id: string | null | undefined) {
  return useQuery({
    queryKey: rebateKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Rebate | null> => {
      const { data, error } = await supabase
        .from('rebate_applications')
        .select(WITH_EVENTS)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data ? sortEvents(data) : null;
    },
  });
}

/** Short-lived signed URL for a private supporting document (storage RLS decides who may). */
export function useDocumentUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: rebateKeys.document(path ?? ''),
    enabled: !!path,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(REBATE_BUCKET).createSignedUrl(path!, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

// ─── Supporting document ─────────────────────────────────────────────────────
export type PickedDocument =
  | { kind: 'image'; uri: string; width: number; height: number }
  | { kind: 'pdf'; uri: string; name: string; size: number | null };

export async function pickDocument(source: 'camera' | 'library' | 'pdf'): Promise<PickedDocument | null> {
  if (source !== 'pdf') {
    const image = await pickImage(source);
    return image ? { kind: 'image', ...image } : null;
  }
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_DOCUMENT_BYTES) throw new Error('PDFs must be 5 MB or smaller.');
  return { kind: 'pdf', uri: asset.uri, name: asset.name, size: asset.size ?? null };
}

/** Upload to rebate-documents/{uid}/{date}-{random}.{jpg|pdf}. Photos are compressed to ≤ 1600 px. */
async function uploadDocument(doc: PickedDocument, studentId: string): Promise<string> {
  const isImage = doc.kind === 'image';
  const uri = isImage ? (await compressForUpload(doc, { maxEdge: 1600 })).uri : doc.uri;
  const bytes = await new File(uri).arrayBuffer();
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error('The document must be 5 MB or smaller.');
  const path = `${studentId}/${istNow().date}-${Math.random().toString(36).slice(2, 10)}.${isImage ? 'jpg' : 'pdf'}`;
  const { error } = await supabase.storage
    .from(REBATE_BUCKET)
    .upload(path, bytes, { contentType: isImage ? 'image/jpeg' : 'application/pdf', upsert: false });
  if (error) throw error;
  return path;
}

// ─── Writes (FastAPI: validation, workflow, push) ────────────────────────────
export function useSubmitRebate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      studentId: string;
      startDate: string;
      endDate: string;
      reason: string;
      document: PickedDocument | null;
    }) => {
      const documentPath = params.document ? await uploadDocument(params.document, params.studentId) : null;
      return api<Tables<'rebate_applications'>>('/v1/rebates', {
        method: 'POST',
        body: {
          start_date: params.startDate,
          end_date: params.endDate,
          reason: params.reason,
          document_path: documentPath,
        },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rebateKeys.mine }),
  });
}

export function useTransitionRebate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; toStatus: RebateStatus; remarks: string | null }) =>
      api<Tables<'rebate_applications'>>(`/v1/rebates/${params.id}/transition`, {
        method: 'POST',
        body: { to_status: params.toStatus, remarks: params.remarks },
      }),
    // Refetch on failure too: a REBATE_STALE error means someone else moved it.
    onSettled: () => queryClient.invalidateQueries({ queryKey: rebateKeys.all }),
  });
}
