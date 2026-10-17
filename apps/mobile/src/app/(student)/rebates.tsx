import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { RebateDocument, RebateStatusBadge, RebateTimeline } from '@/features/rebates/components';
import { rebateErrorMessage } from '@/features/rebates/errors';
import {
  pickDocument,
  useMyRebates,
  useRebateRules,
  useSubmitRebate,
  type PickedDocument,
} from '@/features/rebates/queries';
import { addDays, formatDateRange, isValidDateInput, istNow } from '@/lib/time';
import { colors } from '@/theme/tokens';

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Student mess rebate form + history with status timeline (TASKS M5.4). */
export default function RebatesScreen() {
  const { claims } = useSession();
  const studentId = claims?.sub;
  const rebates = useMyRebates(studentId);

  return (
    <Screen>
      <View className="gap-space-xs">
        <Text className="font-body text-body-md text-on-surface-variant">
          Apply before you leave. The Mess Authority checks your dates against biometric attendance,
          then approves or rejects with remarks.
        </Text>
      </View>

      {studentId ? <RebateForm studentId={studentId} /> : null}

      <SectionHeader title="Your applications" />
      {rebates.isPending ? (
        <ActivityIndicator />
      ) : rebates.isError ? (
        <Text className="font-body text-body-md text-error">{rebates.error.message}</Text>
      ) : rebates.data.length === 0 ? (
        <Text className="font-body text-body-md text-on-surface-variant">No rebate applications yet.</Text>
      ) : (
        rebates.data.map((r) => (
          <Card key={r.id} className="gap-space-sm">
            <View className="flex-row items-start justify-between gap-space-sm">
              <View className="flex-1">
                <Text className="font-body-semibold text-body-lg text-on-surface">
                  {formatDateRange(r.start_date, r.end_date)}
                </Text>
                <Text className="font-body text-body-sm text-on-surface-variant">
                  {r.days ?? daysBetween(r.start_date, r.end_date)} days · {r.reason}
                </Text>
              </View>
              <RebateStatusBadge status={r.status} />
            </View>
            <RebateTimeline status={r.status} events={r.rebate_events} />
            {r.document_path ? <RebateDocument path={r.document_path} /> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

function RebateForm({ studentId }: { studentId: string }) {
  const today = istNow().date;
  const rules = useRebateRules();
  const submit = useSubmitRebate();
  const minDays = rules.data?.min_rebate_days ?? 3;

  const [startDate, setStartDate] = useState(addDays(today, 1));
  const [endDate, setEndDate] = useState(addDays(today, minDays));
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const datesValid = isValidDateInput(startDate) && isValidDateInput(endDate) && endDate >= startDate;
  const days = datesValid ? daysBetween(startDate, endDate) : null;

  async function attach(source: 'camera' | 'library' | 'pdf') {
    setFormError(null);
    try {
      const picked = await pickDocument(source);
      if (picked) setDocument(picked);
    } catch (error) {
      setFormError(rebateErrorMessage(error));
    }
  }

  function send() {
    // Quick client checks for instant feedback; the API enforces every rule (incl. overlap).
    if (!isValidDateInput(startDate) || !isValidDateInput(endDate)) return setFormError('Use dates like 2026-10-24.');
    if (endDate < startDate) return setFormError('The end date must be on or after the start date.');
    if (days !== null && days < minDays) {
      return setFormError(`A rebate must cover at least ${minDays} consecutive days.`);
    }
    if (reason.trim().length < 10) return setFormError('Give a reason of at least 10 characters.');
    setFormError(null);
    setSubmitted(null);
    submit.mutate(
      { studentId, startDate, endDate, reason: reason.trim(), document },
      {
        onSuccess: (rebate) => {
          setSubmitted(`Submitted for ${formatDateRange(rebate.start_date, rebate.end_date)}. You'll get a notification at each step.`);
          setReason('');
          setDocument(null);
        },
      },
    );
  }

  return (
    <Card className="gap-space-md">
      <Text className="font-headline text-headline-sm text-on-surface">Apply for a mess rebate</Text>
      <View className="flex-row gap-space-sm">
        <View className="flex-1">
          <TextField label="From" placeholder="YYYY-MM-DD" value={startDate} onChangeText={setStartDate} />
        </View>
        <View className="flex-1">
          <TextField label="To (inclusive)" placeholder="YYYY-MM-DD" value={endDate} onChangeText={setEndDate} />
        </View>
      </View>
      <Text className="font-body text-body-sm text-on-surface-variant">
        {days !== null ? `${days} day${days === 1 ? '' : 's'} · ` : ''}Minimum {minDays} consecutive days.
      </Text>
      <TextField
        label="Reason"
        placeholder="e.g. Going home for Diwali, medical leave, inter-IIT meet"
        value={reason}
        onChangeText={setReason}
        multiline
        textAlignVertical="top"
        style={{ minHeight: 80, paddingTop: 12 }}
        maxLength={500}
      />

      <View className="gap-space-sm">
        <Text className="font-label text-label-md text-on-surface-variant">Supporting document (optional)</Text>
        {document ? (
          <View className="flex-row items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
            {document.kind === 'image' ? (
              <Image source={{ uri: document.uri }} style={{ width: 48, height: 48, borderRadius: 8 }} contentFit="cover" />
            ) : (
              <MaterialIcons name="picture-as-pdf" size={32} color={colors.error} />
            )}
            <Text className="flex-1 font-body text-body-sm text-on-surface" numberOfLines={1}>
              {document.kind === 'pdf' ? document.name : 'Photo attached (compressed before upload)'}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove document" hitSlop={12} onPress={() => setDocument(null)}>
              <MaterialIcons name="close" size={20} color={colors['on-surface-variant']} />
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-space-sm">
            <View className="flex-1">
              <Button label="Camera" variant="secondary" onPress={() => void attach('camera')} />
            </View>
            <View className="flex-1">
              <Button label="Gallery" variant="secondary" onPress={() => void attach('library')} />
            </View>
            <View className="flex-1">
              <Button label="PDF" variant="secondary" onPress={() => void attach('pdf')} />
            </View>
          </View>
        )}
      </View>

      {formError || submit.error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {formError ?? rebateErrorMessage(submit.error)}
        </Text>
      ) : submitted ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-on-surface">
          {submitted}
        </Text>
      ) : null}

      <Button label="Submit application" onPress={send} loading={submit.isPending} />
    </Card>
  );
}
