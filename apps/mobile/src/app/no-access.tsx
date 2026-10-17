import { Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/session';

/** Signed in, but the JWT carries no Campus Bites role (e.g. auth hooks not enabled yet). */
export default function NoAccess() {
  const { claims, refreshClaims, signOut } = useSession();

  return (
    <Screen scroll={false} className="justify-center">
      <Card className="gap-space-md">
        <Text className="font-headline text-headline-md text-on-surface">No access yet</Text>
        <Text className="font-body text-body-md text-on-surface-variant">
          {claims?.email ?? claims?.phone} is signed in but has no Campus Bites role. If you were
          just given one, refresh. Otherwise contact the DoSW Office.
        </Text>
        <View className="gap-space-sm">
          <Button label="Refresh access" variant="secondary" onPress={() => void refreshClaims()} />
          <Button label="Sign out" variant="tertiary" onPress={signOut} />
        </View>
      </Card>
    </Screen>
  );
}
