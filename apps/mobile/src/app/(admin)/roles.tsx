import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Badge, Button, Card, Pill, Screen, SectionHeader, TextField } from '@/components/ui';
import {
  BHAWAN_SCOPED_ROLES,
  useAssignRole,
  useRevokeRole,
  useRoleAssignments,
  type AssignableRole,
} from '@/features/admin/queries';
import { ROLE_LABEL } from '@/features/auth/modes';
import { useSession } from '@/features/auth/session';
import { useBhawans } from '@/features/campus/queries';

const ASSIGNABLE: AssignableRole[] = [
  'mess_secretary',
  'bhawan_secretary',
  'mess_authority',
  'adosw',
  'admin',
];

export default function RolesScreen() {
  const { claims } = useSession();
  const assignments = useRoleAssignments();
  const bhawans = useBhawans();
  const assign = useAssignRole();
  const revoke = useRevokeRole();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('mess_secretary');
  const [bhawanId, setBhawanId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const scoped = BHAWAN_SCOPED_ROLES.includes(role);

  function submit() {
    if (!email.trim()) return setFormError('Enter their IITR email.');
    if (scoped && !bhawanId) return setFormError('Pick a Bhawan for this role.');
    setFormError(null);
    assign.mutate(
      { email: email.trim(), role, bhawan_id: scoped ? (bhawanId ?? undefined) : undefined },
      { onSuccess: () => setEmail('') },
    );
  }

  return (
    <Screen>
      <SectionHeader title="Assign a role" />
      <Card className="gap-space-md">
        <TextField
          label="IITR email"
          placeholder="name@dept.iitr.ac.in"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          hint="They must have signed in to Campus Bites once. New roles apply within the hour, or immediately after they reopen the app and refresh."
        />
        <View className="gap-space-sm">
          <Text className="font-label text-label-md text-on-surface-variant">Role</Text>
          <View className="flex-row flex-wrap gap-space-xs">
            {ASSIGNABLE.map((r) => (
              <Pill key={r} label={ROLE_LABEL[r]} selected={r === role} onPress={() => setRole(r)} />
            ))}
          </View>
        </View>
        {scoped ? (
          <View className="gap-space-sm">
            <Text className="font-label text-label-md text-on-surface-variant">Bhawan</Text>
            <View className="flex-row flex-wrap gap-space-xs">
              {bhawans.data?.map((b) => (
                <Pill key={b.id} label={b.name} selected={b.id === bhawanId} onPress={() => setBhawanId(b.id)} />
              ))}
            </View>
          </View>
        ) : null}
        {formError || assign.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {formError ?? assign.error?.message}
          </Text>
        ) : null}
        <Button label="Assign role" onPress={submit} loading={assign.isPending} />
      </Card>

      <SectionHeader title="Current roles" />
      {assignments.isPending ? (
        <ActivityIndicator />
      ) : assignments.isError ? (
        <Text className="font-body text-body-md text-error">{assignments.error.message}</Text>
      ) : (
        <View className="gap-space-sm">
          {assignments.data.map((a) => (
            <Card key={a.id} className="gap-space-sm">
              <View className="flex-row flex-wrap items-center gap-space-xs">
                <Badge label={ROLE_LABEL[a.role]} tone={a.role === 'admin' ? 'official' : 'neutral'} />
                {a.bhawan_name ? <Badge label={a.bhawan_name} /> : null}
              </View>
              <Text className="font-body-semibold text-body-md text-on-surface">
                {a.full_name ?? a.email ?? a.user_id}
              </Text>
              {a.full_name && a.email ? (
                <Text className="font-body text-body-sm text-on-surface-variant">{a.email}</Text>
              ) : null}
              {!(a.role === 'admin' && a.user_id === claims?.sub) ? (
                <Button
                  label="Remove role"
                  variant="tertiary"
                  loading={revoke.isPending && revoke.variables === a.id}
                  onPress={() => revoke.mutate(a.id)}
                />
              ) : null}
            </Card>
          ))}
        </View>
      )}
      {revoke.error ? (
        <Text className="font-body text-body-sm text-error">{revoke.error.message}</Text>
      ) : null}
    </Screen>
  );
}
