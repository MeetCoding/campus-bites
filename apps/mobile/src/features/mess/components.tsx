import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Button, Card, Pill, SectionHeader } from '@/components/ui';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import {
  MEAL_LABEL,
  MEAL_SLOTS,
  useCurrentPhoto,
  useExtraItems,
  usePhotoReports,
  useReportPhoto,
  useWeeklyMenu,
  type ScheduleRow,
  type TimingOverride,
} from '@/features/mess/queries';
import { cn } from '@/lib/cn';
import { noticeboardUrl } from '@/lib/images';
import { formatPaise } from '@/lib/money';
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

// ─── Live status ─────────────────────────────────────────────────────────────
export function MealStatusCard({
  title,
  schedule,
  loading,
}: {
  title: string;
  schedule: ScheduleRow[] | undefined;
  loading?: boolean;
}) {
  const now = istNow(useNow());
  if (loading || !schedule) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }
  const { serving, next, minutesLeft } = currentMeal(schedule, now.minutes);

  return (
    <Card className="gap-space-sm">
      <View className="flex-row items-center justify-between gap-space-sm">
        <Text className="flex-1 font-label-bold text-label-md text-primary">{title}</Text>
        {serving ? (
          <Badge label={`Serving ${MEAL_LABEL[serving.slot]}`} tone="open" />
        ) : (
          <Badge label="Not serving" />
        )}
      </View>
      {serving ? (
        <Text className="font-body text-body-md text-on-surface">
          {formatWindow(serving.opens_at, serving.closes_at)} · closes in{' '}
          {formatDuration(minutesLeft ?? 0)}
        </Text>
      ) : next ? (
        <Text className="font-body text-body-md text-on-surface">
          Next: {MEAL_LABEL[next.slot]} at {formatTime(next.opens_at)} (in {formatDuration(minutesLeft ?? 0)})
        </Text>
      ) : (
        <Text className="font-body text-body-md text-on-surface">No more meals today.</Text>
      )}
      <View className="flex-row gap-space-sm">
        {MEAL_SLOTS.map((slot) => {
          const row = schedule.find((r) => r.slot === slot);
          if (!row) return null;
          return (
            <View key={slot} className="flex-1 rounded-lg bg-surface-container-low p-space-sm">
              <Text className="font-label text-label-sm uppercase text-on-surface-variant">
                {MEAL_LABEL[slot]}
              </Text>
              <Text
                className={cn(
                  'font-body-semibold text-body-sm',
                  row.is_closed ? 'text-error' : 'text-on-surface',
                )}>
                {row.is_closed ? 'Closed' : `${formatTime(row.opens_at)}–${formatTime(row.closes_at)}`}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ─── Override banner ─────────────────────────────────────────────────────────
export function describeOverride(o: TimingOverride): string {
  const what = o.slot ? MEAL_LABEL[o.slot] : 'Hours';
  const when = formatDateRange(o.starts_on, o.ends_on);
  if (o.is_closed) return `${what} closed · ${when}`;
  return `${what} ${formatWindow(o.opens_at ?? '', o.closes_at ?? '')} · ${when}`;
}

export function OverrideBanner({ overrides }: { overrides: TimingOverride[] | undefined }) {
  if (!overrides || overrides.length === 0) return null;
  return (
    <View className="gap-space-xs rounded-xl bg-status-warning-container p-space-md" accessibilityRole="alert">
      <View className="flex-row items-center gap-space-xs">
        <MaterialIcons name="warning" size={18} color={colors['on-status-warning-container']} />
        <Text className="font-label-bold text-label-md uppercase text-on-status-warning-container">
          Special schedule
        </Text>
      </View>
      {overrides.map((o) => (
        <Text key={o.id} className="font-body-semibold text-body-sm text-on-status-warning-container">
          {describeOverride(o)} <Text className="font-body">({o.reason})</Text>
        </Text>
      ))}
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
      <Card tone="low" className="items-center gap-space-xs py-space-lg">
        <MaterialIcons name="photo-camera" size={28} color={colors.outline} />
        <Text className="font-body text-body-md text-on-surface-variant">
          No noticeboard photo uploaded yet.
        </Text>
      </Card>
    );
  }

  const uri = noticeboardUrl(photo.data.storage_path);
  const caption = `Uploaded ${timeAgo(photo.data.created_at)}`;
  const alreadyReported = (reports.data?.length ?? 0) > 0;
  const aspect = photo.data.width && photo.data.height ? photo.data.width / photo.data.height : 4 / 3;

  return (
    <Card padded={false} className="gap-space-sm">
      <View className="flex-row items-center justify-between rounded-t-xl bg-inverse-surface px-space-md py-space-sm">
        <View className="flex-row items-center gap-space-xs">
          <MaterialIcons name="push-pin" size={16} color={colors['inverse-on-surface']} />
          <Text className="font-label-bold text-label-md text-inverse-on-surface">{title}</Text>
        </View>
        <Badge label="Signed notice" tone="official" />
      </View>

      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${title}. Tap to zoom.`}
        onPress={() => setZoomed(true)}
        className="mx-space-md overflow-hidden rounded-lg bg-surface-container-low active:opacity-90">
        <Image source={{ uri }} style={{ width: '100%', aspectRatio: aspect }} contentFit="cover" transition={150} />
        <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-inverse-surface/80 px-2 py-1">
          <MaterialIcons name="zoom-in" size={14} color={colors['inverse-on-surface']} />
          <Text className="font-label text-label-sm text-inverse-on-surface">Tap to zoom</Text>
        </View>
      </Pressable>

      <View className="flex-row items-center justify-between px-space-md pb-space-md">
        <Text className="font-body text-body-sm text-on-surface-variant">{caption}</Text>
        {canReport ? (
          alreadyReported ? (
            <Text className="font-label text-label-md text-on-surface-variant">Reported — thanks</Text>
          ) : (
            <Button
              label="Report outdated"
              variant="tertiary"
              loading={report.isPending}
              onPress={() => report.mutate({ photoId: photo.data!.id, reason: 'outdated' })}
            />
          )
        ) : null}
      </View>

      <ZoomableImage
        uri={uri}
        visible={zoomed}
        onClose={() => setZoomed(false)}
        caption={caption}
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
      <SectionHeader title="This week's menu" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {DAY_KEYS.map((key) => (
          <Pill
            key={key}
            label={key === today.dayKey ? `${DAY_LABEL[key]} · Today` : DAY_LABEL[key]}
            selected={key === day}
            onPress={() => setDay(key)}
          />
        ))}
      </ScrollView>
      {menu.isPending ? (
        <ActivityIndicator />
      ) : !menu.data ? (
        <Card tone="low">
          <Text className="font-body text-body-md text-on-surface-variant">
            The Mess Secretary hasn&apos;t published this week&apos;s menu yet. Check the noticeboard photo.
          </Text>
        </Card>
      ) : (
        MEAL_SLOTS.map((slot) => (
          <Card key={slot} className="gap-space-xs">
            <Text className="font-label-bold text-label-md uppercase text-primary">{MEAL_LABEL[slot]}</Text>
            <Text className="font-body text-body-md text-on-surface">
              {meals?.[slot]?.length ? meals[slot]!.join(' · ') : '—'}
            </Text>
          </Card>
        ))
      )}
    </View>
  );
}

// ─── Extra items rate card ───────────────────────────────────────────────────
export function ExtraItemsCard({ bhawanId }: { bhawanId: string | null | undefined }) {
  const items = useExtraItems(bhawanId);

  return (
    <View className="gap-space-sm">
      <SectionHeader title="Extra items (pay-to-get)" />
      <Card className="gap-space-sm">
        {items.isPending ? (
          <ActivityIndicator />
        ) : !items.data?.length ? (
          <Text className="font-body text-body-md text-on-surface-variant">No extra items listed.</Text>
        ) : (
          items.data.map((item, index) => (
            <View
              key={item.id}
              className={cn(
                'flex-row items-center justify-between gap-space-sm py-space-xs',
                index % 2 === 1 && 'rounded-lg bg-surface-container-low px-space-sm',
              )}>
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
              {item.available ? (
                <Text className="font-body-bold text-body-md text-on-surface">{formatPaise(item.price_paise)}</Text>
              ) : (
                <Badge label="Unavailable" />
              )}
            </View>
          ))
        )}
        <Text className="font-body text-body-sm text-on-surface-variant">
          Pay at the mess counter. In-app payment isn&apos;t available.
        </Text>
      </Card>
    </View>
  );
}
