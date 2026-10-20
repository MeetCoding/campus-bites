import { Link, type Href } from 'expo-router';
import {
  AlarmClock,
  BadgeCheck,
  BookOpen,
  Camera,
  ChevronRight,
  MessageSquareWarning,
  Moon,
  ReceiptText,
  Store,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Card, HeroCard, IconBadge, PressableScale, Screen, SectionHeader, type IconTone } from '@/components/ui';
import { AccountPanel } from '@/features/auth/AccountPanel';
import { ROLE_LABEL } from '@/features/auth/modes';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';
import { OpenStatusPill } from '@/features/canteens/components';
import { useLiveStatus, useLiveUpdates } from '@/features/canteens/queries';
import { useManagedOutlets } from '@/features/canteens/useManagedOutlets';
import { useMessManagerBhawans } from '@/features/mess/queries';
import { colors } from '@/theme/tokens';

type Tool = { href: Href; title: string; icon: LucideIcon; tone: IconTone };

// Mess Secretaries and vendors running a mess publish these; timing overrides push every resident,
// so they stay with the Mess Secretary.
const MESS_TOOLS: (Tool & { secretaryOnly?: boolean })[] = [
  { href: '/mess-photo', title: 'Noticeboard photo', icon: Camera, tone: 'primary' },
  { href: '/mess-menu', title: 'Weekly menu', icon: BookOpen, tone: 'primary' },
  { href: '/extra-items', title: 'Extra items', icon: ReceiptText, tone: 'tertiary' },
  { href: '/mess-timings', title: 'Timing override', icon: AlarmClock, tone: 'warning', secretaryOnly: true },
];

/** Vendor + secretary console per stitch-reference/vendor_secretary_upload_portal. */
export default function StaffConsole() {
  const { claims } = useSession();
  const bhawans = useBhawans();
  const managed = useManagedOutlets();
  const status = useLiveStatus();
  useLiveUpdates();

  const isMessSecretary = claims?.roles.includes('mess_secretary') ?? false;
  const messes = useMessManagerBhawans();
  const managesMess = isMessSecretary || (messes.data?.length ?? 0) > 0;
  const messTools = MESS_TOOLS.filter((tool) => isMessSecretary || !tool.secretaryOnly);
  const myOutlets = managed.data ?? [];
  const myBhawans = bhawans.data?.filter((b) => claims?.scope_bhawan_ids.includes(b.id)) ?? [];
  const staffRoles = (claims?.roles ?? []).filter((r) =>
    ['vendor', 'mess_secretary', 'bhawan_secretary'].includes(r),
  );
  const openCount = myOutlets.filter((o) => status.data?.find((s) => s.outlet_id === o.id)?.is_open).length;

  return (
    <Screen>
      <HeroCard>
        <View className="gap-space-xs">
          <Text className="font-label-bold text-label-sm uppercase text-on-primary-container">
            {myBhawans.map((b) => b.name).join(' · ') || 'Staff console'}
          </Text>
          <Text className="font-headline text-headline-lg-mobile text-on-primary">
            {staffRoles.map((r) => ROLE_LABEL[r]).join(' · ') || 'Staff'}
          </Text>
        </View>
        {myOutlets.length > 0 ? (
          <View className="self-start rounded-full bg-on-primary/15 px-3 py-1">
            <Text className="font-label-bold text-label-sm text-on-primary">
              {openCount} of {myOutlets.length} outlets open
            </Text>
          </View>
        ) : null}
      </HeroCard>

      {managesMess ? (
        <>
          <SectionHeader title={messes.data && messes.data.length > 1 ? `Mess · ${messes.data.length} Bhawans` : 'Mess'} />
          <View className="flex-row flex-wrap justify-between gap-y-space-sm">
            {messTools.map((tool) => (
              <Link key={tool.title} href={tool.href} asChild>
                <PressableScale accessibilityRole="link" className="w-[48.5%]">
                  <Card className="min-h-28 justify-between gap-space-md">
                    <IconBadge icon={tool.icon} tone={tool.tone} />
                    <Text className="font-body-semibold text-body-md text-on-surface">{tool.title}</Text>
                  </Card>
                </PressableScale>
              </Link>
            ))}
          </View>
        </>
      ) : null}

      {isMessSecretary || managed.isBhawanSecretary ? (
        <ToolRow href="/complaints" title="Complaints routed to you" detail="Escalates after 48 h" icon={MessageSquareWarning} tone="error" />
      ) : null}

      {managed.isBhawanSecretary ? (
        <ToolRow href="/rate-card" title="Institute rate card" detail="Ceiling prices for both canteens" icon={BadgeCheck} tone="tertiary" />
      ) : null}

      {myOutlets.length > 0 ? (
        <>
          <SectionHeader title="Your outlets" />
          <View className="gap-space-sm">
            {myOutlets.map((o) => (
              <Link key={o.id} href={{ pathname: '/outlet/[id]', params: { id: o.id } }} asChild>
                <PressableScale accessibilityRole="link">
                  <Card className="flex-row items-center gap-space-md">
                    <IconBadge
                      icon={o.type === 'day_canteen' ? Sun : o.type === 'night_canteen' ? Moon : Store}
                      tone={o.type === 'eatery' ? 'tertiary' : 'primary'}
                    />
                    <View className="flex-1 gap-space-xs">
                      <Text numberOfLines={1} className="font-body-semibold text-body-md text-on-surface">
                        {o.name}
                      </Text>
                      <OpenStatusPill status={status.data?.find((st) => st.outlet_id === o.id)} />
                    </View>
                    <ChevronRight size={20} color={colors.outline} />
                  </Card>
                </PressableScale>
              </Link>
            ))}
          </View>
        </>
      ) : null}

      <AccountPanel />
    </Screen>
  );
}

function ToolRow({ href, title, detail, icon, tone }: Tool & { detail: string }) {
  return (
    <Link href={href} asChild>
      <PressableScale accessibilityRole="link">
        <Card className="flex-row items-center gap-space-md">
          <IconBadge icon={icon} tone={tone} />
          <View className="flex-1">
            <Text className="font-body-semibold text-body-md text-on-surface">{title}</Text>
            <Text className="font-body text-body-sm text-on-surface-variant">{detail}</Text>
          </View>
          <ChevronRight size={20} color={colors.outline} />
        </Card>
      </PressableScale>
    </Link>
  );
}
