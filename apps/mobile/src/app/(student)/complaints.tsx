import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button, Card, Pill, Screen, SectionHeader } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { Segmented } from '@/features/canteens/components';
import { BoardCard, ComplaintCard } from '@/features/complaints/components';
import { type ComplaintDomain } from '@/features/complaints/logic';
import {
  useComplaintBoard,
  useComplaintRules,
  useComplaintsLive,
  useMyComplaints,
} from '@/features/complaints/queries';

type Tab = 'mine' | 'board';
const DOMAINS: { value: ComplaintDomain; label: string }[] = [
  { value: 'mess', label: 'My Bhawan mess' },
  { value: 'hostel_canteen', label: 'Hostel canteens' },
  { value: 'campus_eatery', label: 'Campus eateries (ADoSW)' },
];

/** Accountability & complaint hub per stitch-reference/accountability_complaint_hub (TASKS M6.10). */
export default function ComplaintsHub() {
  const [tab, setTab] = useState<Tab>('mine');
  useComplaintsLive();

  return (
    <Screen>
      <Link href="/raise-complaint" asChild>
        <Button label="Raise a dining complaint" />
      </Link>
      <Segmented
        options={[
          { value: 'mine', label: 'My complaints' },
          { value: 'board', label: 'Public issue board' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'mine' ? <MyComplaints /> : <IssueBoard />}
    </Screen>
  );
}

function MyComplaints() {
  const { claims } = useSession();
  const mine = useMyComplaints(claims?.sub);
  const rules = useComplaintRules();

  if (mine.isPending) return <ActivityIndicator />;
  if (mine.isError) return <Text className="font-body text-body-md text-error">{mine.error.message}</Text>;
  if (mine.data.length === 0) {
    return (
      <Card tone="low">
        <Text className="font-body text-body-md text-on-surface-variant">
          You haven&apos;t raised any complaints. Issues stay on the public board until you confirm they&apos;re fixed.
        </Text>
      </Card>
    );
  }
  return (
    <View className="gap-space-sm">
      {mine.data.map((c) => (
        <ComplaintCard key={c.id} complaint={c} rules={rules.data} />
      ))}
    </View>
  );
}

function IssueBoard() {
  const { claims } = useSession();
  const bhawans = useBhawans();
  const [domain, setDomain] = useState<ComplaintDomain>('mess');
  const [bhawanId, setBhawanId] = useState<string | null>(null);
  const activeBhawan = bhawanId ?? claims?.bhawan_id ?? bhawans.data?.[0]?.id ?? null;
  const board = useComplaintBoard(domain === 'campus_eatery' ? null : activeBhawan, domain);

  const rows = board.data ?? [];
  const active = rows.filter((r) => r.status !== 'resolved');
  const critical = active.filter((r) => r.is_long_standing).length;
  // Share of active issues still inside the 48 h window.
  const onTime = active.length === 0 ? 100 : Math.round(((active.length - critical) / active.length) * 100);

  return (
    <View className="gap-space-sm">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
        {DOMAINS.map((d) => (
          <Pill key={d.value} label={d.label} selected={d.value === domain} onPress={() => setDomain(d.value)} />
        ))}
      </ScrollView>
      {domain !== 'campus_eatery' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-space-xs">
          {bhawans.data?.map((b) => (
            <Pill
              key={b.id}
              label={b.name.replace(' Bhawan', '')}
              selected={b.id === activeBhawan}
              onPress={() => setBhawanId(b.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Card className="flex-row">
        <Stat value={String(active.length)} label="Active" tone="text-primary" />
        <Stat value={String(critical)} label="Critical > 48 h" tone="text-error" />
        <Stat value={`${onTime}%`} label="Within 48 h" tone="text-tertiary" />
      </Card>

      <SectionHeader title="Issues (long-standing pinned first)" />
      {board.isPending ? (
        <ActivityIndicator />
      ) : board.isError ? (
        <Text className="font-body text-body-md text-error">{board.error.message}</Text>
      ) : rows.length === 0 ? (
        <Card tone="low">
          <Text className="font-body text-body-md text-on-surface-variant">No open issues here.</Text>
        </Card>
      ) : (
        rows.map((r) => <BoardCard key={r.id} row={r} />)
      )}
      <Text className="font-body text-body-sm text-on-surface-variant">
        The board is anonymous — nobody sees who raised an issue. Issues unresolved for 48 h are flagged and escalated
        automatically.
      </Text>
    </View>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <View className="flex-1 items-center gap-space-xs">
      <Text className={`font-headline text-headline-md ${tone}`}>{value}</Text>
      <Text className="text-center font-label text-label-sm text-on-surface-variant">{label}</Text>
    </View>
  );
}
