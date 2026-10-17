import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Pill, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useBhawans, useOutlets } from '@/features/campus/queries';
import { FixedRateCard, MenuItemsList, OutletHeader, Segmented } from '@/features/canteens/components';
import { useLiveStatus, useLiveUpdates } from '@/features/canteens/queries';
import { NoticeboardCard, OverrideBanner } from '@/features/mess/components';
import { useActiveOverrides } from '@/features/mess/queries';

type Shift = 'day_canteen' | 'night_canteen';
type Tab = 'menu' | 'rates';

/** Hostel Canteen Hub per stitch-reference/hostel_canteen_photo_ceiling_rates (TASKS M4.5). */
export default function CanteenHub() {
  const { claims } = useSession();
  const params = useLocalSearchParams<{ outlet?: string; bhawan?: string }>();
  const bhawans = useBhawans();
  const outlets = useOutlets();
  const status = useLiveStatus();
  useLiveUpdates();

  const linked = outlets.data?.find((o) => o.id === params.outlet);
  // Explicit choices win; otherwise a deep link (search result, push), then the student's Bhawan.
  const [bhawanId, setBhawanId] = useState<string | null>(null);
  const [chosenShift, setChosenShift] = useState<Shift | null>(null);
  const [tab, setTab] = useState<Tab>('menu');

  const activeBhawanId =
    bhawanId ?? linked?.bhawan_id ?? params.bhawan ?? claims?.bhawan_id ?? bhawans.data?.[0]?.id ?? null;
  const linkedShift = linked?.type === 'day_canteen' || linked?.type === 'night_canteen' ? linked.type : null;
  const bhawan = bhawans.data?.find((b) => b.id === activeBhawanId);
  const canteenOf = (type: Shift) =>
    outlets.data?.find((o) => o.bhawan_id === activeBhawanId && o.type === type) ?? null;
  // Until the student picks, show whichever canteen is open right now.
  const nightOpen = status.data?.find((s) => s.outlet_id === canteenOf('night_canteen')?.id)?.is_open;
  const shift: Shift =
    chosenShift ?? (linked?.bhawan_id === activeBhawanId ? linkedShift : null) ?? (nightOpen ? 'night_canteen' : 'day_canteen');
  const canteen = canteenOf(shift);
  const overrides = useActiveOverrides(canteen?.id);

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {bhawans.data?.map((b) => (
          <Pill
            key={b.id}
            label={b.name.replace(' Bhawan', '')}
            selected={b.id === activeBhawanId}
            onPress={() => setBhawanId(b.id)}
          />
        ))}
      </ScrollView>

      <Segmented
        options={[
          { value: 'day_canteen', label: 'Day canteen' },
          { value: 'night_canteen', label: 'Night canteen' },
        ]}
        value={shift}
        onChange={setChosenShift}
      />

      {canteen ? (
        <>
          <OutletHeader key={canteen.id} outletId={canteen.id} eyebrow="Hostel canteen hub" />
          <OverrideBanner overrides={overrides.data} />

          <Segmented
            options={[
              { value: 'menu', label: 'Menu & photo' },
              { value: 'rates', label: 'Institute rate card' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'menu' ? (
            <View className="gap-space-md">
              <NoticeboardCard
                outletId={canteen.id}
                title="Uploaded menu photo"
                canReport={claims?.roles.includes('student') ?? false}
              />
              <MenuItemsList outletId={canteen.id} />
            </View>
          ) : activeBhawanId ? (
            <View className="gap-space-md">
              <FixedRateCard bhawanId={activeBhawanId} />
              <Link
                href={{ pathname: '/raise-complaint', params: { outlet: canteen.id, category: 'overcharging' } }}
                asChild>
                <Button label="Report overcharging or a hygiene issue" variant="secondary" />
              </Link>
            </View>
          ) : null}
        </>
      ) : (
        <Text className="font-body text-body-md text-on-surface-variant">
          {bhawan ? `No canteen found for ${bhawan.name}.` : 'Pick a Bhawan.'}
        </Text>
      )}
    </Screen>
  );
}
