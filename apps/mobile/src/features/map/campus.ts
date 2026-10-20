import type { OutletStatus } from '@/features/canteens/queries';

export type LatLng = { latitude: number; longitude: number };

/** One marker on the campus map. */
export type MapPin = LatLng & { id: string; name: string; isOpen: boolean };

/** Camera as a centre plus the span to show (degrees), like react-native-maps' Region. */
export type MapRegion = LatLng & { latitudeDelta: number; longitudeDelta: number };

/** IIT Roorkee main campus, approximately. Only the camera's starting point when no pins exist. */
export const CAMPUS_CENTER: LatLng = { latitude: 29.8649, longitude: 77.8966 };

/** ~1.3 km: the main campus at a glance. */
const DEFAULT_DELTA = 0.012;
/** Never zoom in closer than a block or so, even for a single pin. */
const MIN_DELTA = 0.004;
/** Breathing room around the outermost pins. */
const PADDING = 1.6;

/** Eateries with a pin, as map markers (open/closed from the live status view). */
export function eateryPins(statuses: OutletStatus[] | undefined): MapPin[] {
  return (statuses ?? []).flatMap((s) =>
    s.type === 'eatery' && s.latitude !== null && s.longitude !== null
      ? [{ id: s.outlet_id, name: s.name, isOpen: s.is_open, latitude: s.latitude, longitude: s.longitude }]
      : [],
  );
}

/** Region that fits every point (or the campus when there are none). */
export function regionFor(points: LatLng[]): MapRegion {
  if (points.length === 0) {
    return { ...CAMPUS_CENTER, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA };
  }
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * PADDING, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * PADDING, MIN_DELTA),
  };
}

/** Google Maps JS zoom level showing about the same span as a region (web has no region prop). */
export function zoomFor(region: MapRegion): number {
  const span = Math.max(region.latitudeDelta, region.longitudeDelta);
  return Math.min(18, Math.max(12, Math.floor(Math.log2(360 / span))));
}

/** Opens Google Maps (app or browser) with walking directions. Needs no API key. */
export function directionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.latitude},${to.longitude}&travelmode=walking`;
}

/** Props shared by CampusMap.tsx (react-native-maps) and CampusMap.web.tsx (Maps JavaScript API). */
export type CampusMapProps = {
  pins: MapPin[];
  /** false = a still preview (no pan/zoom), e.g. inside a scrolling screen. */
  interactive?: boolean;
  selectedId?: string | null;
  onPinPress?: (pin: MapPin) => void;
  /** Tap on empty map: used by the pin picker. */
  onMapPress?: (point: LatLng) => void;
  /** Camera override; defaults to fitting every pin. */
  region?: MapRegion;
  accessibilityLabel: string;
};
