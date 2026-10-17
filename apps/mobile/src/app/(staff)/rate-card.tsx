import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import { FixedRateCard } from '@/features/canteens/components';
import {
  useDeleteFixedRate,
  useFixedRates,
  useSaveFixedRate,
  type FixedRateItem,
} from '@/features/canteens/queries';
import { SecretaryScope } from '@/features/mess/SecretaryScope';
import { formatPaise, parseRupeesToPaise } from '@/lib/money';

/** Bhawan Secretary: Institute Fixed-Rate Card editor (TASKS M4.8). Vendors cannot write it (RLS). */
export default function RateCardScreen() {
  return (
    <Screen>
      <SecretaryScope role="bhawan_secretary">
        {(bhawan) => <RateCardEditor key={bhawan.id} bhawanId={bhawan.id} />}
      </SecretaryScope>
    </Screen>
  );
}

function RateCardEditor({ bhawanId }: { bhawanId: string }) {
  const rates = useFixedRates(bhawanId);
  const save = useSaveFixedRate();
  const remove = useDeleteFixedRate();

  const [editing, setEditing] = useState<FixedRateItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [circularRef, setCircularRef] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(item: FixedRateItem | null) {
    setEditing(item);
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setPrice(item ? String(item.ceiling_price_paise / 100) : '');
    // New items default to the circular already on the card.
    setCircularRef(item ? (item.circular_ref ?? '') : (rates.data?.find((r) => r.circular_ref)?.circular_ref ?? ''));
    setFormError(null);
  }

  function submit() {
    const pricePaise = parseRupeesToPaise(price);
    if (!name.trim()) return setFormError('Enter an item name.');
    if (pricePaise === null || pricePaise > 500000) return setFormError('Enter a ceiling price between ₹0 and ₹5,000.');
    setFormError(null);
    save.mutate(
      {
        id: editing?.id,
        bhawan_id: bhawanId,
        name: name.trim(),
        description: description.trim() || null,
        ceiling_price_paise: pricePaise,
        circular_ref: circularRef.trim() || null,
      },
      { onSuccess: () => startEdit(null) },
    );
  }

  return (
    <View className="gap-space-md">
      <Text className="font-body text-body-md text-on-surface-variant">
        Applies to both canteens of your Bhawan. Students see it as the official ceiling price; vendors
        cannot change it.
      </Text>

      <SectionHeader title={editing ? `Edit ${editing.name}` : 'Add a rate'} />
      <Card className="gap-space-md">
        <TextField label="Item" placeholder="e.g. Plain Maggi" value={name} onChangeText={setName} maxLength={80} />
        <TextField label="Portion / note (optional)" placeholder="e.g. Single packet" value={description} onChangeText={setDescription} maxLength={120} />
        <View className="flex-row gap-space-sm">
          <View className="flex-1">
            <TextField label="Ceiling price" prefix="₹" placeholder="25" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
          </View>
          <View className="flex-1">
            <TextField label="Circular ref" placeholder="e.g. DOSW/2026-Q3" value={circularRef} onChangeText={setCircularRef} maxLength={80} />
          </View>
        </View>
        {formError || save.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {formError ?? save.error?.message}
          </Text>
        ) : null}
        <Button label={editing ? 'Save changes' : 'Add to rate card'} onPress={submit} loading={save.isPending} />
        {editing ? <Button label="Cancel" variant="tertiary" onPress={() => startEdit(null)} /> : null}
      </Card>

      <SectionHeader title="Published items" />
      {rates.isPending ? (
        <ActivityIndicator />
      ) : (
        rates.data?.map((item) => (
          <Card key={item.id} className="gap-space-xs">
            <Text className="font-body-semibold text-body-lg text-on-surface">{item.name}</Text>
            <Text className="font-body text-body-sm text-on-surface-variant">
              {formatPaise(item.ceiling_price_paise)} max{item.description ? ` · ${item.description}` : ''}
            </Text>
            <View className="flex-row gap-space-sm">
              <Button label="Edit" variant="tertiary" onPress={() => startEdit(item)} />
              <Button
                label="Remove"
                variant="tertiary"
                loading={remove.isPending && remove.variables?.id === item.id}
                onPress={() => remove.mutate({ id: item.id, bhawan_id: bhawanId })}
              />
            </View>
          </Card>
        ))
      )}

      <SectionHeader title="Student preview" />
      <FixedRateCard bhawanId={bhawanId} />
    </View>
  );
}
