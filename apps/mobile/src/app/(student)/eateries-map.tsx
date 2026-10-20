import { Link } from 'expo-router';
import { MapPin as MapPinIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { OpenStatusPill } from '@/features/canteens/components';
import { useLiveStatus, useLiveUpdates, type OutletStatus } from '@/features/canteens/queries';
import { CampusMap } from '@/features/map/CampusMap';
import { eateryPins } from '@/features/map/campus';
import { MapLegend, openDirections } from '@/features/map/components';
import { colors } from '@/theme/tokens';

/** Full-screen campus map of eateries: tap a pin for its status, menu and directions. */
export default function EateriesMapScreen() {
  const insets = useSafeAreaInsets();
  const status = useLiveStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useLiveUpdates();

  const pins = eateryPins(status.data);
  const selected = status.data?.find((s) => s.outlet_id === selectedId && s.latitude !== null);
  const unpinned = (status.data?.filter((s) => s.type === 'eatery').length ?? 0) - pins.length;

  return (
    <View className="flex-1 bg-background">
      {status.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <CampusMap
          pins={pins}
          selectedId={selectedId}
          onPinPress={(pin) => setSelectedId(pin.id)}
          onMapPress={() => setSelectedId(null)}
          accessibilityLabel="Map of campus eateries"
        />
      )}

      <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 px-margin" style={{ paddingBottom: insets.bottom + 16 }}>
        {selected ? (
          <SelectedEatery status={selected} onClose={() => setSelectedId(null)} />
        ) : (
          <Card className="flex-row items-center gap-space-sm">
            <Text className="flex-1 font-body text-body-sm text-on-surface-variant">
              {pins.length === 0
                ? 'No eatery has set its location yet.'
                : `Tap a pin for its menu and directions${unpinned > 0 ? ` · ${unpinned} not on the map yet` : ''}.`}
            </Text>
            <MapLegend />
          </Card>
        )}
      </View>
    </View>
  );
}

function SelectedEatery({ status, onClose }: { status: OutletStatus; onClose: () => void }) {
  return (
    <Card className="gap-space-md">
      <View className="flex-row items-start gap-space-sm">
        <View className="flex-1 gap-space-xs">
          <Text className="font-headline text-headline-sm text-on-surface">{status.name}</Text>
          <OpenStatusPill status={status} />
          {status.location_tag ? (
            <View className="flex-row items-center gap-1">
              <MapPinIcon size={12} color={colors['on-surface-variant']} />
              <Text className="font-label text-label-md text-on-surface-variant">{status.location_tag}</Text>
            </View>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose}>
          <X size={20} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      <View className="flex-row gap-space-sm">
        <View className="flex-1">
          <Link href={{ pathname: '/eatery/[id]', params: { id: status.outlet_id } }} asChild>
            <Button label="View menu" />
          </Link>
        </View>
        <View className="flex-1">
          <Button
            label="Directions"
            variant="secondary"
            onPress={() => {
              if (status.latitude !== null && status.longitude !== null) {
                openDirections({ latitude: status.latitude, longitude: status.longitude });
              }
            }}
          />
        </View>
      </View>
    </Card>
  );
}
