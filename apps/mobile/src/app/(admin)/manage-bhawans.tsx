import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import {
  useAdminBhawans,
  useCreateBhawan,
  useDeleteBhawan,
  useUpdateBhawan,
  type AdminBhawan,
} from '@/features/admin/queries';

/** Admin master list of Bhawans (PRD §2 System Admin). Each Bhawan comes with its Mess, Day Canteen
 *  and Night Canteen; renaming renames them too. */
export default function BhawansScreen() {
  const bhawans = useAdminBhawans();
  const create = useCreateBhawan();
  const [name, setName] = useState('');

  function submit() {
    create.mutate({ name: name.trim() }, { onSuccess: () => setName('') });
  }

  return (
    <Screen>
      <SectionHeader title="Add a Bhawan" />
      <Card className="gap-space-md">
        <TextField label="Name" placeholder="e.g. Kasturba Bhawan" value={name} onChangeText={setName} maxLength={60} />
        <Text className="font-body text-body-sm text-on-surface-variant">
          Creates its Mess, Day Canteen and Night Canteen with the default hours. Then assign its secretaries
          under Roles and whitelist the canteen owners.
        </Text>
        {create.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {create.error.message}
          </Text>
        ) : null}
        <Button label="Add Bhawan" onPress={submit} loading={create.isPending} disabled={name.trim().length < 3} />
      </Card>

      <SectionHeader title={`Bhawans${bhawans.data ? ` · ${bhawans.data.length}` : ''}`} />
      {bhawans.isPending ? (
        <ActivityIndicator />
      ) : bhawans.isError ? (
        <Text className="font-body text-body-md text-error">{bhawans.error.message}</Text>
      ) : (
        bhawans.data.map((bhawan) => <BhawanRow key={bhawan.id} bhawan={bhawan} />)
      )}
    </Screen>
  );
}

function BhawanRow({ bhawan }: { bhawan: AdminBhawan }) {
  const update = useUpdateBhawan();
  const remove = useDeleteBhawan();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(bhawan.name);
  const [position, setPosition] = useState(String(bhawan.sort_order));
  const [formError, setFormError] = useState<string | null>(null);

  function close() {
    setEditing(false);
    setConfirmDelete(false);
    setFormError(null);
    update.reset();
    remove.reset();
  }

  function save() {
    const trimmed = name.trim();
    const order = Number(position);
    if (!Number.isInteger(order) || order < 0) return setFormError('Position must be a whole number.');
    const changes = {
      name: trimmed !== bhawan.name ? trimmed : undefined,
      sort_order: order !== bhawan.sort_order ? order : undefined,
    };
    if (changes.name === undefined && changes.sort_order === undefined) return close();
    setFormError(null);
    update.mutate({ id: bhawan.id, ...changes }, { onSuccess: close });
  }

  function onDelete() {
    if (!confirmDelete) return setConfirmDelete(true);
    remove.mutate(bhawan.id);
  }

  if (!editing) {
    return (
      <Card className="flex-row items-center justify-between gap-space-sm">
        <View className="flex-1 gap-space-xs">
          <Text className="font-body-semibold text-body-lg text-on-surface">{bhawan.name}</Text>
          <Text className="font-label text-label-sm text-on-surface-variant">
            Position {bhawan.sort_order} · {bhawan.slug}
          </Text>
        </View>
        <Button label="Edit" variant="tertiary" onPress={() => setEditing(true)} />
      </Card>
    );
  }

  const error = formError ?? update.error?.message ?? remove.error?.message;
  return (
    <Card className="gap-space-md">
      <TextField label="Name" value={name} onChangeText={setName} maxLength={60} />
      <TextField
        label="Position in lists"
        hint="Lower numbers come first."
        keyboardType="number-pad"
        value={position}
        onChangeText={setPosition}
      />
      {error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {error}
        </Text>
      ) : null}
      {confirmDelete ? (
        <Text className="font-body text-body-sm text-on-surface-variant">
          This also removes its Mess, canteens, menus, rate cards and role assignments. Only possible while
          no student has picked this Bhawan.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-space-sm">
        <Button label="Save" variant="secondary" onPress={save} loading={update.isPending} disabled={name.trim().length < 3} />
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
