import { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';

import { Button, Card, Pill, TextField } from '@/components/ui';
import { OpenStatusPill } from '@/features/canteens/components';
import {
  useOutletShift,
  useOutletStatus,
  useSaveShift,
  useSetLocation,
  useSetOpen,
  useSetPin,
} from '@/features/canteens/queries';
import { describeLiveStatus } from '@/features/canteens/status';
import type { LatLng } from '@/features/map/campus';
import { PinPicker } from '@/features/map/components';
import { describeOverride, MenuPhotoStackEditor, useMenuPhotoStack } from '@/features/mess/components';
import { useActiveOverrides, useCreateOverride, useRevokeOverride, useUploadMenuPhoto } from '@/features/mess/queries';
import type { Outlet } from '@/features/campus/queries';
import { ImpactFeedbackStyle, impactTap } from '@/lib/haptics';
import { pickImage } from '@/lib/images';
import {
  DATE_PRESET_LABEL,
  formatWindow,
  isValidDateInput,
  isValidTimeInput,
  istNow,
  presetRange,
  type DatePreset,
} from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { colors } from '@/theme/tokens';

const switchColors = { true: colors.primary, false: colors['surface-dim'] };

// ─── Open / closed toggle ────────────────────────────────────────────────────
export function OpenToggleCard({ outletId }: { outletId: string }) {
  const status = useOutletStatus(outletId);
  const setOpen = useSetOpen();
  const now = useNow();

  if (!status.data) return <ActivityIndicator />;
  // The switch reflects what students see (schedule or toggle), not the raw stored flag.
  const live = describeLiveStatus(status.data, now).tone !== 'closed';

  return (
    <Card className="gap-space-sm">
      <View className="flex-row items-center justify-between gap-space-md">
        <View className="flex-1 gap-space-xs">
          <Text className="font-body-semibold text-body-lg text-on-surface">{live ? 'Open now' : 'Closed now'}</Text>
          <OpenStatusPill status={status.data} />
        </View>
        <Switch
          accessibilityLabel="Outlet open"
          value={live}
          disabled={setOpen.isPending}
          trackColor={switchColors}
          onValueChange={(isOpen) => {
            impactTap(ImpactFeedbackStyle.Medium);
            setOpen.mutate({ outletId, isOpen });
          }}
        />
      </View>
      <Text className="font-body text-body-sm text-on-surface-variant">
        Overrides your published hours until the next shift starts or ends — then the schedule takes over again.
      </Text>
      {setOpen.error ? <Text className="font-body text-body-sm text-error">{setOpen.error.message}</Text> : null}
    </Card>
  );
}

// ─── Regular hours (outlet_shifts, direct RLS write) ─────────────────────────
export function ShiftEditor({ outletId }: { outletId: string }) {
  const shift = useOutletShift(outletId);
  if (shift.isPending) return <ActivityIndicator />;
  // Re-keyed so the form starts from the stored hours after every save.
  return <ShiftForm key={shift.data?.updated_at ?? 'none'} outletId={outletId} shift={shift.data ?? null} />;
}

type StoredShift = {
  opens_at: string;
  closes_at: string;
  weekend_opens_at: string | null;
  weekend_closes_at: string | null;
};

const hhmm = (time: string | null | undefined) => time?.slice(0, 5) ?? '';

/** Why a weekday or weekend window is invalid, or null. */
function windowProblem(opens: string, closes: string): string | null {
  if (!isValidTimeInput(opens) || !isValidTimeInput(closes)) return 'Use 24-hour times like 22:30.';
  if (opens.trim() === closes.trim()) return 'Opening and closing times must differ.';
  return null;
}

function ShiftForm({ outletId, shift }: { outletId: string; shift: StoredShift | null }) {
  const save = useSaveShift();
  const [opensAt, setOpensAt] = useState(hhmm(shift?.opens_at));
  const [closesAt, setClosesAt] = useState(hhmm(shift?.closes_at));
  const [weekend, setWeekend] = useState(Boolean(shift?.weekend_opens_at));
  const [weekendOpens, setWeekendOpens] = useState(hhmm(shift?.weekend_opens_at));
  const [weekendCloses, setWeekendCloses] = useState(hhmm(shift?.weekend_closes_at));
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const problem =
      windowProblem(opensAt, closesAt) ?? (weekend ? windowProblem(weekendOpens, weekendCloses) : null);
    if (problem) return setError(problem);
    setError(null);
    save.mutate({
      outlet_id: outletId,
      opens_at: opensAt.trim(),
      closes_at: closesAt.trim(),
      weekend_opens_at: weekend ? weekendOpens.trim() : null,
      weekend_closes_at: weekend ? weekendCloses.trim() : null,
    });
  }

  const current = !shift
    ? 'No hours published yet.'
    : shift.weekend_opens_at && shift.weekend_closes_at
      ? `Currently ${formatWindow(shift.opens_at, shift.closes_at)} Mon–Fri, ${formatWindow(shift.weekend_opens_at, shift.weekend_closes_at)} Sat–Sun.`
      : `Currently ${formatWindow(shift.opens_at, shift.closes_at)} every day.`;

  return (
    <Card className="gap-space-md">
      <Text className="font-body text-body-sm text-on-surface-variant">
        {current} A closing time earlier than the opening time runs past midnight (e.g. 22:30 → 10:30).
      </Text>
      <Text className="font-label-bold text-label-sm uppercase text-on-surface-variant">
        {weekend ? 'Weekdays (Mon–Fri)' : 'Every day'}
      </Text>
      <View className="flex-row gap-space-sm">
        <View className="flex-1">
          <TextField label="Opens (24 h)" placeholder="10:30" value={opensAt} onChangeText={setOpensAt} keyboardType="numbers-and-punctuation" />
        </View>
        <View className="flex-1">
          <TextField label="Closes (24 h)" placeholder="22:30" value={closesAt} onChangeText={setClosesAt} keyboardType="numbers-and-punctuation" />
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-space-md">
        <View className="flex-1">
          <Text className="font-body-semibold text-body-md text-on-surface">Different weekend hours</Text>
          <Text className="font-body text-body-sm text-on-surface-variant">
            Saturday and Sunday. A shift belongs to the day it starts on.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Different weekend hours"
          value={weekend}
          trackColor={switchColors}
          onValueChange={(next) => {
            setWeekend(next);
            if (next && !weekendOpens && !weekendCloses) {
              setWeekendOpens(opensAt);
              setWeekendCloses(closesAt);
            }
          }}
        />
      </View>
      {weekend ? (
        <View className="flex-row gap-space-sm">
          <View className="flex-1">
            <TextField label="Weekend opens" placeholder="12:00" value={weekendOpens} onChangeText={setWeekendOpens} keyboardType="numbers-and-punctuation" />
          </View>
          <View className="flex-1">
            <TextField label="Weekend closes" placeholder="20:00" value={weekendCloses} onChangeText={setWeekendCloses} keyboardType="numbers-and-punctuation" />
          </View>
        </View>
      ) : null}

      {error || save.error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {error ?? save.error?.message}
        </Text>
      ) : save.isSuccess ? (
        <Text className="font-body text-body-sm text-on-surface">Saved — students see the new hours now.</Text>
      ) : null}
      <Button label="Save regular hours" variant="secondary" onPress={submit} loading={save.isPending} />
    </Card>
  );
}

// ─── Temporary shift change (FastAPI timing override, optional push) ─────────
export function ShiftChangeEditor({ outlet }: { outlet: Outlet }) {
  const today = istNow().date;
  const overrides = useActiveOverrides(outlet.id);
  const create = useCreateOverride();
  const revoke = useRevokeOverride();
  const canNotify = outlet.type !== 'eatery'; // eateries have no resident audience

  const [preset, setPreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [closed, setClosed] = useState(false);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);

  function submit() {
    const [startsOn, endsOn] = preset === 'custom' ? [customStart, customEnd] : presetRange(preset, today);
    if (!isValidDateInput(startsOn) || !isValidDateInput(endsOn)) return setFormError('Use dates like 2026-10-24.');
    if (endsOn < startsOn) return setFormError('End date is before the start date.');
    if (!closed) {
      if (!isValidTimeInput(opensAt) || !isValidTimeInput(closesAt)) return setFormError('Use 24-hour times like 02:00.');
      if (opensAt.trim() === closesAt.trim()) return setFormError('Opening and closing times must differ.');
    }
    if (reason.trim().length < 3) return setFormError('Add a short reason students will see.');
    setFormError(null);
    setPublished(null);
    create.mutate(
      {
        outletId: outlet.id,
        body: {
          slot: null,
          starts_on: startsOn,
          ends_on: endsOn,
          is_closed: closed,
          opens_at: closed ? null : opensAt.trim(),
          closes_at: closed ? null : closesAt.trim(),
          reason: reason.trim(),
          notify: canNotify && notify,
        },
      },
      {
        onSuccess: (result) => {
          setPublished(result.notified ? 'Published — Bhawan residents are being notified.' : 'Published.');
          setReason('');
        },
      },
    );
  }

  return (
    <View className="gap-space-sm">
      {overrides.data?.length ? (
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
      ) : (
        <Text className="font-body text-body-md text-on-surface-variant">No temporary changes — regular hours apply.</Text>
      )}
      {revoke.error ? <Text className="font-body text-body-sm text-error">{revoke.error.message}</Text> : null}

      <Card className="gap-space-md">
        <View className="flex-row flex-wrap gap-space-xs">
          {(['today', 'tomorrow', 'weekend', 'custom'] as const).map((p) => (
            <Pill key={p} label={DATE_PRESET_LABEL[p]} selected={p === preset} onPress={() => setPreset(p)} />
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

        <View className="flex-row items-center justify-between">
          <Text className="font-body-semibold text-body-md text-on-surface">Closed on these days</Text>
          <Switch accessibilityLabel="Closed on these days" value={closed} onValueChange={setClosed} trackColor={switchColors} />
        </View>
        {!closed ? (
          <View className="flex-row gap-space-sm">
            <View className="flex-1">
              <TextField label="Opens (24 h)" placeholder="02:00" value={opensAt} onChangeText={setOpensAt} keyboardType="numbers-and-punctuation" />
            </View>
            <View className="flex-1">
              <TextField label="Closes (24 h)" placeholder="14:00" value={closesAt} onChangeText={setClosesAt} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
        ) : null}

        <TextField
          label="Reason (shown to students)"
          placeholder="e.g. Exam season shift, staff on leave"
          value={reason}
          onChangeText={setReason}
          maxLength={200}
        />

        {canNotify ? (
          <View className="flex-row items-center justify-between gap-space-md">
            <Text className="flex-1 font-body-semibold text-body-md text-on-surface">Notify Bhawan residents</Text>
            <Switch accessibilityLabel="Notify Bhawan residents" value={notify} onValueChange={setNotify} trackColor={switchColors} />
          </View>
        ) : null}

        {formError || create.error ? (
          <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
            {formError ?? create.error?.message}
          </Text>
        ) : null}
        {published ? <Text className="font-body text-body-sm text-on-surface">{published}</Text> : null}

        <Button label="Publish shift change" onPress={submit} loading={create.isPending} />
      </Card>
    </View>
  );
}

// ─── Menu photo (compressed upload, same pipeline as the mess noticeboard) ───
export function MenuPhotoUploader({ outletId }: { outletId: string }) {
  const upload = useUploadMenuPhoto();
  const stack = useMenuPhotoStack(outletId);
  const [message, setMessage] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setMessage(null);
    try {
      const image = await pickImage(source);
      if (!image) return;
      upload.mutate(
        { outletId, source: image, today: istNow().date },
        {
          onSuccess: ({ sizeBytes }) =>
            setMessage(`Published (${(sizeBytes / 1024 / 1024).toFixed(1)} MB after compression).`),
        },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View className="gap-space-sm">
      <View className="flex-row gap-space-sm">
        <View className="flex-1">
          <Button
            label="Photograph menu board"
            variant="secondary"
            onPress={() => void pick('camera')}
            loading={upload.isPending}
            disabled={stack.full}
          />
        </View>
        <View className="flex-1">
          <Button
            label="From gallery"
            variant="secondary"
            onPress={() => void pick('library')}
            disabled={upload.isPending || stack.full}
          />
        </View>
      </View>
      {stack.full ? (
        <Text className="font-body text-body-sm text-on-surface-variant">
          All {stack.limit} photo slots are used. Delete an old photo to add a new one.
        </Text>
      ) : null}
      {upload.isError ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">{upload.error.message}</Text>
      ) : message ? (
        <Text className="font-body text-body-sm text-on-surface">{message}</Text>
      ) : null}
      <MenuPhotoStackEditor outletId={outletId} />
    </View>
  );
}

export function LocationEditor({ outletId }: { outletId: string }) {
  const status = useOutletStatus(outletId);
  const setLocation = useSetLocation();
  const [value, setValue] = useState<string | null>(null);
  const current = value ?? status.data?.location_tag ?? '';

  return (
    <Card className="gap-space-md">
      <TextField
        label="Location shown to students"
        placeholder="e.g. Near the Main Building"
        value={current}
        onChangeText={setValue}
        maxLength={60}
      />
      {setLocation.error ? <Text className="font-body text-body-sm text-error">{setLocation.error.message}</Text> : null}
      <Button
        label="Save location"
        variant="secondary"
        loading={setLocation.isPending}
        onPress={() => setLocation.mutate({ outletId, locationTag: current.trim() || null })}
      />
    </Card>
  );
}

// ─── Map pin (eateries) ──────────────────────────────────────────────────────
export function PinEditor({ outletId }: { outletId: string }) {
  const status = useOutletStatus(outletId);
  const setPin = useSetPin();
  const saved =
    status.data && status.data.latitude !== null && status.data.longitude !== null
      ? { latitude: status.data.latitude, longitude: status.data.longitude }
      : null;
  const [draft, setDraft] = useState<LatLng | null>(null);
  const value = draft ?? saved;

  if (status.isPending) return <ActivityIndicator />;
  return (
    <Card>
      <PinPicker
        value={value}
        onChange={setDraft}
        saving={setPin.isPending}
        error={setPin.error?.message}
        onSave={draft ? () => setPin.mutate({ outletId, pin: draft }, { onSuccess: () => setDraft(null) }) : undefined}
        onClear={saved ? () => setPin.mutate({ outletId, pin: null }, { onSuccess: () => setDraft(null) }) : undefined}
      />
    </Card>
  );
}
