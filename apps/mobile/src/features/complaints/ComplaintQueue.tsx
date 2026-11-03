import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Card, Pill, SectionHeader } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { ComplaintCard } from '@/features/complaints/components';
import { isLongStanding, type ComplaintDomain } from '@/features/complaints/logic';
import { useComplaintRules, useComplaintsLive, useVisibleComplaints, type Complaint } from '@/features/complaints/queries';
import { useNow } from '@/lib/useNow';
import { SkeletonList } from '@/components/ui/Skeleton';

const PAGE_SIZE = 20;

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
  const [visible, setVisible] = useState(PAGE_SIZE);
  useComplaintsLive();

  // Own complaints are left out of oversight lists, but not when they are routed to the viewer
  // (a Mess Secretary who also filed one for their own Bhawan still has to act on it).
  const routedToMe = (c: Complaint) =>
    !!domains &&
    domains.includes(c.domain) &&
    (c.bhawan_id === null || (claims?.scope_bhawan_ids.includes(c.bhawan_id) ?? false));
  const scoped =
    complaints.data?.filter(
      (c) => (c.created_by !== claims?.sub || routedToMe(c)) && (!domains || domains.includes(c.domain)),
    ) ?? [];
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
            onPress={() => {
              setFilter(f);
              setVisible(PAGE_SIZE);
            }}
          />
        ))}
      </ScrollView>
      {complaints.isPending ? (
        <SkeletonList />
      ) : complaints.isError ? (
        <Text className="font-body text-body-md text-error">{complaints.error.message}</Text>
      ) : rows.length === 0 ? (
        <Card tone="low">
          <Text className="font-body text-body-md text-on-surface-variant">Nothing here.</Text>
        </Card>
      ) : (
        <>
          {rows.slice(0, visible).map((c) => (
            <ComplaintCard key={c.id} complaint={c} rules={rules.data} />
          ))}
          {rows.length > visible ? (
            <Button
              label={`Show more (${rows.length - visible})`}
              variant="secondary"
              onPress={() => setVisible((n) => n + PAGE_SIZE)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}
