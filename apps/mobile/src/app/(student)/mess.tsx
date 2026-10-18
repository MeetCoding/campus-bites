import { Link, useLocalSearchParams } from 'expo-router';
import { MessageSquareWarning } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Card, IconBadge, Pill, PressableScale, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import {
  ExtraItemsCard,
  MealHero,
  NoticeboardCard,
  OverrideBanner,
  WeeklyMenuCard,
} from '@/features/mess/components';
import { useActiveOverrides, useMessOutlet, useMessSchedule, useWeeklyMenu } from '@/features/mess/queries';
import { istNow, weekStart } from '@/lib/time';

/** Mess Hub per stitch-reference/dedicated_hostel_mess_noticeboard. Students may browse any Bhawan. */
export default function MessHub() {
  const { claims } = useSession();
  const params = useLocalSearchParams<{ bhawan?: string }>();
  const bhawans = useBhawans();
  const [bhawanId, setBhawanId] = useState<string | null>(params.bhawan ?? claims?.bhawan_id ?? null);
  const today = istNow();

  const messOutlet = useMessOutlet(bhawanId);
  const schedule = useMessSchedule(bhawanId);
  const overrides = useActiveOverrides(messOutlet?.id);
  const menu = useWeeklyMenu(bhawanId, weekStart(today.date));

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {bhawans.data?.map((b) => (
          <Pill
            key={b.id}
            label={b.id === claims?.bhawan_id ? `${b.name.replace(' Bhawan', '')} · Mine` : b.name.replace(' Bhawan', '')}
            selected={b.id === bhawanId}
            onPress={() => setBhawanId(b.id)}
          />
        ))}
      </ScrollView>

      <OverrideBanner overrides={overrides.data} />

      <MealHero schedule={schedule.data} loading={schedule.isPending} menu={menu.data?.items[today.dayKey]} />
      {schedule.isError ? (
        <Text className="font-body text-body-sm text-error">{schedule.error.message}</Text>
      ) : null}

      <WeeklyMenuCard bhawanId={bhawanId} />

      <NoticeboardCard
        outletId={messOutlet?.id}
        title="Noticeboard photo"
        canReport={claims?.roles.includes('student') ?? false}
      />

      <ExtraItemsCard bhawanId={bhawanId} />

      {messOutlet ? (
        <Link href={{ pathname: '/raise-complaint', params: { outlet: messOutlet.id } }} asChild>
          <PressableScale accessibilityRole="link">
            <Card className="flex-row items-center gap-space-md">
              <IconBadge icon={MessageSquareWarning} tone="error" />
              <View className="flex-1">
                <Text className="font-body-semibold text-body-md text-on-surface">Something wrong at the mess?</Text>
                <Text className="font-body text-body-sm text-on-surface-variant">Goes to the Mess Secretary</Text>
              </View>
            </Card>
          </PressableScale>
        </Link>
      ) : null}
    </Screen>
  );
}
