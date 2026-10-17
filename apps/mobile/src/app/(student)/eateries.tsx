import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Badge, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import { OpenStatusPill } from '@/features/canteens/components';
import {
  OUTLET_TYPE_LABEL,
  useFoodSearch,
  useLiveStatus,
  useLiveUpdates,
  type SearchHit,
} from '@/features/canteens/queries';
import { formatPaise } from '@/lib/money';
import { colors } from '@/theme/tokens';

function outletHref(hit: { outlet_id: string; outlet_type: SearchHit['outlet_type'] }): Href {
  return hit.outlet_type === 'eatery'
    ? { pathname: '/eatery/[id]', params: { id: hit.outlet_id } }
    : { pathname: '/canteens', params: { outlet: hit.outlet_id } };
}

/** Campus eateries directory + food search across every canteen and eatery (TASKS M4.9). */
export default function EateriesDirectory() {
  const [query, setQuery] = useState('');
  const status = useLiveStatus();
  const search = useFoodSearch(query);
  useLiveUpdates();

  const searching = query.trim().length >= 2;
  const eateries = status.data?.filter((s) => s.type === 'eatery') ?? [];

  return (
    <Screen>
      <TextField
        label="Search food or outlets"
        placeholder="e.g. maggi, cold coffee, Amul"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />

      {searching ? (
        <View className="gap-space-sm">
          <SectionHeader title="Results" />
          {search.isPending ? (
            <ActivityIndicator />
          ) : search.isError ? (
            <Text className="font-body text-body-md text-error">{search.error.message}</Text>
          ) : search.data.length === 0 ? (
            <Text className="font-body text-body-md text-on-surface-variant">
              Nothing matches “{query.trim()}” on any listed menu.
            </Text>
          ) : (
            search.data.map((hit) => {
              const live = status.data?.find((s) => s.outlet_id === hit.outlet_id);
              return (
                <Link key={`${hit.outlet_id}-${hit.item_id ?? 'outlet'}`} href={outletHref(hit)} asChild>
                  <Pressable accessibilityRole="link" className="active:opacity-80">
                    <Card className="gap-space-xs">
                      <View className="flex-row items-center justify-between gap-space-sm">
                        <Text className="flex-1 font-body-semibold text-body-md text-on-surface">
                          {hit.item_name ?? hit.outlet_name}
                        </Text>
                        {hit.item_id === null ? null : hit.in_stock ? (
                          <Text className="font-body-bold text-body-md text-on-surface">
                            {formatPaise(hit.price_paise ?? 0)}
                          </Text>
                        ) : (
                          <Badge label="Sold out" tone="longStanding" />
                        )}
                      </View>
                      <Text className="font-body text-body-sm text-on-surface-variant">
                        {hit.item_id ? `${hit.outlet_name} · ` : ''}
                        {OUTLET_TYPE_LABEL[hit.outlet_type]}
                      </Text>
                      <OpenStatusPill status={live} />
                    </Card>
                  </Pressable>
                </Link>
              );
            })
          )}
        </View>
      ) : (
        <View className="gap-space-sm">
          <SectionHeader title="Campus eateries" />
          {status.isPending ? (
            <ActivityIndicator />
          ) : status.isError ? (
            <Text className="font-body text-body-md text-error">{status.error.message}</Text>
          ) : (
            eateries.map((e) => (
              <Link key={e.outlet_id} href={{ pathname: '/eatery/[id]', params: { id: e.outlet_id } }} asChild>
                <Pressable accessibilityRole="link" className="active:opacity-80">
                  <Card className="flex-row items-center gap-space-md">
                    <MaterialIcons name="local-cafe" size={24} color={colors.primary} />
                    <View className="flex-1 gap-space-xs">
                      <Text className="font-body-semibold text-body-lg text-on-surface">{e.name}</Text>
                      {e.location_tag ? (
                        <Text className="font-body text-body-sm text-on-surface-variant">{e.location_tag}</Text>
                      ) : null}
                      <OpenStatusPill status={e} />
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
                  </Card>
                </Pressable>
              </Link>
            ))
          )}
          <Text className="font-body text-body-sm text-on-surface-variant">
            Search also covers every hostel canteen menu.
          </Text>
        </View>
      )}
    </Screen>
  );
}
