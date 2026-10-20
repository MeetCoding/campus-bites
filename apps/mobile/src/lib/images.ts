import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Bytes of a local picked/manipulated file. expo-file-system is a stub on web (`new File()` throws),
 * where pickers and the manipulator hand back `blob:` / `data:` URLs that the browser can fetch. */
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    // Not an API call (lib/api.ts rule): this reads a blob held by the browser.
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

export type CompressOptions = {
  /** Longest edge in px. 2560 keeps handwritten noticeboards legible. */
  maxEdge?: number;
  /** JPEG quality 0–1. */
  quality?: number;
  /** Size budget for the encoded JPEG. Over it, the image is re-encoded smaller (see below). */
  maxBytes?: number;
};

/** Complaint / rebate photos: ≤ 1600 px (CLAUDE.md) and a tighter budget than menu boards. */
export const ATTACHMENT_COMPRESSION: CompressOptions = { maxEdge: 1600, maxBytes: 700_000 };

/** Each retry shrinks the edge by 20 % and quality by 0.1, never below these floors. */
const MAX_ATTEMPTS = 4;
const MIN_EDGE = 1024;
const MIN_QUALITY = 0.5;

export type CompressedImage = { uri: string; width: number; height: number; bytes: ArrayBuffer };

/** Every upload MUST go through this (CLAUDE.md): downscale + re-encode as JPEG, which also
 * strips EXIF (location, device). The image is decoded already downsampled (a 50 MP photo never
 * sits in memory at full size) and sized from its real pixels, not the picker's metadata. If the
 * JPEG is still over `maxBytes` (very detailed boards), it is re-encoded smaller, up to 3 more times. */
export async function compressForUpload(
  source: { uri: string },
  { maxEdge = 2560, quality = 0.82, maxBytes = 1_500_000 }: CompressOptions = {},
): Promise<CompressedImage> {
  const decoded = await ImageManipulator.manipulate(source.uri, { maxWidth: maxEdge, maxHeight: maxEdge }).renderAsync();
  const landscape = decoded.width >= decoded.height;
  let edge = Math.min(maxEdge, Math.max(decoded.width, decoded.height));
  let compress = quality;

  for (let attempt = 1; ; attempt++) {
    const image =
      Math.max(decoded.width, decoded.height) > edge
        ? await ImageManipulator.manipulate(decoded)
            .resize(landscape ? { width: edge } : { height: edge })
            .renderAsync()
        : decoded;
    const result = await image.saveAsync({ compress, format: SaveFormat.JPEG });
    const bytes = await readBytes(result.uri);
    if (bytes.byteLength <= maxBytes || attempt === MAX_ATTEMPTS) {
      return { uri: result.uri, width: result.width, height: result.height, bytes };
    }
    edge = Math.max(MIN_EDGE, Math.round(edge * 0.8));
    compress = Math.max(MIN_QUALITY, compress - 0.1);
  }
}

export const NOTICEBOARD_BUCKET = 'noticeboard-photos';

export function noticeboardUrl(storagePath: string): string {
  return supabase.storage.from(NOTICEBOARD_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Compress, upload to {outlet_id}/{date}-{random}.jpg and add it to the top of the outlet's photo
 * stack. The DB refuses uploads past app_settings.max_menu_photos (MENU_PHOTO_LIMIT). */
export async function uploadMenuPhoto(params: {
  outletId: string;
  source: { uri: string; width: number; height: number };
  weekStart?: string;
  today: string;
  /** 'extras' = a mess's pay-to-get price list (020); default the menu / noticeboard stack. */
  kind?: 'menu' | 'extras';
}) {
  const image = await compressForUpload(params.source);
  const { bytes } = image;
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
      kind: params.kind ?? 'menu',
    })
    .select()
    .single();
  if (error) {
    // Don't leave an unlisted file behind in the public bucket.
    await supabase.storage.from(NOTICEBOARD_BUCKET).remove([path]);
    if (error.message === 'MENU_PHOTO_LIMIT') throw new Error(error.details || 'Photo limit reached. Delete an old one first.');
    if (error.message === 'EXTRAS_PHOTO_MESS_ONLY') throw new Error('Extra-items photos are for messes only.');
    throw error;
  }
  return { photo: data, sizeBytes: bytes.byteLength };
}

/** Remove a photo from the stack: the row first (RLS re-checks the manager live), then its file. */
export async function deleteMenuPhoto(photo: { id: string; outlet_id: string; storage_path: string }) {
  const { data, error } = await supabase.from('menu_photos').delete().eq('id', photo.id).select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error("This photo was already removed, or you can't manage this outlet.");
  // The photo is already unpublished; a failed file delete only leaves an unlisted object.
  await supabase.storage.from(NOTICEBOARD_BUCKET).remove([photo.storage_path]);
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
