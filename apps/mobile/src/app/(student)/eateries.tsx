import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { ChevronRight, Coffee, MapPin, Moon, Search, Sun, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Badge, Card, IconBadge, PressableScale, Screen, Segmented } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { OpenStatusPill, PriceChip } from '@/features/canteens/components';
import {
  OUTLET_TYPE_LABEL,
  useFoodSearch,
  useLiveStatus,
  useLiveUpdates,
  type OutletStatus,
  type SearchHit,
} from '@/features/canteens/queries';
import { useCurrentPhoto } from '@/features/mess/queries';
import { noticeboardUrl } from '@/lib/images';
import { colors } from '@/theme/tokens';

type Tab = 'bhawan' | 'eateries';

function outletHref(hit: { outlet_id: string; outlet_type: SearchHit['outlet_type'] }): Href {
  return hit.outlet_type === 'eatery'
    ? { pathname: '/eatery/[id]', params: { id: hit.outlet_id } }
    : { pathname: '/canteens', params: { outlet: hit.outlet_id } };
}

/** Food directory: my Bhawan's canteens, campus eateries, and food search across both (TASKS M4.9). */
export default function EateriesDirectory() {
  const { claims } = useSession();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('eateries');
  const status = useLiveStatus();
  const search = useFoodSearch(query);
  useLiveUpdates();

  const searching = query.trim().length >= 2;
  const outlets =
    status.data?.filter((s) => (tab === 'eateries' ? s.type === 'eatery' : s.bhawan_id === claims?.bhawan_id && s.type !== 'mess')) ??
    [];

  return (
    <Screen>
      <View className="min-h-12 flex-row items-center gap-space-sm rounded-full bg-surface-container-lowest px-space-md">
        <Search size={18} color={colors.outline} />
        <TextInput
          accessibilityLabel="Search food or outlets"
          placeholder="Search maggi, cold coffee, Amul…"
          placeholderTextColor={colors.outline}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          className="min-h-12 flex-1 font-body text-body-lg text-on-surface"
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery('')}>
            <X size={18} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        <View className="gap-space-sm">
          {search.isPending ? (
            <ActivityIndicator />
          ) : search.isError ? (
            <Text className="font-body text-body-md text-error">{search.error.message}</Text>
          ) : search.data.length === 0 ? (
            <Text className="font-body text-body-md text-on-surface-variant">Nothing matches “{query.trim()}”.</Text>
          ) : (
            search.data.map((hit) => (
              <Link key={`${hit.outlet_id}-${hit.item_id ?? 'outlet'}`} href={outletHref(hit)} asChild>
                <PressableScale accessibilityRole="link">
                  <Card className="flex-row items-center gap-space-md">
                    <View className="flex-1 gap-space-xs">
                      <Text className="font-body-semibold text-body-md text-on-surface">
                        {hit.item_name ?? hit.outlet_name}
                      </Text>
                      <Text className="font-label text-label-md text-on-surface-variant">
                        {hit.item_id ? hit.outlet_name : OUTLET_TYPE_LABEL[hit.outlet_type]}
                      </Text>
                    </View>
                    {hit.item_id === null ? (
                      <ChevronRight size={20} color={colors.outline} />
                    ) : hit.in_stock ? (
                      <PriceChip paise={hit.price_paise ?? 0} />
                    ) : (
                      <Badge label="Sold out" tone="longStanding" />
                    )}
                  </Card>
                </PressableScale>
              </Link>
            ))
          )}
        </View>
      ) : (
        <View className="gap-space-sm">
          <Segmented
            options={[
              { value: 'bhawan', label: 'My Bhawan' },
              { value: 'eateries', label: 'Campus eateries' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {status.isPending ? (
            <ActivityIndicator />
          ) : status.isError ? (
            <Text className="font-body text-body-md text-error">{status.error.message}</Text>
          ) : (
            outlets.map((o) => <DirectoryCard key={o.outlet_id} outlet={o} />)
          )}
        </View>
      )}
    </Screen>
  );
}

/** Photo thumbnail (latest menu photo) + name + live pill + one tag. */
function DirectoryCard({ outlet }: { outlet: OutletStatus }) {
  const photo = useCurrentPhoto(outlet.outlet_id);
  const fallback = outlet.type === 'day_canteen' ? Sun : outlet.type === 'night_canteen' ? Moon : Coffee;
  const name = outlet.type === 'eatery' ? outlet.name : OUTLET_TYPE_LABEL[outlet.type];

  return (
    <Link href={outletHref({ outlet_id: outlet.outlet_id, outlet_type: outlet.type })} asChild>
      <PressableScale accessibilityRole="link">
        <Card className="flex-row items-center gap-space-md p-space-sm">
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-surface-container-low">
            {photo.data ? (
              <Image
                source={{ uri: noticeboardUrl(photo.data.storage_path) }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <IconBadge icon={fallback} tone={outlet.type === 'eatery' ? 'tertiary' : 'primary'} />
            )}
          </View>
          <View className="flex-1 gap-1.5">
            <Text numberOfLines={1} className="font-body-semibold text-body-lg text-on-surface">
              {name}
            </Text>
            <OpenStatusPill status={outlet} />
            {outlet.location_tag ? (
              <View className="flex-row items-center gap-1">
                <MapPin size={12} color={colors['on-surface-variant']} />
                <Text numberOfLines={1} className="font-label text-label-md text-on-surface-variant">
                  {outlet.location_tag}
                </Text>
              </View>
            ) : null}
          </View>
          <ChevronRight size={20} color={colors.outline} />
        </Card>
      </PressableScale>
    </Link>
  );
}
