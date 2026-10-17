import { Text, View } from 'react-native';

import { Badge, Button, Card, Pill } from '@/components/ui';
import { MODE_LABEL, ROLE_LABEL } from '@/features/auth/modes';
import { useSession } from '@/features/auth/session';

/** Signed-in identity, role switcher (multi-role users) and sign-out. */
export function AccountPanel() {
  const { claims, modes, mode, setMode, signOut } = useSession();
  if (!claims) return null;

  return (
    <Card tone="low" className="gap-space-md">
      <View className="gap-space-xs">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">Signed in as</Text>
        <Text className="font-body-semibold text-body-lg text-on-surface">
          {claims.email ?? claims.phone}
        </Text>
        <View className="flex-row flex-wrap gap-space-xs">
          {claims.roles.map((role) => (
            <Badge key={role} label={ROLE_LABEL[role]} tone={role === 'admin' ? 'official' : 'neutral'} />
          ))}
        </View>
      </View>

      {modes.length > 1 ? (
        <View className="gap-space-sm">
          <Text className="font-label text-label-md text-on-surface-variant">Switch view</Text>
          <View className="flex-row flex-wrap gap-space-sm">
            {modes.map((m) => (
              <Pill key={m} label={MODE_LABEL[m]} selected={m === mode} onPress={() => setMode(m)} />
            ))}
          </View>
        </View>
      ) : null}

      <Button label="Sign out" variant="tertiary" onPress={signOut} />
    </Card>
  );
}
