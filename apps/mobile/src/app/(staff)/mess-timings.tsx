import { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';

import { Button, Card, Pill, Screen, SectionHeader, TextField } from '@/components/ui';
import { describeOverride, MealStatusCard } from '@/features/mess/components';
import {
  MEAL_LABEL,
  MEAL_SLOTS,
  useActiveOverrides,
  useCreateOverride,
  useMessOutlet,
  useMessSchedule,
  useRevokeOverride,
  type MealSlot,
} from '@/features/mess/queries';
import { SecretaryScope } from '@/features/mess/SecretaryScope';
import { addDays, DAY_KEYS, dayKeyOf, isValidDateInput, isValidTimeInput, istNow, parseTime } from '@/lib/time';
import { colors } from '@/theme/tokens';

type DatePreset = 'today' | 'tomorrow' | 'weekend' | 'custom';

function presetRange(preset: Exclude<DatePreset, 'custom'>, today: string): [string, string] {
  if (preset === 'today') return [today, today];
  if (preset === 'tomorrow') return [addDays(today, 1), addDays(today, 1)];
  // The coming (or current) Saturday–Sunday.
  const dayIndex = DAY_KEYS.indexOf(dayKeyOf(today)); // 0 = Monday … 6 = Sunday
  const saturday = dayIndex === 6 ? addDays(today, -1) : addDays(today, 5 - dayIndex);
  return [dayIndex === 6 ? today : saturday, addDays(saturday, 1)];
}

export default function MessTimingsScreen() {
  return (
    <Screen>
      <SecretaryScope>{(bhawan) => <TimingsEditor key={bhawan.id} bhawanId={bhawan.id} bhawanName={bhawan.name} />}</SecretaryScope>
    </Screen>
  );
}

function TimingsEditor({ bhawanId, bhawanName }: { bhawanId: string; bhawanName: string }) {
  const today = istNow().date;
  const outlet = useMessOutlet(bhawanId);
  const schedule = useMessSchedule(bhawanId);
  const overrides = useActiveOverrides(outlet?.id);
  const create = useCreateOverride();
  const revoke = useRevokeOverride();

  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [preset, setPreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [closed, setClosed] = useState(false);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);

  function submit() {
    if (!outlet) return;
    const [startsOn, endsOn] = preset === 'custom' ? [customStart, customEnd] : presetRange(preset, today);
    if (!isValidDateInput(startsOn) || !isValidDateInput(endsOn)) return setFormError('Use dates like 2026-10-24.');
    if (endsOn < startsOn) return setFormError('End date is before the start date.');
    if (!closed) {
      if (!isValidTimeInput(opensAt) || !isValidTimeInput(closesAt)) return setFormError('Use 24-hour times like 08:00.');
      if (parseTime(closesAt) <= parseTime(opensAt)) return setFormError('A meal must close after it opens.');
    }
    if (reason.trim().length < 3) return setFormError('Add a short reason students will see.');
    setFormError(null);
    setPublished(null);
    create.mutate(
      {
        outletId: outlet.id,
        body: {
          slot,
          starts_on: startsOn,
          ends_on: endsOn,
          is_closed: closed,
          opens_at: closed ? null : opensAt.trim(),
          closes_at: closed ? null : closesAt.trim(),
          reason: reason.trim(),
        },
      },
      {
        onSuccess: (result) => {
          setPublished(result.notified ? `Published — ${bhawanName} residents are being notified.` : 'Published.');
          setReason('');
        },
      },
    );
  }

  return (
    <View className="gap-space-md">
      <MealStatusCard title={`${bhawanName} Mess · today`} schedule={schedule.data} loading={schedule.isPending} />

      <SectionHeader title="Live overrides" />
      {overrides.isPending ? (
        <ActivityIndicator />
      ) : !overrides.data?.length ? (
        <Text className="font-body text-body-md text-on-surface-variant">None — the standard schedule applies.</Text>
      ) : (
        overrides.data.map((o) => (
          <Card key={o.id} tone="low" className="gap-space-xs">
            <Text className="font-body-semibold text-body-md text-on-surface">{describeOverride(o)}</Text>
            <Text className="font-body text-body-sm text-on-surface-variant">{o.reason}</Text>
            <Button
              label="End early"
              variant="tertiary"
              loading={revoke.isPending && revoke.variables === o.id}
              onPress={() => revoke.mutate(o.id)}
            />
          </Card>
        ))
      )}
      {revoke.error ? <Text className="font-body text-body-sm text-error">{revoke.error.message}</Text> : null}

      <SectionHeader title="New override" />
      <Card className="gap-space-md">
        <View className="gap-space-sm">
          <Text className="font-label text-label-md text-on-surface-variant">Meal</Text>
          <View className="flex-row flex-wrap gap-space-xs">
            {MEAL_SLOTS.map((s) => (
              <Pill key={s} label={MEAL_LABEL[s]} selected={s === slot} onPress={() => setSlot(s)} />
            ))}
          </View>
        </View>

        <View className="gap-space-sm">
          <Text className="font-label text-label-md text-on-surface-variant">When</Text>
          <View className="flex-row flex-wrap gap-space-xs">
            {(['today', 'tomorrow', 'weekend', 'custom'] as const).map((p) => (
              <Pill
                key={p}
                label={{ today: 'Today', tomorrow: 'Tomorrow', weekend: 'This weekend', custom: 'Custom dates' }[p]}
                selected={p === preset}
                onPress={() => setPreset(p)}
              />
            ))}
          </View>
          {preset === 'custom' ? (
            <View className="flex-row gap-space-sm">
              <View className="flex-1">
                <TextField label="From" placeholder="YYYY-MM-DD" value={customStart} onChangeText={setCustomStart} />
              </View>
              <View className="flex-1">
                <TextField label="To" placeholder="YYYY-MM-DD" value={customEnd} onChangeText={setCustomEnd} />
              </View>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="font-body-semibold text-body-md text-on-surface">Mess closed for this meal</Text>
          <Switch
            accessibilityLabel="Mess closed for this meal"
            value={closed}
            onValueChange={setClosed}
            trackColor={{ true: colors.primary, false: colors['surface-dim'] }}
          />
        </View>

        {!closed ? (
          <View className="flex-row gap-space-sm">
            <View className="flex-1">
              <TextField label="Opens (24 h)" placeholder="08:00" value={opensAt} onChangeText={setOpensAt} keyboardType="numbers-and-punctuation" />
            </View>
            <View className="flex-1">
              <TextField label="Closes (24 h)" placeholder="10:00" value={closesAt} onChangeText={setClosesAt} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
        ) : null}

        <TextField
          label="Reason (shown to students)"
          placeholder="e.g. Exam season, Diwali celebration"
          value={reason}
          onChangeText={setReason}
          maxLength={200}
        />

        {formError || create.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {formError ?? create.error?.message}
          </Text>
        ) : null}
        {published ? <Text className="font-body text-body-sm text-on-surface">{published}</Text> : null}

        <Button label="Publish & notify residents" onPress={submit} loading={create.isPending} disabled={!outlet} />
      </Card>
    </View>
  );
}
