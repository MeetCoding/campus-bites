import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Pill, Screen, SectionHeader, TextField } from '@/components/ui';
import {
  useAddWhitelist,
  useRemoveWhitelist,
  useWhitelist,
  type WhitelistEntry,
} from '@/features/admin/queries';
import { useOutlets } from '@/features/campus/queries';
import { toIndianE164 } from '@/lib/auth';

export default function WhitelistScreen() {
  const whitelist = useWhitelist();
  const outlets = useOutlets();
  const add = useAddWhitelist();
  const remove = useRemoveWhitelist();

  const [phone, setPhone] = useState('');
  const [outletId, setOutletId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Messes are run by the Mess Secretary, so only canteens and eateries are vendor-managed.
  const vendorOutlets = useMemo(
    () => outlets.data?.filter((o) => o.type !== 'mess') ?? [],
    [outlets.data],
  );
  const byPhone = useMemo(() => {
    const groups = new Map<string, WhitelistEntry[]>();
    for (const entry of whitelist.data ?? []) {
      groups.set(entry.phone_e164, [...(groups.get(entry.phone_e164) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [whitelist.data]);

  function submit() {
    const e164 = toIndianE164(phone);
    if (!e164) return setFormError('Enter a 10-digit Indian mobile number.');
    if (!outletId) return setFormError('Pick an outlet.');
    setFormError(null);
    add.mutate(
      { phone: e164, outlet_id: outletId, label: label.trim() || undefined },
      { onSuccess: () => setOutletId(null) },
    );
  }

  return (
    <Screen>
      <Card tone="low" className="gap-space-xs">
        <Text className="font-body-semibold text-body-md text-on-surface">Vendor passcodes</Text>
        <Text className="font-body text-body-sm text-on-surface-variant">
          Vendors sign in with their phone and a 6-digit passcode. Set or reset passcodes in the Campus
          Bites admin website (Vendors page); a number whitelisted here cannot sign in until it has one.
        </Text>
      </Card>

      <SectionHeader title="Add a vendor" />
      <Card className="gap-space-md">
        <TextField
          label="Mobile number"
          prefix="+91"
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <View className="gap-space-sm">
          <Text className="font-label text-label-md text-on-surface-variant">Outlet</Text>
          {outlets.isPending ? (
            <ActivityIndicator />
          ) : (
            <View className="flex-row flex-wrap gap-space-xs">
              {vendorOutlets.map((o) => (
                <Pill key={o.id} label={o.name} selected={o.id === outletId} onPress={() => setOutletId(o.id)} />
              ))}
            </View>
          )}
        </View>
        <TextField label="Label (optional)" placeholder="e.g. Owner name" value={label} onChangeText={setLabel} />
        {formError || add.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {formError ?? add.error?.message}
          </Text>
        ) : null}
        <Button label="Whitelist number" onPress={submit} loading={add.isPending} />
      </Card>

      <SectionHeader title="Whitelisted numbers" />
      {whitelist.isPending ? (
        <ActivityIndicator />
      ) : whitelist.isError ? (
        <Text className="font-body text-body-md text-error">{whitelist.error.message}</Text>
      ) : byPhone.length === 0 ? (
        <Text className="font-body text-body-md text-on-surface-variant">No vendors yet.</Text>
      ) : (
        byPhone.map(([number, entries]) => (
          <Card key={number} className="gap-space-sm">
            <Text className="font-body-semibold text-body-lg text-on-surface">
              {number} · {entries.length} outlet{entries.length === 1 ? '' : 's'}
            </Text>
            {entries.map((entry) => (
              <View key={entry.id} className="flex-row items-center justify-between gap-space-sm">
                <Text className="flex-1 font-body text-body-md text-on-surface-variant">
                  {entry.outlet_name ?? entry.outlet_id}
                </Text>
                <Button
                  label="Remove"
                  variant="tertiary"
                  loading={remove.isPending && remove.variables === entry.id}
                  onPress={() => remove.mutate(entry.id)}
                />
              </View>
            ))}
          </Card>
        ))
      )}
      {remove.error ? (
        <Text className="font-body text-body-sm text-error">{remove.error.message}</Text>
      ) : null}
    </Screen>
  );
}
