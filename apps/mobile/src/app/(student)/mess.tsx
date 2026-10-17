import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Pill, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import {
  ExtraItemsCard,
  MealStatusCard,
  NoticeboardCard,
  OverrideBanner,
  WeeklyMenuCard,
} from '@/features/mess/components';
import { useActiveOverrides, useMessOutlet, useMessSchedule } from '@/features/mess/queries';

/** Mess Hub per stitch-reference/dedicated_hostel_mess_noticeboard. Students may browse any Bhawan. */
export default function MessHub() {
  const { claims } = useSession();
  const params = useLocalSearchParams<{ bhawan?: string }>();
  const bhawans = useBhawans();
  const [bhawanId, setBhawanId] = useState<string | null>(params.bhawan ?? claims?.bhawan_id ?? null);

  const bhawan = bhawans.data?.find((b) => b.id === bhawanId);
  const messOutlet = useMessOutlet(bhawanId);
  const schedule = useMessSchedule(bhawanId);
  const overrides = useActiveOverrides(messOutlet?.id);

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {bhawans.data?.map((b) => (
          <Pill
            key={b.id}
            label={b.name.replace(' Bhawan', '')}
            selected={b.id === bhawanId}
            onPress={() => setBhawanId(b.id)}
          />
        ))}
      </ScrollView>

      {bhawan ? (
        <View className="gap-space-xs">
          <Text className="font-headline text-headline-lg-mobile text-on-surface">{bhawan.name} Mess</Text>
          {bhawan.id !== claims?.bhawan_id ? (
            <Text className="font-body text-body-sm text-on-surface-variant">Viewing another Bhawan</Text>
          ) : null}
        </View>
      ) : null}

      <OverrideBanner overrides={overrides.data} />

      <MealStatusCard
        title={bhawan ? `${bhawan.name} Mess` : 'Mess'}
        schedule={schedule.data}
        loading={schedule.isPending}
      />
      {schedule.isError ? (
        <Text className="font-body text-body-sm text-error">{schedule.error.message}</Text>
      ) : null}

      <NoticeboardCard
        outletId={messOutlet?.id}
        title="Mess noticeboard"
        canReport={claims?.roles.includes('student') ?? false}
      />

      <WeeklyMenuCard bhawanId={bhawanId} />

      <ExtraItemsCard bhawanId={bhawanId} />

      {messOutlet ? (
        <Link href={{ pathname: '/raise-complaint', params: { outlet: messOutlet.id } }} asChild>
          <Button label="Raise a mess complaint" variant="secondary" />
        </Link>
      ) : null}
    </Screen>
  );
}
