import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Badge, Button } from '@/components/ui';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import { useDocumentUrl, type RebateEvent, type RebateStatus } from '@/features/rebates/queries';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/time';
import { colors } from '@/theme/tokens';

export const REBATE_STATUS_LABEL: Record<RebateStatus, string> = {
  pending_verification: 'Pending verification',
  biometric_cross_checked: 'Biometric cross-checked',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_TONE = {
  pending_verification: 'warning',
  biometric_cross_checked: 'official',
  approved: 'open',
  rejected: 'longStanding',
} as const;

export function RebateStatusBadge({ status }: { status: RebateStatus }) {
  return <Badge label={REBATE_STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}

/** Submitted → Biometric cross-checked → Approved / Rejected, with times and remarks. */
export function RebateTimeline({ status, events }: { status: RebateStatus; events: RebateEvent[] }) {
  const at = (to: RebateStatus) => events.find((e) => e.to_status === to);
  const finalStatus: RebateStatus = status === 'rejected' ? 'rejected' : 'approved';
  const steps: { key: RebateStatus; label: string }[] = [
    { key: 'pending_verification', label: 'Submitted' },
    { key: 'biometric_cross_checked', label: 'Biometric cross-checked' },
    { key: finalStatus, label: finalStatus === 'rejected' ? 'Rejected' : 'Approved' },
  ];

  return (
    <View className="gap-space-xs">
      {steps.map((step, index) => {
        const event = at(step.key);
        // A rejection before the cross-check skips that step.
        const skipped = !event && status === 'rejected' && step.key === 'biometric_cross_checked';
        if (skipped) return null;
        const done = !!event;
        const failed = step.key === 'rejected';
        return (
          <View key={step.key} className="flex-row gap-space-sm">
            <View className="items-center">
              <View
                className={cn(
                  'h-5 w-5 items-center justify-center rounded-full',
                  done ? (failed ? 'bg-error' : 'bg-primary') : 'bg-surface-container-high',
                )}>
                {done ? <MaterialIcons name={failed ? 'close' : 'check'} size={14} color={colors['on-primary']} /> : null}
              </View>
              {index < steps.length - 1 ? <View className="w-0.5 flex-1 bg-surface-container-high" /> : null}
            </View>
            <View className="flex-1 pb-space-sm">
              <Text
                className={cn(
                  'font-body-semibold text-body-md',
                  done ? 'text-on-surface' : 'text-on-surface-variant',
                )}>
                {step.label}
              </Text>
              {event ? (
                <Text className="font-body text-body-sm text-on-surface-variant">{timeAgo(event.created_at)}</Text>
              ) : null}
              {event?.remarks ? (
                <Text className="font-body text-body-sm text-on-surface">“{event.remarks}”</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Opens a private supporting document through a short-lived signed URL. */
export function RebateDocument({ path }: { path: string }) {
  const url = useDocumentUrl(path);
  const [zoomed, setZoomed] = useState(false);
  const isPdf = path.endsWith('.pdf');

  if (url.isPending) return <ActivityIndicator />;
  if (url.isError) return <Text className="font-body text-body-sm text-error">{url.error.message}</Text>;

  if (isPdf) {
    return (
      <Button
        label="Open supporting PDF"
        variant="secondary"
        onPress={() => void WebBrowser.openBrowserAsync(url.data)}
      />
    );
  }
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Supporting document. Tap to zoom."
        onPress={() => setZoomed(true)}
        className="overflow-hidden rounded-lg bg-surface-container-low active:opacity-90">
        <Image source={{ uri: url.data }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" />
        <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-inverse-surface/80 px-2 py-1">
          <MaterialIcons name="zoom-in" size={14} color={colors['inverse-on-surface']} />
          <Text className="font-label text-label-sm text-inverse-on-surface">Tap to zoom</Text>
        </View>
      </Pressable>
      <ZoomableImage
        uri={url.data}
        visible={zoomed}
        onClose={() => setZoomed(false)}
        accessibilityLabel="Supporting document"
      />
    </>
  );
}
