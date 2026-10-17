import { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';

import { Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import {
  useDeleteExtraItem,
  useExtraItems,
  useSaveExtraItem,
  type ExtraItem,
} from '@/features/mess/queries';
import { SecretaryScope } from '@/features/mess/SecretaryScope';
import { formatPaise, parseRupeesToPaise } from '@/lib/money';
import { colors } from '@/theme/tokens';

export default function ExtraItemsScreen() {
  return (
    <Screen>
      <SecretaryScope>{(bhawan) => <ExtraItemsEditor key={bhawan.id} bhawanId={bhawan.id} />}</SecretaryScope>
    </Screen>
  );
}

function ExtraItemsEditor({ bhawanId }: { bhawanId: string }) {
  const items = useExtraItems(bhawanId);
  const saveItem = useSaveExtraItem();
  const deleteItem = useDeleteExtraItem();

  const [editing, setEditing] = useState<ExtraItem | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(item: ExtraItem | null) {
    setEditing(item);
    setName(item?.name ?? '');
    setUnit(item?.unit ?? '');
    setPrice(item ? String(item.price_paise / 100) : '');
    setFormError(null);
  }

  function submit() {
    const pricePaise = parseRupeesToPaise(price);
    if (!name.trim()) return setFormError('Enter an item name.');
    if (pricePaise === null || pricePaise > 100000) return setFormError('Enter a price between ₹0 and ₹1,000.');
    setFormError(null);
    saveItem.mutate(
      {
        id: editing?.id,
        bhawan_id: bhawanId,
        name: name.trim(),
        unit: unit.trim() || null,
        price_paise: pricePaise,
      },
      { onSuccess: () => startEdit(null) },
    );
  }

  return (
    <View className="gap-space-md">
      <SectionHeader title={editing ? `Edit ${editing.name}` : 'Add an item'} />
      <Card className="gap-space-md">
        <TextField label="Item" placeholder="e.g. Paneer" value={name} onChangeText={setName} maxLength={60} />
        <TextField label="Unit (optional)" placeholder="e.g. per plate, 250 ml" value={unit} onChangeText={setUnit} maxLength={30} />
        <TextField label="Price" prefix="₹" placeholder="40" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        {formError || saveItem.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {formError ?? saveItem.error?.message}
          </Text>
        ) : null}
        <Button label={editing ? 'Save changes' : 'Add item'} onPress={submit} loading={saveItem.isPending} />
        {editing ? <Button label="Cancel" variant="tertiary" onPress={() => startEdit(null)} /> : null}
      </Card>

      <SectionHeader title="Rate card" />
      {items.isPending ? (
        <ActivityIndicator />
      ) : !items.data?.length ? (
        <Text className="font-body text-body-md text-on-surface-variant">No items yet.</Text>
      ) : (
        items.data.map((item) => (
          <Card key={item.id} className="gap-space-sm">
            <View className="flex-row items-center justify-between gap-space-sm">
              <View className="flex-1">
                <Text className="font-body-semibold text-body-lg text-on-surface">{item.name}</Text>
                <Text className="font-body text-body-sm text-on-surface-variant">
                  {formatPaise(item.price_paise)}
                  {item.unit ? ` · ${item.unit}` : ''}
                </Text>
              </View>
              <View className="items-center">
                <Switch
                  accessibilityLabel={`${item.name} available`}
                  value={item.available}
                  trackColor={{ true: colors.primary, false: colors['surface-dim'] }}
                  onValueChange={(available) =>
                    saveItem.mutate({ ...item, available })
                  }
                />
                <Text className="font-label text-label-sm text-on-surface-variant">
                  {item.available ? 'Available' : 'Out'}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-space-sm">
              <Button label="Edit" variant="tertiary" onPress={() => startEdit(item)} />
              <Button
                label="Remove"
                variant="tertiary"
                loading={deleteItem.isPending && deleteItem.variables?.id === item.id}
                onPress={() => deleteItem.mutate({ id: item.id, bhawan_id: bhawanId })}
              />
            </View>
          </Card>
        ))
      )}
    </View>
  );
}
