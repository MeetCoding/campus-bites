import { BadgeCheck, Clock, Info, MapPin, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';

import { Badge, Card, HeroCard, LiveDot } from '@/components/ui';
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
import { formatDateRange } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { colors } from '@/theme/tokens';

// ─── M4.4 OpenStatusPill ─────────────────────────────────────────────────────
const toneClass: Record<StatusTone, { container: string; text: string }> = {
  open: { container: 'bg-status-open-container', text: 'text-on-status-open-container' },
  closing: { container: 'bg-status-warning-container', text: 'text-on-status-warning-container' },
  closed: { container: 'bg-surface-container-high', text: 'text-on-surface-variant' },
};

/** "OPEN NOW • Closes at 10:30 PM" / "OPENS AT …" / "CLOSED" (PRD §3B.1), with a live dot. */
export function OpenStatusPill({ status }: { status: OutletStatus | null | undefined }) {
  const now = useNow();
  if (!status) return null;
  const { tone, label } = describeLiveStatus(status, now);
  const style = toneClass[tone];
  return (
    <View
      accessibilityLabel={label}
      className={cn('flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1', style.container)}>
      {tone === 'closed' ? (
        <View className="h-2 w-2 rounded-full bg-outline" />
      ) : (
        <LiveDot tone={tone === 'open' ? 'open' : 'warning'} />
      )}
      <Text className={cn('font-label-bold text-label-sm', style.text)}>{label}</Text>
    </View>
  );
}

// ─── Outlet hero: name, live pill, shift / location ──────────────────────────
export function OutletHeader({ outletId }: { outletId: string }) {
  const status = useOutletStatus(outletId);
  if (status.isPending) {
    return (
      <HeroCard>
        <ActivityIndicator color={colors['on-primary']} />
      </HeroCard>
    );
  }
  const s = status.data;
  if (!s) return null;

  return (
    <HeroCard>
      <Text className="font-label-bold text-label-sm uppercase text-on-primary-container">
        {OUTLET_TYPE_LABEL[s.type]}
      </Text>
      <Text className="font-headline text-headline-lg-mobile text-on-primary">{s.name}</Text>
      <OpenStatusPill status={s} />
      {s.shift_starts_at || s.location_tag ? (
        <View className="mt-space-xs flex-row flex-wrap gap-space-sm">
          {s.shift_starts_at && s.shift_ends_at ? (
            <HeroTag icon={Clock} label={formatShift(s.shift_starts_at, s.shift_ends_at)} />
          ) : null}
          {s.location_tag ? <HeroTag icon={MapPin} label={s.location_tag} /> : null}
        </View>
      ) : null}
    </HeroCard>
  );
}

function HeroTag({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-on-primary/10 px-3 py-1.5">
      <Icon size={14} color={colors['on-primary-container']} />
      <Text className="font-label text-label-md text-on-primary">{label}</Text>
    </View>
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
      <Card>
        <Text className="font-body text-body-md text-on-surface-variant">No items listed yet.</Text>
      </Card>
    );
  }

  return (
    <View className="gap-space-sm">
      {groupByCategory(items.data).map((group) => (
        <Card key={group.category} className="gap-space-xs">
          <Text className="font-label-bold text-label-sm uppercase text-on-surface-variant">{group.category}</Text>
          {group.items.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-space-sm py-1.5">
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
                <PriceChip paise={item.price_paise} />
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

export function PriceChip({ paise, official = false }: { paise: number; official?: boolean }) {
  return (
    <View className={cn('rounded-full px-3 py-1', official ? 'bg-tertiary/10' : 'bg-primary/10')}>
      <Text className={cn('font-body-bold text-body-sm', official ? 'text-tertiary' : 'text-primary')}>
        {formatPaise(paise)}
      </Text>
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
  const footer = [refs.length > 0 ? `Ref ${refs.join(', ')}` : null, effective ? `From ${formatDateRange(effective, effective)}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="gap-space-sm">
      <Card padded={false} className="overflow-hidden">
        <View className="flex-row items-center gap-space-sm bg-tertiary-fixed p-space-md">
          <BadgeCheck size={22} color={colors['on-tertiary-fixed-variant']} />
          <View className="flex-1">
            <Text className="font-headline text-headline-sm text-on-tertiary-fixed">Institute Rate Card</Text>
            <Text className="font-label text-label-md text-on-tertiary-fixed-variant">Maximum prices</Text>
          </View>
        </View>

        <View className="gap-space-xs p-space-md">
          {rates.data.length === 0 ? (
            <Text className="font-body text-body-md text-on-surface-variant">Not published yet.</Text>
          ) : (
            rates.data.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between gap-space-sm py-1.5">
                <View className="flex-1">
                  <Text className="font-body-semibold text-body-md text-on-surface">{item.name}</Text>
                  {item.description ? (
                    <Text className="font-body text-body-sm text-on-surface-variant">{item.description}</Text>
                  ) : null}
                </View>
                <PriceChip paise={item.ceiling_price_paise} official />
              </View>
            ))
          )}
        </View>

        {footer ? (
          <View className="bg-surface-container-low px-space-md py-space-sm">
            <Text className="font-label text-label-sm text-on-surface-variant">{footer}</Text>
          </View>
        ) : null}
      </Card>

      <View className="flex-row items-center gap-space-sm rounded-2xl bg-status-warning-container px-space-md py-space-sm">
        <Info size={16} color={colors['on-status-warning-container']} />
        <Text className="flex-1 font-body text-body-sm text-on-status-warning-container">
          Charged more? Keep the UPI receipt and report it.
        </Text>
      </View>
    </View>
  );
}
