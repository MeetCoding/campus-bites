import { Link, type Href } from 'expo-router';
import {
  ArrowUpRight,
  CalendarX2,
  ChevronRight,
  Coffee,
  MessageSquareWarning,
  Moon,
  Store,
  Sun,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button, Card, IconBadge, PressableScale, Screen, SectionHeader, type IconTone } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { OpenStatusPill } from '@/features/canteens/components';
import { useLiveStatus } from '@/features/canteens/queries';
import { MealHero, OverrideBanner } from '@/features/mess/components';
import { EateriesMapCard } from '@/features/map/components';
import { useActiveOverrides, useMessOutlet, useMessSchedule } from '@/features/mess/queries';
import { DAY_LABEL, istNow } from '@/lib/time';
import { colors } from '@/theme/tokens';

const TILES: { title: string; icon: LucideIcon; tone: IconTone; href: Href }[] = [
  { title: 'Canteens', icon: Store, tone: 'primary', href: '/canteens' },
  { title: 'Eateries', icon: Coffee, tone: 'tertiary', href: '/eateries' },
  { title: 'Rebates', icon: CalendarX2, tone: 'open', href: '/rebates' },
  { title: 'Complaints', icon: MessageSquareWarning, tone: 'error', href: '/complaints' },
];

/** "No hostel" accounts (staff, faculty, day scholars): browse any mess, or pick a Bhawan later. */
function NoHostelCard() {
  return (
    <Card className="gap-space-md">
      <View className="flex-row items-center gap-space-md">
        <IconBadge icon={UtensilsCrossed} tone="primary" />
        <View className="flex-1">
          <Text className="font-body-semibold text-body-lg text-on-surface">No hostel selected</Text>
          <Text className="font-body text-body-sm text-on-surface-variant">
            Browse any Bhawan&apos;s mess menu and timings, or choose your Bhawan if you live in one.
          </Text>
        </View>
      </View>
      <View className="flex-row gap-space-sm">
        <Link href="/mess" asChild>
          <Button label="Browse messes" variant="secondary" className="flex-1" />
        </Link>
        <Link href="/choose-bhawan" asChild>
          <Button label="Choose Bhawan" variant="tertiary" className="flex-1" />
        </Link>
      </View>
    </Card>
  );
}

/** Student dashboard per stitch-reference/campus_bites_home_dashboard (TASKS M3.15). */
export default function StudentHome() {
  const { claims } = useSession();
  const bhawans = useBhawans();
  const bhawan = bhawans.data?.find((b) => b.id === claims?.bhawan_id);
  const today = istNow();

  const messOutlet = useMessOutlet(claims?.bhawan_id);
  const schedule = useMessSchedule(claims?.bhawan_id);
  const overrides = useActiveOverrides(messOutlet?.id);
  const status = useLiveStatus();
  const myCanteens = status.data?.filter((s) => s.bhawan_id === claims?.bhawan_id) ?? [];
  const eateriesOpen = status.data?.filter((s) => s.type === 'eatery' && s.is_open).length;

  return (
    <Screen>
      <View className="gap-space-xs pt-space-sm">
        <Text className="font-label-bold text-label-sm uppercase text-on-surface-variant">
          {DAY_LABEL[today.dayKey]}
          {bhawan ? ` · ${bhawan.name}` : ''}
        </Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">What&apos;s cooking</Text>
      </View>

      <OverrideBanner overrides={overrides.data} />

      {claims?.bhawan_id ? (
        <Link href="/mess" asChild>
          <PressableScale accessibilityRole="link" accessibilityLabel="Open Mess Hub">
            <MealHero schedule={schedule.data} loading={schedule.isPending} />
          </PressableScale>
        </Link>
      ) : (
        <NoHostelCard />
      )}

      {myCanteens.length > 0 ? (
        <View className="gap-space-sm">
          <SectionHeader title="Your canteens" />
          {myCanteens.map((c) => (
            <Link key={c.outlet_id} href={{ pathname: '/canteens', params: { outlet: c.outlet_id } }} asChild>
              <PressableScale accessibilityRole="link">
                <Card className="flex-row items-center gap-space-md">
                  <IconBadge icon={c.type === 'day_canteen' ? Sun : Moon} tone={c.type === 'day_canteen' ? 'tertiary' : 'primary'} />
                  <View className="flex-1 gap-space-xs">
                    <Text className="font-body-semibold text-body-lg text-on-surface">
                      {c.type === 'day_canteen' ? 'Day canteen' : 'Night canteen'}
                    </Text>
                    <OpenStatusPill status={c} />
                  </View>
                  <ChevronRight size={20} color={colors.outline} />
                </Card>
              </PressableScale>
            </Link>
          ))}
        </View>
      ) : null}

      <View className="gap-space-sm">
        <SectionHeader title="Around campus" />
        <EateriesMapCard />
      </View>

      <SectionHeader title="Explore" />
      <View className="flex-row flex-wrap justify-between gap-y-space-sm">
        {TILES.map((tile) => (
          <Link key={tile.title} href={tile.href} asChild>
            <PressableScale accessibilityRole="link" className="w-[48.5%]">
              <Card className="min-h-28 justify-between gap-space-md">
                <View className="flex-row items-start justify-between">
                  <IconBadge icon={tile.icon} tone={tile.tone} />
                  <ArrowUpRight size={18} color={colors.outline} />
                </View>
                <View>
                  <Text className="font-body-semibold text-body-lg text-on-surface">{tile.title}</Text>
                  {tile.href === '/eateries' && eateriesOpen !== undefined ? (
                    <Text className="font-label text-label-md text-on-surface-variant">{eateriesOpen} open now</Text>
                  ) : null}
                </View>
              </Card>
            </PressableScale>
          </Link>
        ))}
      </View>

      <AccountPanel />
    </Screen>
  );
}
