import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import {
  OUTLET_TYPE_LABEL,
  useFixedRates,
  useMenuItems,
  useOutletStatus,
  type MenuItem,
  type OutletStatus,
} from '@/features/canteens/queries';
import { describeLiveStatus, formatShift, type StatusTone } from '@/features/canteens/status';
import { cn } from '@/lib/cn';
import { formatPaise } from '@/lib/money';
import { formatDateRange, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { colors } from '@/theme/tokens';

// ─── M4.4 OpenStatusPill ─────────────────────────────────────────────────────
const toneClass: Record<StatusTone, { container: string; dot: string; text: string }> = {
  open: { container: 'bg-status-open-container', dot: 'bg-status-open', text: 'text-on-status-open-container' },
  closing: {
    container: 'bg-status-warning-container',
    dot: 'bg-on-status-warning-container',
    text: 'text-on-status-warning-container',
  },
  closed: { container: 'bg-surface-container-high', dot: 'bg-outline', text: 'text-on-surface-variant' },
};

/** "OPEN NOW • Closes at 10:30 PM" / "OPENS AT …" / "CLOSED" (PRD §3B.1). */
export function OpenStatusPill({ status }: { status: OutletStatus | null | undefined }) {
  const now = useNow();
  if (!status) return null;
  const { tone, label } = describeLiveStatus(status, now);
  const style = toneClass[tone];
  return (
    <View
      accessibilityLabel={label}
      className={cn('flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1', style.container)}>
      <View className={cn('h-2 w-2 rounded-full', style.dot)} />
      <Text className={cn('font-label-bold text-label-sm', style.text)}>{label}</Text>
    </View>
  );
}

// ─── Segmented switch (Day/Night, Menu/Rate card) ────────────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row gap-1 rounded-xl bg-surface-container-low p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={cn('flex-1 items-center rounded-lg px-space-sm py-2.5', selected && 'bg-primary-container')}>
            <Text
              className={cn(
                'font-label-bold text-label-md',
                selected ? 'text-on-primary' : 'text-on-surface-variant',
              )}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Outlet header: name, live pill, shift ───────────────────────────────────
export function OutletHeader({ outletId, eyebrow }: { outletId: string; eyebrow?: string }) {
  const status = useOutletStatus(outletId);
  const now = useNow();
  if (status.isPending) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }
  const s = status.data;
  if (!s) return null;

  return (
    <Card className="gap-space-sm">
      <Text className="font-label-bold text-label-sm uppercase text-primary">
        {eyebrow ?? OUTLET_TYPE_LABEL[s.type]}
      </Text>
      <Text className="font-headline text-headline-md text-on-surface">{s.name}</Text>
      <OpenStatusPill status={s} />
      {s.location_tag ? (
        <View className="flex-row items-center gap-space-xs">
          <MaterialIcons name="place" size={16} color={colors['on-surface-variant']} />
          <Text className="font-body text-body-sm text-on-surface-variant">{s.location_tag}</Text>
        </View>
      ) : null}
      <View className="flex-row items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
        <MaterialIcons name="schedule" size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-label-bold text-label-md uppercase text-primary">
            {s.shift_starts_at && s.shift_ends_at
              ? `${Date.parse(s.shift_starts_at) <= now.getTime() ? 'Current shift' : 'Next shift'}: ${formatShift(s.shift_starts_at, s.shift_ends_at)}`
              : 'Hours not published'}
          </Text>
          {s.source === 'manual' && s.status_updated_at ? (
            <Text className="font-body text-body-sm text-on-surface-variant">
              Marked {s.is_open ? 'open' : 'closed'} by staff {timeAgo(s.status_updated_at)}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// ─── Tab 1: custom menu ──────────────────────────────────────────────────────
function groupByCategory(items: MenuItem[]): { category: string; items: MenuItem[] }[] {
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || 'Menu';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([category, grouped]) => ({ category, items: grouped }));
}

export function MenuItemsList({ outletId }: { outletId: string }) {
  const items = useMenuItems(outletId);

  if (items.isPending) return <ActivityIndicator />;
  if (items.isError) return <Text className="font-body text-body-md text-error">{items.error.message}</Text>;
  if (items.data.length === 0) {
    return (
      <Card tone="low">
        <Text className="font-body text-body-md text-on-surface-variant">
          No items listed yet — check the menu photo above.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-space-sm">
      {groupByCategory(items.data).map((group) => (
        <Card key={group.category} className="gap-space-xs">
          <Text className="font-label-bold text-label-md uppercase text-primary">{group.category}</Text>
          {group.items.map((item, index) => (
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
                    item.in_stock ? 'text-on-surface' : 'text-on-surface-variant line-through',
                  )}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text className="font-body text-body-sm text-on-surface-variant">{item.description}</Text>
                ) : null}
              </View>
              {item.in_stock ? (
                <Text className="font-body-bold text-body-md text-on-surface">{formatPaise(item.price_paise)}</Text>
              ) : (
                <Badge label="Sold out" tone="longStanding" />
              )}
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

// ─── Tab 2: Institute Fixed-Rate Card (official, gold) ───────────────────────
export function FixedRateCard({ bhawanId }: { bhawanId: string }) {
  const rates = useFixedRates(bhawanId);

  if (rates.isPending) return <ActivityIndicator />;
  if (rates.isError) return <Text className="font-body text-body-md text-error">{rates.error.message}</Text>;

  const refs = [...new Set(rates.data.map((r) => r.circular_ref).filter((r): r is string => !!r))];
  const effective = rates.data.map((r) => r.effective_from).sort()[0];

  return (
    <View className="gap-space-sm">
      <Card padded={false}>
        <View className="flex-row items-center gap-space-sm rounded-t-xl bg-tertiary-fixed px-space-md py-space-sm">
          <MaterialIcons name="verified" size={20} color={colors['on-tertiary-fixed-variant']} />
          <View className="flex-1">
            <Text className="font-headline text-headline-sm text-on-tertiary-fixed">Institute Fixed-Rate Card</Text>
            <Text className="font-body text-body-sm text-on-tertiary-fixed-variant">
              Ceiling prices — canteens may not charge more.
            </Text>
          </View>
        </View>

        <View className="gap-space-xs p-space-md">
          {rates.data.length === 0 ? (
            <Text className="font-body text-body-md text-on-surface-variant">
              The Bhawan Secretary hasn&apos;t published the rate card yet.
            </Text>
          ) : (
            rates.data.map((item, index) => (
              <View
                key={item.id}
                className={cn(
                  'flex-row items-center justify-between gap-space-sm py-space-xs',
                  index % 2 === 1 && 'rounded-lg bg-surface-container-low px-space-sm',
                )}>
                <View className="flex-1">
                  <Text className="font-body-semibold text-body-md text-on-surface">{item.name}</Text>
                  {item.description ? (
                    <Text className="font-body text-body-sm text-on-surface-variant">{item.description}</Text>
                  ) : null}
                </View>
                <Text className="font-body-bold text-body-md text-tertiary">
                  {formatPaise(item.ceiling_price_paise)} max
                </Text>
              </View>
            ))
          )}
        </View>

        {refs.length > 0 || effective ? (
          <View className="gap-space-xs rounded-b-xl bg-surface-container-low px-space-md py-space-sm">
            {refs.length > 0 ? (
              <Text className="font-label text-label-md text-on-surface-variant">Circular ref: {refs.join(', ')}</Text>
            ) : null}
            {effective ? (
              <Text className="font-label text-label-md text-on-surface-variant">
                Effective from {formatDateRange(effective, effective)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <View className="flex-row items-start gap-space-sm rounded-xl bg-status-warning-container p-space-md">
        <MaterialIcons name="info" size={18} color={colors['on-status-warning-container']} />
        <Text className="flex-1 font-body text-body-sm text-on-status-warning-container">
          Chalkboard and menu prices must never exceed these rates. If you were overcharged, keep your
          UPI receipt and raise a complaint.
        </Text>
      </View>
    </View>
  );
}
