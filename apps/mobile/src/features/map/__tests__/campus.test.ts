import { describe, expect, it } from '@jest/globals';

import type { OutletStatus } from '@/features/canteens/queries';
import { CAMPUS_CENTER, directionsUrl, eateryPins, regionFor, zoomFor } from '@/features/map/campus';

function status(overrides: Partial<OutletStatus>): OutletStatus {
  return {
    outlet_id: 'id',
    type: 'eatery',
    bhawan_id: null,
    name: 'Amul',
    location_tag: null,
    is_open: true,
    source: 'schedule',
    closes_at: null,
    next_opens_at: null,
    shift_starts_at: null,
    shift_ends_at: null,
    status_updated_at: null,
    latitude: 29.8649,
    longitude: 77.8966,
    contact_phone: null,
    ...overrides,
  };
}

describe('eateryPins', () => {
  it('maps pinned eateries with their open state', () => {
    expect(eateryPins([status({ outlet_id: 'a', is_open: false })])).toEqual([
      { id: 'a', name: 'Amul', isOpen: false, latitude: 29.8649, longitude: 77.8966 },
    ]);
  });

  it('skips canteens and eateries without a pin', () => {
    const pins = eateryPins([
      status({ outlet_id: 'canteen', type: 'day_canteen' }),
      status({ outlet_id: 'unpinned', latitude: null, longitude: null }),
      status({ outlet_id: 'pinned' }),
    ]);
    expect(pins.map((p) => p.id)).toEqual(['pinned']);
  });

  it('handles data not loaded yet', () => {
    expect(eateryPins(undefined)).toEqual([]);
  });
});

describe('regionFor', () => {
  it('falls back to the campus when nothing is pinned', () => {
    expect(regionFor([])).toMatchObject(CAMPUS_CENTER);
  });

  it('centres on the pins with padding', () => {
    const region = regionFor([
      { latitude: 29.86, longitude: 77.89 },
      { latitude: 29.87, longitude: 77.91 },
    ]);
    expect(region.latitude).toBeCloseTo(29.865);
    expect(region.longitude).toBeCloseTo(77.9);
    expect(region.latitudeDelta).toBeCloseTo(0.016);
    expect(region.longitudeDelta).toBeCloseTo(0.032);
  });

  it('does not zoom to street level for a single pin', () => {
    const region = regionFor([{ latitude: 29.86, longitude: 77.89 }]);
    expect(region.latitudeDelta).toBeGreaterThan(0.003);
    expect(region.longitudeDelta).toBeGreaterThan(0.003);
  });
});

describe('zoomFor', () => {
  it('turns a span into a Google zoom level within campus bounds', () => {
    expect(zoomFor(regionFor([]))).toBe(14);
    expect(zoomFor({ ...CAMPUS_CENTER, latitudeDelta: 0.0001, longitudeDelta: 0.0001 })).toBe(18);
    expect(zoomFor({ ...CAMPUS_CENTER, latitudeDelta: 5, longitudeDelta: 5 })).toBe(12);
  });
});

describe('directionsUrl', () => {
  it('opens walking directions in Google Maps', () => {
    expect(directionsUrl({ latitude: 29.8649, longitude: 77.8966 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=29.8649,77.8966&travelmode=walking',
    );
  });
});
