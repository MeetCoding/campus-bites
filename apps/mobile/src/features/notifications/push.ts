import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const TOKEN_KEY = 'cb.expo-push-token';

// Channels referenced by the API (apps/api/app/services/notifications.py → Channel).
const ANDROID_CHANNELS = [
  { id: 'mess-updates', name: 'Mess updates', importance: AndroidImportance.HIGH },
  { id: 'nudges', name: 'Complaint nudges', importance: AndroidImportance.MAX },
] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushRegistration =
  | { status: 'registered'; token: string }
  | { status: 'skipped'; reason: string };

function easProjectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
    ?.projectId;
  return fromExtra ?? Constants.easConfig?.projectId;
}

/** Ask permission, get the Expo push token and store it against the signed-in user. */
export async function registerForPush(): Promise<PushRegistration> {
  if (Platform.OS === 'web') return { status: 'skipped', reason: 'web' };
  if (!Device.isDevice) return { status: 'skipped', reason: 'Push needs a physical device.' };

  if (Platform.OS === 'android') {
    await Promise.all(
      ANDROID_CHANNELS.map((channel) =>
        Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: channel.importance,
        }),
      ),
    );
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { status: 'skipped', reason: 'Notifications are turned off.' };

  const projectId = easProjectId();
  if (!projectId) {
    return { status: 'skipped', reason: 'No EAS projectId (run `eas init` in apps/mobile).' };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS,
    });
    if (error) throw error;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return { status: 'registered', token };
  } catch (error) {
    // e.g. Expo Go on Android has no remote push since SDK 53 — use a development build.
    return { status: 'skipped', reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Remove this device's token before signing out so the next user doesn't get our alerts. */
export async function unregisterPush(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('expo_token', token);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
