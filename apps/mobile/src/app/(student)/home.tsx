import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, Card, Screen, SectionHeader } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { MealStatusCard, OverrideBanner } from '@/features/mess/components';
import {
  MEAL_LABEL,
  MEAL_SLOTS,
  useActiveOverrides,
  useMessOutlet,
  useMessSchedule,
  useWeeklyMenu,
} from '@/features/mess/queries';
import { DAY_LABEL, istNow, weekStart } from '@/lib/time';
import { colors } from '@/theme/tokens';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const QUICK_LINKS: { title: string; icon: IconName; href?: Href }[] = [
  { title: 'Mess Hub', icon: 'restaurant', href: '/mess' },
  { title: 'Hostel canteens', icon: 'storefront' },
  { title: 'Campus eateries', icon: 'local-cafe' },
  { title: 'Mess rebates', icon: 'event-busy' },
  { title: 'Complaints', icon: 'report' },
];

/** Student dashboard per stitch-reference/campus_bites_home_dashboard (TASKS M3.15). */
export default function StudentHome() {
  const { claims } = useSession();
  const bhawans = useBhawans();
  const bhawan = bhawans.data?.find((b) => b.id === claims?.bhawan_id);
  const today = istNow();

  const messOutlet = useMessOutlet(claims?.bhawan_id);
  const schedule = useMessSchedule(claims?.bhawan_id);
  const overrides = useActiveOverrides(messOutlet?.id);
  const menu = useWeeklyMenu(claims?.bhawan_id, weekStart(today.date));
  const todaysMenu = menu.data?.items[today.dayKey];

  return (
    <Screen>
      <View className="gap-space-xs pt-space-md">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">
          Today is {DAY_LABEL[today.dayKey]} · IIT Roorkee
        </Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">
          {bhawan?.name ?? 'Campus Bites'}
        </Text>
      </View>

      <OverrideBanner overrides={overrides.data} />

      <Link href="/mess" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Open Mess Hub" className="active:opacity-90">
          <MealStatusCard
            title={bhawan ? `${bhawan.name} Mess` : 'Your mess'}
            schedule={schedule.data}
            loading={schedule.isPending}
          />
        </Pressable>
      </Link>

      <SectionHeader title="Campus food directory" />
      <View className="flex-row flex-wrap gap-space-sm">
        {QUICK_LINKS.map((link) => {
          const tile = (
            <Card className="min-h-24 justify-between gap-space-sm">
              <MaterialIcons name={link.icon} size={24} color={link.href ? colors.primary : colors.outline} />
              <View className="gap-space-xs">
                <Text className="font-body-semibold text-body-md text-on-surface">{link.title}</Text>
                {link.href ? null : <Badge label="Soon" />}
              </View>
            </Card>
          );
          return (
            <View key={link.title} className="w-[48%]">
              {link.href ? (
                <Link href={link.href} asChild>
                  <Pressable accessibilityRole="link" className="active:opacity-80">
                    {tile}
                  </Pressable>
                </Link>
              ) : (
                tile
              )}
            </View>
          );
        })}
      </View>

      <SectionHeader title="Today's mess menu" />
      <Link href="/mess" asChild>
        <Pressable accessibilityRole="link" className="active:opacity-90">
          <Card className="gap-space-sm">
            {todaysMenu ? (
              MEAL_SLOTS.map((slot) => (
                <View key={slot} className="gap-space-xs">
                  <Text className="font-label-bold text-label-sm uppercase text-primary">{MEAL_LABEL[slot]}</Text>
                  <Text className="font-body text-body-md text-on-surface">
                    {todaysMenu[slot]?.length ? todaysMenu[slot]!.join(' · ') : '—'}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="font-body text-body-md text-on-surface-variant">
                {menu.isPending ? 'Loading menu…' : 'Menu not published yet — tap to see the noticeboard photo.'}
              </Text>
            )}
          </Card>
        </Pressable>
      </Link>

      <AccountPanel />
    </Screen>
  );
}
