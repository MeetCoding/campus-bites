import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Pill } from '@/components/ui';
import { useMessManagerBhawans, useSecretaryBhawans, type SecretaryRole } from '@/features/mess/queries';

type Bhawan = { id: string; name: string };

/** `mess_manager` = Mess Secretary or a vendor running that mess (photos, menu, extra items). */
export type ScopeRole = SecretaryRole | 'mess_manager';

const NONE_MESSAGE: Record<ScopeRole, string> = {
  mess_secretary: 'You are not a Mess Secretary for any Bhawan.',
  bhawan_secretary: 'You are not a Bhawan Secretary for any Bhawan.',
  mess_manager: 'You do not manage any mess.',
};

/**
 * Resolves which Bhawan a Mess (or Bhawan) Secretary, or a mess vendor, is editing (secretary rights
 * live from role_assignments, so a revoked secretary sees nothing even with a stale JWT). Shows a
 * picker when there are several (e.g. a master vendor runs every mess).
 */
export function SecretaryScope({
  role = 'mess_secretary',
  children,
}: {
  role?: ScopeRole;
  children: (bhawan: Bhawan) => ReactNode;
}) {
  const secretaryOf = useSecretaryBhawans(role === 'bhawan_secretary' ? 'bhawan_secretary' : 'mess_secretary');
  const managerOf = useMessManagerBhawans();
  const bhawans = role === 'mess_manager' ? managerOf : secretaryOf;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (bhawans.isPending) return <ActivityIndicator />;
  if (bhawans.error || !bhawans.data) {
    return <Text className="font-body text-body-md text-error">{bhawans.error?.message ?? 'Could not load.'}</Text>;
  }
  if (bhawans.data.length === 0) {
    return (
      <Card tone="low">
        <Text className="font-body text-body-md text-on-surface-variant">{NONE_MESSAGE[role]}</Text>
      </Card>
    );
  }

  const bhawan = bhawans.data.find((b) => b.id === selectedId) ?? bhawans.data[0];
  return (
    <View className="gap-space-md">
      {bhawans.data.length > 1 ? (
        <View className="flex-row flex-wrap gap-space-xs">
          {bhawans.data.map((b) => (
            <Pill key={b.id} label={b.name} selected={b.id === bhawan.id} onPress={() => setSelectedId(b.id)} />
          ))}
        </View>
      ) : null}
      {children(bhawan)}
    </View>
  );
}
