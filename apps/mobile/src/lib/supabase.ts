import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — copy apps/mobile/.env.example to .env.local',
  );
}

// SecureStore values are capped at ~2 KB and a Supabase session is larger, so the session is
// split into chunks: `<key>.n` holds the chunk count, `<key>.0..n-1` hold the parts.
const CHUNK_SIZE = 1800;

async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}.n`);
  return raw === null ? 0 : Number(raw);
}

const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);
    if (count === 0) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    return parts.some((part) => part === null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await chunkedSecureStore.removeItem(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}.n`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key);
    await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
    );
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Web has no SecureStore; supabase-js falls back to localStorage there.
    storage: Platform.OS === 'web' ? undefined : chunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
