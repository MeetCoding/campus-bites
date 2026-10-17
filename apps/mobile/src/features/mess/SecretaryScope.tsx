import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Pill } from '@/components/ui';
import { useSecretaryBhawans } from '@/features/mess/queries';

type Bhawan = { id: string; name: string };

/**
 * Resolves which Bhawan a Mess Secretary is editing (live from role_assignments, so a revoked
 * secretary sees nothing even with a stale JWT). Shows a picker in the rare multi-Bhawan case.
 */
export function SecretaryScope({ children }: { children: (bhawan: Bhawan) => ReactNode }) {
  const bhawans = useSecretaryBhawans();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (bhawans.isPending) return <ActivityIndicator />;
  if (bhawans.isError) {
    return <Text className="font-body text-body-md text-error">{bhawans.error.message}</Text>;
  }
  if (bhawans.data.length === 0) {
    return (
      <Card tone="low">
        <Text className="font-body text-body-md text-on-surface-variant">
          You are not a Mess Secretary for any Bhawan.
        </Text>
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
