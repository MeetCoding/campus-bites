import { colors } from '@/theme/tokens';

/**
 * Clean, minimal Google map in the Alexandria palette (shared by Android/iOS and web): no
 * business or transit clutter, quiet surface-tier land and roads, soft blue water, and grey
 * labels. Our own pins are the only colour on the map.
 */
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors['surface-container-low'] }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.outline }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.surface }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: colors['surface-container'] }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: colors['surface-container'] }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors['surface-container-lowest'] }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: colors['surface-container-high'] }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors['primary-fixed'] }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: colors['primary-fixed-dim'] }] },
];
