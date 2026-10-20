import { Link } from 'expo-router';
import { ArrowUpRight, MapPin as MapPinIcon, Navigation } from 'lucide-react-native';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { Button, Card, PressableScale } from '@/components/ui';
import { useLiveStatus, useOutletStatus } from '@/features/canteens/queries';
import { CampusMap } from '@/features/map/CampusMap';
import { directionsUrl, eateryPins, regionFor, type LatLng } from '@/features/map/campus';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

/** Home screen: every eatery on one still map; tapping opens the full map. */
export function EateriesMapCard() {
  const status = useLiveStatus();
  const pins = eateryPins(status.data);
  const open = pins.filter((p) => p.isOpen).length;

  return (
    <Link href="/eateries-map" asChild>
      <PressableScale accessibilityRole="link" accessibilityLabel={`Eateries map, ${open} of ${pins.length} open now`}>
        <Card padded={false} className="overflow-hidden">
          <View className="h-44 bg-surface-container-low">
            {status.isPending ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <CampusMap pins={pins} interactive={false} accessibilityLabel="Map of campus eateries" />
            )}
          </View>
          <View className="flex-row items-center gap-space-sm p-space-md">
            <View className="flex-1 gap-0.5">
              <Text className="font-body-semibold text-body-lg text-on-surface">Eateries on campus</Text>
              <Text className="font-label text-label-md text-on-surface-variant">
                {pins.length === 0 ? 'Pins appear as outlets set their location' : `${open} of ${pins.length} open now`}
              </Text>
            </View>
            <MapLegend />
            <ArrowUpRight size={18} color={colors.outline} />
          </View>
        </Card>
      </PressableScale>
    </Link>
  );
}

export function MapLegend() {
  return (
    <View className="flex-row items-center gap-space-sm">
      <LegendDot open label="Open" />
      <LegendDot open={false} label="Closed" />
    </View>
  );
}

function LegendDot({ open, label }: { open: boolean; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View className={cn('h-2 w-2 rounded-full', open ? 'bg-status-open' : 'bg-outline')} />
      <Text className="font-label text-label-sm text-on-surface-variant">{label}</Text>
    </View>
  );
}

export function openDirections(to: LatLng) {
  void Linking.openURL(directionsUrl(to));
}

/** Eatery detail: where it is, with walking directions. Hidden until the eatery has a pin. */
export function EateryLocationCard({ outletId }: { outletId: string }) {
  const status = useOutletStatus(outletId);
  const s = status.data;
  if (!s || s.latitude === null || s.longitude === null) return null;
  const pin = { id: s.outlet_id, name: s.name, isOpen: s.is_open, latitude: s.latitude, longitude: s.longitude };

  return (
    <Card padded={false} className="overflow-hidden">
      <View className="h-40 bg-surface-container-low">
        <CampusMap pins={[pin]} interactive={false} accessibilityLabel={`Map showing ${s.name}`} />
      </View>
      <View className="flex-row items-center gap-space-sm p-space-md">
        <MapPinIcon size={16} color={colors['on-surface-variant']} />
        <Text className="flex-1 font-body text-body-md text-on-surface">{s.location_tag ?? 'On campus'}</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Directions to ${s.name}`}
          onPress={() => openDirections(pin)}
          hitSlop={8}
          className="flex-row items-center gap-1.5 active:opacity-60">
          <Navigation size={14} color={colors.primary} />
          <Text className="font-label-bold text-label-md text-primary">Directions</Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Tap the map to drop an outlet's pin (admin and vendor editors). Only the pin being edited is drawn. */
export function PinPicker({
  value,
  onChange,
  onSave,
  onClear,
  saving,
  error,
}: {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  onSave?: () => void;
  onClear?: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  return (
    <View className="gap-space-sm">
      <View className="h-60 overflow-hidden rounded-2xl bg-surface-container-low">
        <CampusMap
          pins={value ? [{ id: 'picked', name: 'Pin', isOpen: true, ...value }] : []}
          region={value ? regionFor([value]) : undefined}
          onMapPress={onChange}
          accessibilityLabel="Tap the map to place the pin"
        />
      </View>
      <Text className="font-body text-body-sm text-on-surface-variant">
        {value
          ? `Pin at ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}. Tap elsewhere to move it.`
          : 'Tap the map where the counter is. Students see it on the campus map and get directions.'}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {error}
        </Text>
      ) : null}
      {onSave || onClear ? (
        <View className="flex-row flex-wrap gap-space-sm">
          {onSave ? <Button label="Save pin" variant="secondary" onPress={onSave} loading={saving} disabled={!value} /> : null}
          {onClear ? <Button label="Remove pin" variant="tertiary" onPress={onClear} disabled={saving} /> : null}
        </View>
      ) : null}
    </View>
  );
}
