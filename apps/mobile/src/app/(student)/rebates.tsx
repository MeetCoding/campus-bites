import { Image } from 'expo-image';
import { CalendarX2, FileText, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, HeroCard, IconBadge, Screen, SectionHeader, TextField } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { RebatePass, rebateDays as daysBetween } from '@/features/rebates/components';
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

/** Student mess rebate form + history with status timeline (TASKS M5.4). */
export default function RebatesScreen() {
  const { claims } = useSession();
  const studentId = claims?.sub;
  const rebates = useMyRebates(studentId);
  const rules = useRebateRules();
  const pending = rebates.data?.filter(
    (r) => r.status === 'pending_verification' || r.status === 'biometric_cross_checked',
  ).length;

  return (
    <Screen>
      <HeroCard>
        <View className="flex-row items-center gap-space-md">
          <IconBadge icon={CalendarX2} tone="onDark" size="lg" />
          <View className="flex-1">
            <Text className="font-headline text-headline-md text-on-primary">Going away?</Text>
            <Text className="font-body text-body-md text-on-primary-container">
              Claim a rebate for {rules.data ? `${rules.data.min_rebate_days}+ ` : ''}days off the mess
            </Text>
          </View>
        </View>
        {pending ? (
          <View className="self-start rounded-full bg-tertiary-fixed px-3 py-1">
            <Text className="font-label-bold text-label-sm text-on-tertiary-fixed">{pending} in review</Text>
          </View>
        ) : null}
      </HeroCard>

      {studentId ? <RebateForm studentId={studentId} /> : null}

      <SectionHeader title="Your passes" />
      {rebates.isPending ? (
        <ActivityIndicator />
      ) : rebates.isError ? (
        <Text className="font-body text-body-md text-error">{rebates.error.message}</Text>
      ) : rebates.data.length === 0 ? (
        <Text className="font-body text-body-md text-on-surface-variant">No applications yet.</Text>
      ) : (
        rebates.data.map((r) => <RebatePass key={r.id} rebate={r} />)
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
      <Text className="font-headline text-headline-sm text-on-surface">New application</Text>
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
        <Text className="font-label text-label-md text-on-surface-variant">Proof (optional)</Text>
        {document ? (
          <View className="flex-row items-center gap-space-sm rounded-2xl bg-surface-container-low p-space-sm">
            {document.kind === 'image' ? (
              <Image source={{ uri: document.uri }} style={{ width: 48, height: 48, borderRadius: 8 }} contentFit="cover" />
            ) : (
              <FileText size={28} color={colors.error} />
            )}
            <Text className="flex-1 font-body text-body-sm text-on-surface" numberOfLines={1}>
              {document.kind === 'pdf' ? document.name : 'Photo attached'}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove document" hitSlop={12} onPress={() => setDocument(null)}>
              <X size={20} color={colors['on-surface-variant']} />
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
