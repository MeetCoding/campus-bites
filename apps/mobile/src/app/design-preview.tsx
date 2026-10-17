// Dev-only design-system preview (tokens, fonts, primitives). Open /design-preview in a dev build.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Badge, Button, Card, Pill, Screen, SectionHeader, TextField } from '@/components/ui';

const surfaceTiers = [
  'bg-surface-container-lowest',
  'bg-surface-container-low',
  'bg-surface-container',
  'bg-surface-container-high',
  'bg-surface-container-highest',
  'bg-surface-dim',
] as const;

export default function DesignPreview() {
  const [selected, setSelected] = useState('Rajendra');

  return (
    <Screen>
      <View className="gap-space-xs">
        <Text className="font-label text-label-sm uppercase text-on-surface-variant">
          IIT Roorkee · Design preview
        </Text>
        <Text className="font-headline text-headline-lg-mobile text-primary">Campus Bites</Text>
        <Text className="font-body text-body-md text-on-surface-variant">
          Noto Serif headlines, Inter body and Public Sans labels on Alexandria surface tiers.
        </Text>
      </View>

      <SectionHeader title="Surface tiers" />
      <View className="flex-row gap-space-sm">
        {surfaceTiers.map((tier) => (
          <View key={tier} className={`h-12 flex-1 rounded-lg ${tier}`} />
        ))}
      </View>

      <SectionHeader title="Primitives" actionLabel="See all" />
      <Card className="gap-space-md">
        <View className="flex-row flex-wrap gap-space-sm">
          {['Rajendra', 'Govind', 'Cautley'].map((name) => (
            <Pill key={name} label={name} selected={selected === name} onPress={() => setSelected(name)} />
          ))}
        </View>
        <View className="flex-row flex-wrap gap-space-sm">
          <Badge label="Open now" tone="open" />
          <Badge label="Special schedule" tone="warning" />
          <Badge label="Long-standing issue" tone="longStanding" />
          <Badge label="Institute rate" tone="official" />
        </View>
        <TextField label="Registered mobile number" prefix="+91" placeholder="98765 43210" keyboardType="phone-pad" />
        <Button label="Primary action" />
        <Button label="Secondary action" variant="secondary" />
        <Button label="Tertiary action" variant="tertiary" />
      </Card>
    </Screen>
  );
}
