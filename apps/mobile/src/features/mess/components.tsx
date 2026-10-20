import { Image } from 'expo-image';
import { Camera, Flag, Megaphone, Moon, Pin, Sun, Sunrise, Trash2, ZoomIn, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { Badge, Card, HeroCard, IconBadge, LiveDot, PressableScale, SectionHeader } from '@/components/ui';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import {
  MEAL_LABEL,
  MEAL_SLOTS,
  useDeleteMenuPhoto,
  useMenuPhotoLimit,
  useMenuPhotos,
  usePhotoReports,
  useReportPhoto,
  type MealSlot,
  type MenuPhoto,
  type PhotoKind,
  type ScheduleRow,
  type TimingOverride,
} from '@/features/mess/queries';
import { cn } from '@/lib/cn';
import { noticeboardUrl } from '@/lib/images';
import { currentMeal, formatDateRange, formatDuration, formatTime, formatWindow, istNow, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { colors } from '@/theme/tokens';

export const MEAL_ICON: Record<MealSlot, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
};

// ─── Live meal hero ──────────────────────────────────────────────────────────
/**
 * "What's cooking right now": the serving (or next) meal in IST, a countdown and a strip of
 * today's three windows. The menu itself is the noticeboard photo stack.
 */
export function MealHero({
  schedule,
  loading,
  eyebrow,
}: {
  schedule: ScheduleRow[] | undefined;
  loading?: boolean;
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

// ─── Noticeboard / menu photo stack ──────────────────────────────────────────
/** Published photos of an outlet, newest first: swipe (or tap a dot) between them, tap to zoom. */
export function NoticeboardCard({
  outletId,
  title,
  canReport,
  kind = 'menu',
  emptyText,
}: {
  outletId: string | null | undefined;
  title: string;
  canReport: boolean;
  kind?: PhotoKind;
  emptyText?: string;
}) {
  const photos = useMenuPhotos(outletId, kind);
  const report = useReportPhoto();
  const pager = useRef<ScrollViewInstance>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const list = photos.data ?? [];
  const current = list[Math.min(index, list.length - 1)];
  const reports = usePhotoReports(canReport ? current?.id : null);

  if (photos.isPending) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }
  if (!current) {
    return (
      <Card className="flex-row items-center gap-space-md">
        <IconBadge icon={Camera} tone="neutral" />
        <Text className="flex-1 font-body text-body-md text-on-surface-variant">
          {emptyText ?? `No ${title.toLowerCase()} photo yet.`}
        </Text>
      </Card>
    );
  }

  const age = timeAgo(current.created_at);
  const alreadyReported = (reports.data?.length ?? 0) > 0;
  // One frame for the whole stack (the newest photo's shape); other photos fit inside it uncropped.
  const newest = list[0];
  const aspect = newest.width && newest.height ? newest.width / newest.height : 4 / 3;

  function goTo(next: number) {
    setIndex(next);
    pager.current?.scrollTo({ x: next * frameWidth, animated: true });
  }

  return (
    <Card className="gap-space-sm">
      <View className="flex-row items-center gap-space-sm">
        <IconBadge icon={Pin} tone="tertiary" size="sm" />
        <Text className="flex-1 font-body-semibold text-body-md text-on-surface">{title}</Text>
        <Badge label={age} />
      </View>

      <View
        className="overflow-hidden rounded-2xl bg-surface-container-low"
        onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            if (frameWidth > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / frameWidth));
          }}>
          {list.map((photo, i) => (
            <PressableScale
              key={photo.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${title}, photo ${i + 1} of ${list.length}. Tap to zoom.`}
              onPress={() => setZoomed(true)}>
              <Image
                source={{ uri: noticeboardUrl(photo.storage_path) }}
                style={{ width: frameWidth || 1, aspectRatio: aspect }}
                contentFit={i === 0 ? 'cover' : 'contain'}
                transition={150}
              />
            </PressableScale>
          ))}
        </ScrollView>
        <View
          pointerEvents="none"
          className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-inverse-surface/80 px-2.5 py-1">
          <ZoomIn size={14} color={colors['inverse-on-surface']} />
          <Text className="font-label text-label-sm text-inverse-on-surface">
            {list.length > 1 ? `${index + 1} / ${list.length} · ` : ''}Tap to zoom
          </Text>
        </View>
      </View>

      {list.length > 1 ? (
        <View className="flex-row justify-center gap-2">
          {list.map((photo, i) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`Show photo ${i + 1}`}
              accessibilityState={{ selected: i === index }}
              hitSlop={8}
              onPress={() => goTo(i)}
              className={cn('h-2 rounded-full', i === index ? 'w-5 bg-primary' : 'w-2 bg-outline-variant')}
            />
          ))}
        </View>
      ) : null}

      {canReport ? (
        alreadyReported ? (
          <Text className="self-end font-label text-label-md text-on-surface-variant">Reported — thanks</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={report.isPending}
            onPress={() => report.mutate({ photoId: current.id, reason: 'outdated' })}
            hitSlop={8}
            className="flex-row items-center gap-1.5 self-end active:opacity-60">
            {report.isPending ? <ActivityIndicator size="small" /> : <Flag size={14} color={colors.primary} />}
            <Text className="font-label-bold text-label-md text-primary">Report outdated</Text>
          </Pressable>
        )
      ) : null}

      <ZoomableImage
        uri={noticeboardUrl(current.storage_path)}
        visible={zoomed}
        onClose={() => setZoomed(false)}
        caption={`Uploaded ${age}`}
        accessibilityLabel={title}
      />
    </Card>
  );
}

/** Room left in an outlet's photo stack (app_settings.max_menu_photos). */
export function useMenuPhotoStack(outletId: string | null | undefined, kind: PhotoKind = 'menu') {
  const photos = useMenuPhotos(outletId, kind);
  const limit = useMenuPhotoLimit();
  const count = photos.data?.length ?? 0;
  return { photos, limit: limit.data, count, full: limit.data !== undefined && count >= limit.data };
}

/** Manager view of the stack: every published photo with its reports, zoom and delete. */
export function MenuPhotoStackEditor({ outletId, kind = 'menu' }: { outletId: string; kind?: PhotoKind }) {
  const { photos, limit, count } = useMenuPhotoStack(outletId, kind);
  const remove = useDeleteMenuPhoto();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<MenuPhoto | null>(null);

  if (photos.isPending) return <ActivityIndicator />;
  const list = photos.data ?? [];

  return (
    <View className="gap-space-sm">
      <SectionHeader title={`Published photos${limit ? ` · ${count} of ${limit}` : ''}`} />
      {list.length === 0 ? (
        <Card tone="low">
          <Text className="font-body text-body-md text-on-surface-variant">Nothing published yet.</Text>
        </Card>
      ) : (
        <View className="flex-row flex-wrap gap-space-sm">
          {list.map((photo, i) => (
            <View key={photo.id} className="w-[48.5%] gap-space-xs rounded-2xl bg-surface-container-lowest p-space-xs">
              <PressableScale
                accessibilityRole="imagebutton"
                accessibilityLabel={`Photo ${i + 1}. Tap to zoom.`}
                onPress={() => setZoomed(photo)}>
                <View className="overflow-hidden rounded-xl bg-surface-container-low">
                  <Image
                    source={{ uri: noticeboardUrl(photo.storage_path) }}
                    style={{ width: '100%', aspectRatio: 3 / 4 }}
                    contentFit="cover"
                    transition={150}
                  />
                  {i === 0 ? (
                    <View className="absolute left-1.5 top-1.5">
                      <Badge label="Newest" tone="official" />
                    </View>
                  ) : null}
                </View>
              </PressableScale>
              <View className="flex-row flex-wrap items-center gap-1 px-1">
                <Text className="font-label text-label-md text-on-surface-variant">{timeAgo(photo.created_at)}</Text>
                <PhotoReportCount photoId={photo.id} />
              </View>
              {confirming === photo.id ? (
                <View className="flex-row gap-space-xs">
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirming(null)}
                    className="flex-1 items-center rounded-full bg-surface-container-high py-2 active:opacity-60">
                    <Text className="font-label-bold text-label-md text-on-surface">Keep</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Confirm delete photo"
                    disabled={remove.isPending}
                    onPress={() => remove.mutate(photo, { onSettled: () => setConfirming(null) })}
                    className="flex-1 items-center rounded-full bg-error py-2 active:opacity-60">
                    {remove.isPending && remove.variables?.id === photo.id ? (
                      <ActivityIndicator size="small" color={colors['on-error']} />
                    ) : (
                      <Text className="font-label-bold text-label-md text-on-error">Delete</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete photo ${i + 1}`}
                  onPress={() => setConfirming(photo.id)}
                  hitSlop={6}
                  className="flex-row items-center justify-center gap-1.5 py-1.5 active:opacity-60">
                  <Trash2 size={14} color={colors.error} />
                  <Text className="font-label-bold text-label-md text-error">Delete</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      {remove.isError ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {remove.error.message}
        </Text>
      ) : null}

      <ZoomableImage
        uri={zoomed ? noticeboardUrl(zoomed.storage_path) : ''}
        visible={zoomed !== null}
        onClose={() => setZoomed(null)}
        caption={zoomed ? `Uploaded ${timeAgo(zoomed.created_at)}` : undefined}
        accessibilityLabel="Published photo"
      />
    </View>
  );
}

function PhotoReportCount({ photoId }: { photoId: string }) {
  const reports = usePhotoReports(photoId);
  const n = reports.data?.length ?? 0;
  return n > 0 ? <Badge label={`${n} report${n === 1 ? '' : 's'}`} tone="longStanding" /> : null;
}

