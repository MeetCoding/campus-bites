import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, Card, Screen, SectionHeader } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { ROLE_LABEL } from '@/features/auth/modes';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { OpenStatusPill } from '@/features/canteens/components';
import { OUTLET_TYPE_LABEL, useLiveStatus, useLiveUpdates } from '@/features/canteens/queries';
import { useManagedOutlets } from '@/features/canteens/useManagedOutlets';
import { colors } from '@/theme/tokens';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const MESS_TOOLS: { href: Href; title: string; detail: string; icon: IconName }[] = [
  {
    href: '/mess-photo',
    title: "Update this week's noticeboard photo",
    detail: 'Photograph the signed mess chart.',
    icon: 'add-a-photo',
  },
  { href: '/mess-menu', title: 'Weekly menu', detail: 'Day-by-day breakfast, lunch and dinner.', icon: 'menu-book' },
  { href: '/extra-items', title: 'Extra items rate card', detail: 'Paneer, egg, curd… prices and availability.', icon: 'receipt-long' },
  {
    href: '/mess-timings',
    title: 'Timing override',
    detail: 'Seasonal or one-day changes — residents get a push alert.',
    icon: 'alarm-on',
  },
];

/** Vendor + secretary console per stitch-reference/vendor_secretary_upload_portal. */
export default function StaffConsole() {
  const { claims } = useSession();
  const bhawans = useBhawans();
  const managed = useManagedOutlets();
  const status = useLiveStatus();
  useLiveUpdates();

  const isMessSecretary = claims?.roles.includes('mess_secretary') ?? false;
  const myOutlets = managed.data ?? [];
  const myBhawans = bhawans.data?.filter((b) => claims?.scope_bhawan_ids.includes(b.id)) ?? [];
  const staffRoles = (claims?.roles ?? []).filter((r) =>
    ['vendor', 'mess_secretary', 'bhawan_secretary'].includes(r),
  );

  return (
    <Screen>
      <View className="gap-space-xs pt-space-md">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">Verified administrative console</Text>
        <Text className="font-headline text-headline-lg-mobile text-on-surface">
          {staffRoles.map((r) => ROLE_LABEL[r]).join(' · ') || 'Staff'}
        </Text>
        {myBhawans.length > 0 ? (
          <Text className="font-body text-body-md text-on-surface-variant">
            {myBhawans.map((b) => b.name).join(', ')}
          </Text>
        ) : null}
      </View>

      {isMessSecretary ? (
        <>
          <SectionHeader title="Mess Secretary tools" />
          <View className="gap-space-sm">
            {MESS_TOOLS.map((tool) => (
              <Link key={tool.title} href={tool.href} asChild>
                <Pressable accessibilityRole="link" className="active:opacity-80">
                  <Card className="flex-row items-center gap-space-md">
                    <MaterialIcons name={tool.icon} size={24} color={colors.primary} />
                    <View className="flex-1 gap-space-xs">
                      <Text className="font-body-semibold text-body-md text-on-surface">{tool.title}</Text>
                      <Text className="font-body text-body-sm text-on-surface-variant">{tool.detail}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        </>
      ) : null}

      {isMessSecretary || managed.isBhawanSecretary ? (
        <Link href="/complaints" asChild>
          <Pressable accessibilityRole="link" className="active:opacity-80">
            <Card className="flex-row items-center gap-space-md">
              <MaterialIcons name="report" size={24} color={colors.error} />
              <View className="flex-1 gap-space-xs">
                <Text className="font-body-semibold text-body-md text-on-surface">Complaints routed to you</Text>
                <Text className="font-body text-body-sm text-on-surface-variant">
                  Reply, mark fixed with a proof photo. Unresolved after 48 h → escalated to the Warden office.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Card>
          </Pressable>
        </Link>
      ) : null}

      {managed.isBhawanSecretary ? (
        <>
          <SectionHeader title="Bhawan Secretary tools" />
          <Link href="/rate-card" asChild>
            <Pressable accessibilityRole="link" className="active:opacity-80">
              <Card className="flex-row items-center gap-space-md">
                <MaterialIcons name="verified" size={24} color={colors.tertiary} />
                <View className="flex-1 gap-space-xs">
                  <Text className="font-body-semibold text-body-md text-on-surface">Institute fixed-rate card</Text>
                  <Text className="font-body text-body-sm text-on-surface-variant">
                    Official ceiling prices for both canteens. Shift timings are under each canteen below.
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
              </Card>
            </Pressable>
          </Link>
        </>
      ) : null}

      {myOutlets.length > 0 ? (
        <>
          <SectionHeader title={`Your outlets (${myOutlets.length})`} />
          <View className="gap-space-sm">
            {myOutlets.map((o) => (
              <Link key={o.id} href={{ pathname: '/outlet/[id]', params: { id: o.id } }} asChild>
                <Pressable accessibilityRole="link" className="active:opacity-80">
                  <Card className="flex-row items-center gap-space-sm">
                    <View className="flex-1 gap-space-xs">
                      <Text className="font-body-semibold text-body-md text-on-surface">{o.name}</Text>
                      <OpenStatusPill status={status.data?.find((st) => st.outlet_id === o.id)} />
                    </View>
                    <Badge label={OUTLET_TYPE_LABEL[o.type]} />
                    <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        </>
      ) : null}

      <AccountPanel />
    </Screen>
  );
}
