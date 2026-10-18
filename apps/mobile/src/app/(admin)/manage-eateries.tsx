import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import {
  useAdminEateries,
  useCreateEatery,
  useDeleteEatery,
  useUpdateEatery,
  type AdminEatery,
} from '@/features/admin/queries';

/** Admin master list of campus eateries (PRD §2 System Admin, Module C). */
export default function EateriesAdminScreen() {
  const eateries = useAdminEateries();
  const create = useCreateEatery();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  function submit() {
    create.mutate(
      { name: name.trim(), location_tag: location.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setLocation('');
        },
      },
    );
  }

  return (
    <Screen>
      <SectionHeader title="Add an eatery" />
      <Card className="gap-space-md">
        <TextField label="Name" placeholder="e.g. Nescafe Kiosk" value={name} onChangeText={setName} maxLength={60} />
        <TextField
          label="Location (optional)"
          placeholder="e.g. Near the Main Building"
          value={location}
          onChangeText={setLocation}
          maxLength={60}
        />
        <Text className="font-body text-body-sm text-on-surface-variant">
          Starts with hours 10:00–22:00. Whitelist the owner&apos;s phone so they can run its menu and status.
        </Text>
        {create.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {create.error.message}
          </Text>
        ) : null}
        <Button label="Add eatery" onPress={submit} loading={create.isPending} disabled={name.trim().length < 2} />
      </Card>

      <SectionHeader title={`Eateries${eateries.data ? ` · ${eateries.data.length}` : ''}`} />
      {eateries.isPending ? (
        <ActivityIndicator />
      ) : eateries.isError ? (
        <Text className="font-body text-body-md text-error">{eateries.error.message}</Text>
      ) : eateries.data.length === 0 ? (
        <Text className="font-body text-body-md text-on-surface-variant">No eateries yet.</Text>
      ) : (
        eateries.data.map((eatery) => <EateryRow key={eatery.id} eatery={eatery} />)
      )}
    </Screen>
  );
}

function EateryRow({ eatery }: { eatery: AdminEatery }) {
  const update = useUpdateEatery();
  const remove = useDeleteEatery();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(eatery.name);
  const [location, setLocation] = useState(eatery.location_tag ?? '');

  function close() {
    setEditing(false);
    setConfirmDelete(false);
    update.reset();
    remove.reset();
  }

  function save() {
    const trimmedName = name.trim();
    const trimmedLocation = location.trim() || null;
    const changes = {
      name: trimmedName !== eatery.name ? trimmedName : undefined,
      // null clears the tag; undefined leaves it alone
      location_tag: trimmedLocation !== eatery.location_tag ? trimmedLocation : undefined,
    };
    if (changes.name === undefined && changes.location_tag === undefined) return close();
    update.mutate({ id: eatery.id, ...changes }, { onSuccess: close });
  }

  function onDelete() {
    if (!confirmDelete) return setConfirmDelete(true);
    remove.mutate(eatery.id);
  }

  if (!editing) {
    return (
      <Card className="flex-row items-center justify-between gap-space-sm">
        <View className="flex-1 gap-space-xs">
          <Text className="font-body-semibold text-body-lg text-on-surface">{eatery.name}</Text>
          <Text className="font-label text-label-sm text-on-surface-variant">
            {eatery.location_tag ?? 'No location set'}
          </Text>
        </View>
        <Button label="Edit" variant="tertiary" onPress={() => setEditing(true)} />
      </Card>
    );
  }

  const error = update.error?.message ?? remove.error?.message;
  return (
    <Card className="gap-space-md">
      <TextField label="Name" value={name} onChangeText={setName} maxLength={60} />
      <TextField label="Location" placeholder="Optional" value={location} onChangeText={setLocation} maxLength={60} />
      {error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {error}
        </Text>
      ) : null}
      {confirmDelete ? (
        <Text className="font-body text-body-sm text-on-surface-variant">
          This removes its menu, hours and vendor whitelist. Eateries with complaints can&apos;t be removed.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-space-sm">
        <Button label="Save" variant="secondary" onPress={save} loading={update.isPending} disabled={name.trim().length < 2} />
        <Button label="Cancel" variant="tertiary" onPress={close} />
        <Button
          label={confirmDelete ? 'Confirm delete' : 'Delete'}
          variant="tertiary"
          onPress={onDelete}
          loading={remove.isPending}
        />
      </View>
    </Card>
  );
}
