import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Pill, Screen, SectionHeader } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { REBATE_STATUS_LABEL, RebateStatusBadge } from '@/features/rebates/components';
import { useRebateQueue, type RebateStatus } from '@/features/rebates/queries';
import { formatDateRange, timeAgo } from '@/lib/time';
import { colors } from '@/theme/tokens';

type Filter = RebateStatus | 'all';
const FILTERS: Filter[] = ['pending_verification', 'biometric_cross_checked', 'approved', 'rejected', 'all'];

/** Mess Authority rebate queue (TASKS M5.5); ADoSW complaint queues arrive in M6. */
export default function AuthorityHome() {
  const { claims } = useSession();
  const bhawans = useBhawans();
  const isMessAuthority = claims?.roles.includes('mess_authority') ?? false;
  const isAdosw = claims?.roles.includes('adosw') ?? false;

  return (
    <Screen>
      <View className="gap-space-xs pt-space-md">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">Authority</Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">Review desk</Text>
        <Text className="font-body text-body-md text-on-surface-variant">
          {bhawans.data
            ?.filter((b) => claims?.scope_bhawan_ids.includes(b.id))
            .map((b) => b.name)
            .join(', ') || (isAdosw ? 'Campus eateries (ADoSW)' : '')}
        </Text>
      </View>

      {isMessAuthority ? <RebateQueue /> : null}

      {isAdosw ? (
        <Card tone="low">
          <Text className="font-body text-body-sm text-on-surface-variant">
            Eatery complaint queues arrive with the Complaints milestone.
          </Text>
        </Card>
      ) : null}

      <AccountPanel />
    </Screen>
  );
}

function RebateQueue() {
  const queue = useRebateQueue();
  const bhawans = useBhawans();
  const [filter, setFilter] = useState<Filter>('pending_verification');
  const [bhawanId, setBhawanId] = useState<string | 'all'>('all');

  const inScope = [...new Set(queue.data?.map((r) => r.bhawan_id) ?? [])];
  const rows =
    queue.data?.filter(
      (r) => (filter === 'all' || r.status === filter) && (bhawanId === 'all' || r.bhawan_id === bhawanId),
    ) ?? [];
  const count = (status: RebateStatus) => queue.data?.filter((r) => r.status === status).length ?? 0;
  const bhawanName = (id: string) => bhawans.data?.find((b) => b.id === id)?.name ?? '';

  return (
    <View className="gap-space-sm">
      <SectionHeader title="Mess rebates" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {FILTERS.map((f) => (
          <Pill
            key={f}
            label={f === 'all' ? 'All' : `${REBATE_STATUS_LABEL[f]} (${count(f)})`}
            selected={f === filter}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>
      {inScope.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
          <Pill label="All Bhawans" selected={bhawanId === 'all'} onPress={() => setBhawanId('all')} />
          {inScope.map((id) => (
            <Pill key={id} label={bhawanName(id)} selected={bhawanId === id} onPress={() => setBhawanId(id)} />
          ))}
        </ScrollView>
      ) : null}

      {queue.isPending ? (
        <ActivityIndicator />
      ) : queue.isError ? (
        <Text className="font-body text-body-md text-error">{queue.error.message}</Text>
      ) : rows.length === 0 ? (
        <Text className="font-body text-body-md text-on-surface-variant">Nothing here.</Text>
      ) : (
        rows.map((r) => (
          <Link key={r.id} href={{ pathname: '/rebate/[id]', params: { id: r.id } }} asChild>
            <Pressable accessibilityRole="link" className="active:opacity-80">
              <Card className="flex-row items-center gap-space-sm">
                <View className="flex-1 gap-space-xs">
                  <Text className="font-body-semibold text-body-md text-on-surface">
                    {r.student_name ?? r.student_email ?? 'Student'}
                  </Text>
                  <Text className="font-body text-body-sm text-on-surface-variant">
                    {formatDateRange(r.start_date, r.end_date)} · {r.days} days
                    {inScope.length > 1 ? ` · ${bhawanName(r.bhawan_id)}` : ''} · applied {timeAgo(r.created_at)}
                  </Text>
                  <RebateStatusBadge status={r.status} />
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
              </Card>
            </Pressable>
          </Link>
        ))
      )}
    </View>
  );
}
