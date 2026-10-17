import { Link, useLocalSearchParams } from 'expo-router';

import { Button, Screen, SectionHeader } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { MenuItemsList, OutletHeader } from '@/features/canteens/components';
import { useLiveUpdates } from '@/features/canteens/queries';
import { NoticeboardCard, OverrideBanner } from '@/features/mess/components';
import { useActiveOverrides } from '@/features/mess/queries';

/** Campus eatery detail: live status, hours, menu photo and searchable menu (TASKS M4.9). */
export default function EateryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { claims } = useSession();
  const overrides = useActiveOverrides(id);
  useLiveUpdates();

  return (
    <Screen>
      <OutletHeader outletId={id} />
      <OverrideBanner overrides={overrides.data} />
      <NoticeboardCard outletId={id} title="Menu photo" canReport={claims?.roles.includes('student') ?? false} />
      <SectionHeader title="Menu" />
      <MenuItemsList outletId={id} />
      <Link href={{ pathname: '/raise-complaint', params: { outlet: id } }} asChild>
        <Button label="Raise a complaint (goes to ADoSW)" variant="secondary" />
      </Link>
    </Screen>
  );
}
