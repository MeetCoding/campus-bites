import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Card, Pill, SectionHeader } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { ComplaintCard } from '@/features/complaints/components';
import { isLongStanding, type ComplaintDomain } from '@/features/complaints/logic';
import { useComplaintRules, useComplaintsLive, useVisibleComplaints, type Complaint } from '@/features/complaints/queries';
import { useNow } from '@/lib/useNow';

type Filter = 'active' | 'long' | 'awaiting' | 'resolved';
const FILTER_LABEL: Record<Filter, string> = {
  active: 'Needs action',
  long: 'Long-standing',
  awaiting: 'Awaiting student',
  resolved: 'Resolved',
};

/**
 * Handler / oversight queue (TASKS M6.11): every complaint RLS shows the user, minus their own,
 * optionally narrowed to some domains. Long-standing ones sort first.
 */
export function ComplaintQueue({
  title,
  domains,
  initialFilter = 'active',
}: {
  title: string;
  domains?: ComplaintDomain[];
  initialFilter?: Filter;
}) {
  const { claims } = useSession();
  const complaints = useVisibleComplaints();
  const rules = useComplaintRules();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  useComplaintsLive();

  const scoped =
    complaints.data?.filter((c) => c.created_by !== claims?.sub && (!domains || domains.includes(c.domain))) ?? [];
  const long = (c: Complaint) => (rules.data ? isLongStanding(c, rules.data, now) : false);
  const matches: Record<Filter, (c: Complaint) => boolean> = {
    active: (c) => c.status === 'open' || c.status === 'in_progress' || c.status === 'reopened',
    long,
    awaiting: (c) => c.status === 'awaiting_confirmation',
    resolved: (c) => c.status === 'resolved',
  };
  const rows = scoped.filter(matches[filter]).sort((a, b) => Number(long(b)) - Number(long(a)));

  return (
    <View className="gap-space-sm">
      <SectionHeader title={title} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <Pill
            key={f}
            label={`${FILTER_LABEL[f]} (${scoped.filter(matches[f]).length})`}
            selected={f === filter}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>
      {complaints.isPending ? (
        <ActivityIndicator />
      ) : complaints.isError ? (
        <Text className="font-body text-body-md text-error">{complaints.error.message}</Text>
      ) : rows.length === 0 ? (
        <Card tone="low">
          <Text className="font-body text-body-md text-on-surface-variant">Nothing here.</Text>
        </Card>
      ) : (
        rows.map((c) => <ComplaintCard key={c.id} complaint={c} rules={rules.data} />)
      )}
    </View>
  );
}
