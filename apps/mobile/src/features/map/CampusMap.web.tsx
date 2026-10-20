/// <reference types="google.maps" />
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { Text, View } from 'react-native';

import { regionFor, zoomFor, type CampusMapProps, type MapPin } from '@/features/map/campus';
import { MAP_STYLE } from '@/features/map/mapStyle';
import { colors } from '@/theme/tokens';

/** Browser key (Maps JavaScript API), restricted by HTTP referrer in Google Cloud. */
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;

/** Web twin of CampusMap.tsx on the Google Maps JavaScript API: same props, style and pins. */
export function CampusMap({
  pins,
  interactive = true,
  selectedId,
  onPinPress,
  onMapPress,
  region,
  accessibilityLabel,
}: CampusMapProps) {
  if (!API_KEY) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-container-low p-space-md">
        <Text className="text-center font-body text-body-sm text-on-surface-variant">
          Map unavailable: set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY.
        </Text>
      </View>
    );
  }

  const camera = region ?? regionFor(pins);
  return (
    <View className="flex-1" pointerEvents={interactive ? 'auto' : 'none'} accessibilityLabel={accessibilityLabel}>
      <APIProvider apiKey={API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={{ lat: camera.latitude, lng: camera.longitude }}
          defaultZoom={zoomFor(camera)}
          styles={MAP_STYLE}
          disableDefaultUI
          clickableIcons={false}
          keyboardShortcuts={false}
          gestureHandling={interactive ? 'greedy' : 'none'}
          onClick={(event) => {
            const point = event.detail.latLng;
            if (point) onMapPress?.({ latitude: point.lat, longitude: point.lng });
          }}>
          {pins.map((pin) => (
            <PinMarker key={pin.id} pin={pin} selected={pin.id === selectedId} onPress={onPinPress} />
          ))}
        </Map>
      </APIProvider>
    </View>
  );
}

/** Rendered inside <Map>, so the Maps API (google.maps) is loaded by now. */
function PinMarker({ pin, selected, onPress }: { pin: MapPin; selected: boolean; onPress?: (pin: MapPin) => void }) {
  return (
    <Marker
      position={{ lat: pin.latitude, lng: pin.longitude }}
      title={pin.name}
      onClick={() => onPress?.(pin)}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: selected ? 10 : 7,
        fillColor: pin.isOpen ? colors['status-open'] : colors.outline,
        fillOpacity: 1,
        strokeColor: colors['surface-container-lowest'],
        strokeWeight: 2,
      }}
    />
  );
}
