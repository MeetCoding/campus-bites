import { LogOut } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Card, Segmented } from '@/components/ui';
import { MODE_LABEL, ROLE_LABEL } from '@/features/auth/modes';
import { useSession } from '@/features/auth/session';
import { impactTap } from '@/lib/haptics';
import { colors } from '@/theme/tokens';

/** Signed-in identity, role switcher (multi-role users) and sign-out. */
export function AccountPanel() {
  const { claims, modes, mode, setMode, signOut } = useSession();
  if (!claims) return null;
  const identity = claims.email ?? claims.phone ?? '';

  return (
    <Card className="gap-space-md">
      <View className="flex-row items-center gap-space-md">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
          <Text className="font-headline text-headline-sm text-on-primary">{identity.charAt(0).toUpperCase()}</Text>
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="font-body-semibold text-body-md text-on-surface">
            {identity}
          </Text>
          <Text numberOfLines={1} className="font-label text-label-md text-on-surface-variant">
            {claims.roles.map((role) => ROLE_LABEL[role]).join(' · ')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          hitSlop={8}
          onPress={() => {
            impactTap();
            void signOut();
          }}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-container-high active:scale-95">
          <LogOut size={18} color={colors['on-surface-variant']} />
        </Pressable>
      </View>

      {mode && modes.length > 1 ? (
        <Segmented options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] }))} value={mode} onChange={setMode} />
      ) : null}
    </Card>
  );
}
