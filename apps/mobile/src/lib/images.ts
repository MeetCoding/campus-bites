import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type CompressOptions = {
  /** Longest edge in px. 2560 keeps handwritten noticeboards legible. */
  maxEdge?: number;
  /** JPEG quality 0–1. */
  quality?: number;
};

export type CompressedImage = { uri: string; width: number; height: number };

/** Every upload MUST go through this (CLAUDE.md): downscale + re-encode as JPEG, which also
 * strips EXIF (location, device). Target is < ~1.5 MB for a 12 MP photo. */
export async function compressForUpload(
  source: { uri: string; width: number; height: number },
  { maxEdge = 2560, quality = 0.82 }: CompressOptions = {},
): Promise<CompressedImage> {
  const context = ImageManipulator.manipulate(source.uri);
  const longest = Math.max(source.width, source.height);
  if (longest > maxEdge) {
    context.resize(source.width >= source.height ? { width: maxEdge } : { height: maxEdge });
  }
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return { uri: result.uri, width: result.width, height: result.height };
}

export const NOTICEBOARD_BUCKET = 'noticeboard-photos';

export function noticeboardUrl(storagePath: string): string {
  return supabase.storage.from(NOTICEBOARD_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Compress, upload to {outlet_id}/{date}-{random}.jpg and record it as the outlet's current photo. */
export async function uploadMenuPhoto(params: {
  outletId: string;
  source: { uri: string; width: number; height: number };
  weekStart?: string;
  today: string;
}) {
  const image = await compressForUpload(params.source);
  const bytes = await new File(image.uri).arrayBuffer();
  const path = `${params.outletId}/${params.today}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(NOTICEBOARD_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('menu_photos')
    .insert({
      outlet_id: params.outletId,
      storage_path: path,
      width: image.width,
      height: image.height,
      week_start: params.weekStart ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return { photo: data, sizeBytes: bytes.byteLength };
}

export type PickedImage = { uri: string; width: number; height: number };

/** Camera or gallery picker with permission handling. null = cancelled. */
export async function pickImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === 'camera' ? 'Camera permission is needed.' : 'Photo library permission is needed.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}
