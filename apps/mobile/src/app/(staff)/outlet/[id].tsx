import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Screen, SectionHeader } from '@/components/ui';
import { useLiveUpdates } from '@/features/canteens/queries';
import {
  LocationEditor,
  MenuItemsEditor,
  MenuPhotoUploader,
  OpenToggleCard,
  ShiftChangeEditor,
  ShiftEditor,
} from '@/features/canteens/manage';
import { useManagedOutlets } from '@/features/canteens/useManagedOutlets';

/** Vendor / Bhawan Secretary console for one canteen or eatery (TASKS M4.7, M4.8). */
export default function OutletConsole() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const managed = useManagedOutlets();
  useLiveUpdates();

  if (managed.isPending) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  const outlet = managed.data?.find((o) => o.id === id);
  if (!outlet) {
    return (
      <Screen>
        <Card tone="low">
          <Text className="font-body text-body-md text-on-surface-variant">You don&apos;t manage this outlet.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: outlet.name }} />

      <OpenToggleCard outletId={outlet.id} />

      <View className="gap-space-sm">
        <SectionHeader title="Regular hours" />
        <ShiftEditor outletId={outlet.id} />
      </View>

      <View className="gap-space-sm">
        <SectionHeader title="Temporary shift change" />
        <ShiftChangeEditor outlet={outlet} />
      </View>

      <View className="gap-space-sm">
        <SectionHeader title="Menu photo" />
        <MenuPhotoUploader outletId={outlet.id} />
      </View>

      <View className="gap-space-sm">
        <SectionHeader title="Menu & stock" />
        <MenuItemsEditor outletId={outlet.id} />
      </View>

      {outlet.type === 'eatery' ? (
        <View className="gap-space-sm">
          <SectionHeader title="Location" />
          <LocationEditor outletId={outlet.id} />
        </View>
      ) : null}
    </Screen>
  );
}
