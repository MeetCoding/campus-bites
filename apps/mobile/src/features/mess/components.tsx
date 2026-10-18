import { Image } from 'expo-image';
import { Camera, Flag, Megaphone, Moon, Pin, Sun, Sunrise, ZoomIn, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Card, HeroCard, IconBadge, LiveDot, Pill, PressableScale, SectionHeader } from '@/components/ui';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import { PriceChip } from '@/features/canteens/components';
import {
  MEAL_LABEL,
  MEAL_SLOTS,
  useCurrentPhoto,
  useExtraItems,
  usePhotoReports,
  useReportPhoto,
  useWeeklyMenu,
  type MealSlot,
  type ScheduleRow,
  type TimingOverride,
} from '@/features/mess/queries';
import { cn } from '@/lib/cn';
import { noticeboardUrl } from '@/lib/images';
import {
  currentMeal,
  DAY_KEYS,
  DAY_LABEL,
  formatDateRange,
  formatDuration,
  formatTime,
  formatWindow,
  istNow,
  timeAgo,
  weekStart,
  type DayKey,
} from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { colors } from '@/theme/tokens';

export const MEAL_ICON: Record<MealSlot, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
};

type DayMenu = Partial<Record<MealSlot, string[]>>;

// ─── Live meal hero ──────────────────────────────────────────────────────────
/**
 * "What's cooking right now": the serving (or next) meal in IST, a countdown, today's dishes
 * for that meal as chips, and a strip of today's three windows.
 */
export function MealHero({
  schedule,
  loading,
  menu,
  eyebrow,
}: {
  schedule: ScheduleRow[] | undefined;
  loading?: boolean;
  /** Today's dishes per meal, when the weekly menu is published. */
  menu?: DayMenu;
  eyebrow?: string;
}) {
  const now = istNow(useNow());
  if (loading || !schedule) {
    return (
      <HeroCard className="items-center">
        <ActivityIndicator color={colors['on-primary']} />
      </HeroCard>
    );
  }
  const { serving, next, minutesLeft } = currentMeal(schedule, now.minutes);
  const focus = serving ?? next;
  const dishes = focus ? (menu?.[focus.slot] ?? []) : [];

  return (
    <HeroCard>
      <View className="flex-row items-center justify-between gap-space-sm">
        {serving ? (
          <View className="flex-row items-center gap-2 rounded-full bg-status-open/20 px-3 py-1">
            <LiveDot tone="open" />
            <Text className="font-label-bold text-label-sm uppercase text-on-primary">Serving now</Text>
          </View>
        ) : next ? (
          <View className="flex-row items-center gap-2 rounded-full bg-on-primary/15 px-3 py-1">
            <LiveDot tone="onDark" pulse={false} />
            <Text className="font-label-bold text-label-sm uppercase text-on-primary">Up next</Text>
          </View>
        ) : (
          <Text className="font-label-bold text-label-sm uppercase text-on-primary-container">
            {eyebrow ?? 'Today'}
          </Text>
        )}
        {focus && minutesLeft !== null ? (
          <View className="rounded-full bg-tertiary-fixed px-3 py-1">
            <Text className="font-label-bold text-label-sm text-on-tertiary-fixed">
              {serving ? 'Closes' : 'Opens'} in {formatDuration(minutesLeft)}
            </Text>
          </View>
        ) : null}
      </View>

      {focus ? (
        <View className="flex-row items-center gap-space-md">
          <IconBadge icon={MEAL_ICON[focus.slot]} tone="onDark" size="lg" />
          <View className="flex-1">
            <Text className="font-headline text-headline-lg-mobile text-on-primary">{MEAL_LABEL[focus.slot]}</Text>
            <Text className="font-body-medium text-body-md text-on-primary-container">
              {formatWindow(focus.opens_at, focus.closes_at)}
            </Text>
          </View>
        </View>
      ) : (
        <View className="gap-space-xs">
          <Text className="font-headline text-headline-lg-mobile text-on-primary">Kitchen&apos;s closed</Text>
          <Text className="font-body text-body-md text-on-primary-container">See you at breakfast.</Text>
        </View>
      )}

      {dishes.length > 0 ? (
        <View className="flex-row flex-wrap gap-space-xs">
          {dishes.map((dish) => (
            <View key={dish} className="rounded-full bg-on-primary/15 px-3 py-1.5">
              <Text className="font-body-medium text-body-sm text-on-primary">{dish}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row gap-space-xs rounded-2xl bg-hero/40 p-1">
        {MEAL_SLOTS.map((slot) => {
          const row = schedule.find((r) => r.slot === slot);
          if (!row) return null;
          const active = focus?.slot === slot;
          const Icon = MEAL_ICON[slot];
          return (
            <View
              key={slot}
              className={cn('flex-1 items-center gap-1 rounded-xl py-space-sm', active && 'bg-on-primary/15')}>
              <Icon size={14} color={active ? colors['on-primary'] : colors['inverse-primary']} />
              <Text
                className={cn(
                  'font-label text-label-sm',
                  row.is_closed ? 'text-error-container' : active ? 'text-on-primary' : 'text-inverse-primary',
                )}>
                {row.is_closed ? 'Closed' : formatTime(row.opens_at)}
              </Text>
            </View>
          );
        })}
      </View>
    </HeroCard>
  );
}

// ─── Override banner ─────────────────────────────────────────────────────────
export function describeOverride(o: TimingOverride): string {
  const what = o.slot ? MEAL_LABEL[o.slot] : 'Hours';
  const when = formatDateRange(o.starts_on, o.ends_on);
  if (o.is_closed) return `${what} closed · ${when}`;
  return `${what} ${formatWindow(o.opens_at ?? '', o.closes_at ?? '')} · ${when}`;
}

/** Live timing change posted by a secretary or vendor: impossible to miss. */
export function OverrideBanner({ overrides }: { overrides: TimingOverride[] | undefined }) {
  if (!overrides || overrides.length === 0) return null;
  return (
    <View
      accessibilityRole="alert"
      className="flex-row gap-space-md rounded-3xl bg-status-warning-container p-space-md">
      <IconBadge icon={Megaphone} tone="warning" />
      <View className="flex-1 gap-space-xs">
        <Text className="font-label-bold text-label-sm uppercase text-on-status-warning-container">
          Timing changed
        </Text>
        {overrides.map((o) => (
          <View key={o.id}>
            <Text className="font-body-semibold text-body-md text-on-status-warning-container">
              {describeOverride(o)}
            </Text>
            <Text className="font-body text-body-sm text-on-status-warning-container">{o.reason}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Noticeboard photo ───────────────────────────────────────────────────────
export function NoticeboardCard({
  outletId,
  title,
  canReport,
}: {
  outletId: string | null | undefined;
  title: string;
  canReport: boolean;
}) {
  const photo = useCurrentPhoto(outletId);
  const reports = usePhotoReports(canReport ? photo.data?.id : null);
  const report = useReportPhoto();
  const [zoomed, setZoomed] = useState(false);

  if (photo.isPending) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }
  if (!photo.data) {
    return (
      <Card className="flex-row items-center gap-space-md">
        <IconBadge icon={Camera} tone="neutral" />
        <Text className="flex-1 font-body text-body-md text-on-surface-variant">No {title.toLowerCase()} yet.</Text>
      </Card>
    );
  }

  const uri = noticeboardUrl(photo.data.storage_path);
  const age = timeAgo(photo.data.created_at);
  const alreadyReported = (reports.data?.length ?? 0) > 0;
  const aspect = photo.data.width && photo.data.height ? photo.data.width / photo.data.height : 4 / 3;

  return (
    <Card className="gap-space-sm">
      <View className="flex-row items-center gap-space-sm">
        <IconBadge icon={Pin} tone="tertiary" size="sm" />
        <Text className="flex-1 font-body-semibold text-body-md text-on-surface">{title}</Text>
        <Badge label={age} />
      </View>

      <PressableScale
        accessibilityRole="imagebutton"
        accessibilityLabel={`${title}. Tap to zoom.`}
        onPress={() => setZoomed(true)}>
        <View className="overflow-hidden rounded-2xl bg-surface-container-low">
          <Image source={{ uri }} style={{ width: '100%', aspectRatio: aspect }} contentFit="cover" transition={150} />
          <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-inverse-surface/80 px-2.5 py-1">
            <ZoomIn size={14} color={colors['inverse-on-surface']} />
            <Text className="font-label text-label-sm text-inverse-on-surface">Tap to zoom</Text>
          </View>
        </View>
      </PressableScale>

      {canReport ? (
        alreadyReported ? (
          <Text className="self-end font-label text-label-md text-on-surface-variant">Reported — thanks</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={report.isPending}
            onPress={() => report.mutate({ photoId: photo.data!.id, reason: 'outdated' })}
            hitSlop={8}
            className="flex-row items-center gap-1.5 self-end active:opacity-60">
            {report.isPending ? <ActivityIndicator size="small" /> : <Flag size={14} color={colors.primary} />}
            <Text className="font-label-bold text-label-md text-primary">Report outdated</Text>
          </Pressable>
        )
      ) : null}

      <ZoomableImage
        uri={uri}
        visible={zoomed}
        onClose={() => setZoomed(false)}
        caption={`Uploaded ${age}`}
        accessibilityLabel={title}
      />
    </Card>
  );
}

// ─── Weekly menu ─────────────────────────────────────────────────────────────
export function WeeklyMenuCard({ bhawanId }: { bhawanId: string | null | undefined }) {
  const today = istNow();
  const [day, setDay] = useState<DayKey>(today.dayKey);
  const menu = useWeeklyMenu(bhawanId, weekStart(today.date));
  const meals = menu.data?.items[day];

  return (
    <View className="gap-space-sm">
      <SectionHeader title="This week" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {DAY_KEYS.map((key) => (
          <Pill
            key={key}
            label={key === today.dayKey ? 'Today' : DAY_LABEL[key]}
            selected={key === day}
            onPress={() => setDay(key)}
          />
        ))}
      </ScrollView>
      {menu.isPending ? (
        <ActivityIndicator />
      ) : !menu.data ? (
        <Card>
          <Text className="font-body text-body-md text-on-surface-variant">Not published yet — see the noticeboard.</Text>
        </Card>
      ) : (
        MEAL_SLOTS.map((slot) => (
          <Card key={slot} className="flex-row gap-space-md">
            <IconBadge icon={MEAL_ICON[slot]} tone={slot === 'dinner' ? 'primary' : 'tertiary'} />
            <View className="flex-1 gap-space-sm">
              <Text className="font-body-semibold text-body-lg text-on-surface">{MEAL_LABEL[slot]}</Text>
              {meals?.[slot]?.length ? (
                <DishChips dishes={meals[slot]!} />
              ) : (
                <Text className="font-body text-body-sm text-on-surface-variant">—</Text>
              )}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

export function DishChips({ dishes }: { dishes: string[] }) {
  return (
    <View className="flex-row flex-wrap gap-space-xs">
      {dishes.map((dish) => (
        <View key={dish} className="rounded-full bg-surface-container-low px-3 py-1">
          <Text className="font-body text-body-sm text-on-surface">{dish}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Extra items rate card ───────────────────────────────────────────────────
export function ExtraItemsCard({ bhawanId }: { bhawanId: string | null | undefined }) {
  const items = useExtraItems(bhawanId);

  return (
    <View className="gap-space-sm">
      <SectionHeader title="Extras · pay at counter" />
      <Card className="gap-space-xs">
        {items.isPending ? (
          <ActivityIndicator />
        ) : !items.data?.length ? (
          <Text className="font-body text-body-md text-on-surface-variant">No extra items listed.</Text>
        ) : (
          items.data.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-space-sm py-1.5">
              <View className="flex-1">
                <Text
                  className={cn(
                    'font-body-semibold text-body-md',
                    item.available ? 'text-on-surface' : 'text-on-surface-variant line-through',
                  )}>
                  {item.name}
                </Text>
                {item.unit ? (
                  <Text className="font-body text-body-sm text-on-surface-variant">{item.unit}</Text>
                ) : null}
              </View>
              {item.available ? <PriceChip paise={item.price_paise} /> : <Badge label="Unavailable" />}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}
