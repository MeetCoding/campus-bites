import { useEffect, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { regionFor, type CampusMapProps, type MapPin } from '@/features/map/campus';
import { MAP_STYLE } from '@/features/map/mapStyle';
import { cn } from '@/lib/cn';

/**
 * Google map (react-native-maps, Google provider on Android and iOS) in the minimal campus style.
 * Fills its parent: give the parent a height. Web: CampusMap.web.tsx.
 */
export function CampusMap({
  pins,
  interactive = true,
  selectedId,
  onPinPress,
  onMapPress,
  region,
  accessibilityLabel,
}: CampusMapProps) {
  return (
    <View className="flex-1" pointerEvents={interactive ? 'auto' : 'none'} accessibilityLabel={accessibilityLabel}>
      <MapView
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        style={{ flex: 1 }}
        initialRegion={region ?? regionFor(pins)}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsIndoors={false}
        showsCompass={false}
        moveOnMarkerPress={false}
        onPress={(event) => onMapPress?.(event.nativeEvent.coordinate)}>
        {pins.map((pin) => (
          // Keyed on its look: a change remounts the marker so Android redraws the snapshot.
          <PinMarker
            key={`${pin.id}-${pin.id === selectedId}-${pin.isOpen}`}
            pin={pin}
            selected={pin.id === selectedId}
            onPress={onPinPress}
          />
        ))}
      </MapView>
    </View>
  );
}

function PinMarker({ pin, selected, onPress }: { pin: MapPin; selected: boolean; onPress?: (pin: MapPin) => void }) {
  // Android snapshots custom marker views: track changes for a moment after mount so the dot is
  // drawn after layout, then stop (re-rendering markers every frame is expensive).
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracking(false), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={pin}
      title={pin.name}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking}
      onPress={() => onPress?.(pin)}>
      <PinDot open={pin.isOpen} selected={selected} />
    </Marker>
  );
}

/** Our only colour on the map: green = open now, grey = closed. White halo lifts it off the tiles. */
export function PinDot({ open, selected = false }: { open: boolean; selected?: boolean }) {
  return (
    <View
      className={cn(
        'rounded-full border-2 border-surface-container-lowest',
        selected ? 'h-6 w-6' : 'h-4 w-4',
        open ? 'bg-status-open' : 'bg-outline',
      )}
    />
  );
}
