import { Text, View } from 'react-native';

import { Card, Screen, SectionHeader } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';

/** Mess Authority (rebates) and ADoSW (eatery complaints). Queues arrive in M5/M6. */
export default function AuthorityHome() {
  const { claims } = useSession();
  const bhawans = useBhawans();
  const scoped = bhawans.data?.filter((b) => claims?.scope_bhawan_ids.includes(b.id)) ?? [];
  const isAdosw = claims?.roles.includes('adosw') ?? false;

  return (
    <Screen>
      <View className="gap-space-xs pt-space-md">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">Authority</Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">Review desk</Text>
      </View>

      <SectionHeader title="Your scope" />
      <View className="gap-space-sm">
        {isAdosw ? (
          <Card>
            <Text className="font-body-semibold text-body-lg text-on-surface">
              Campus eateries (ADoSW)
            </Text>
          </Card>
        ) : null}
        {scoped.map((b) => (
          <Card key={b.id}>
            <Text className="font-body-semibold text-body-lg text-on-surface">{b.name}</Text>
            <Text className="font-body text-body-sm text-on-surface-variant">Mess rebate approvals</Text>
          </Card>
        ))}
      </View>

      <Card tone="low">
        <Text className="font-body text-body-sm text-on-surface-variant">
          Rebate and complaint queues arrive with the Rebates and Complaints milestones.
        </Text>
      </Card>

      <AccountPanel />
    </Screen>
  );
}
