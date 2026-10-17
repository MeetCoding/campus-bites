import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import { useBhawans } from '@/features/campus/queries';
import { RebateDocument, RebateStatusBadge, RebateTimeline } from '@/features/rebates/components';
import { rebateErrorMessage } from '@/features/rebates/errors';
import { useRebate, useTransitionRebate, type RebateStatus } from '@/features/rebates/queries';
import { formatDateRange, timeAgo } from '@/lib/time';

/** Rebate detail: cross-check against biometric records, then approve or reject (TASKS M5.5). */
export default function RebateReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rebate = useRebate(id);
  const bhawans = useBhawans();
  const move = useTransitionRebate();
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (rebate.isPending) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  const r = rebate.data;
  if (!r) {
    return (
      <Screen>
        <Text className="font-body text-body-md text-on-surface-variant">
          {rebate.isError ? rebate.error.message : 'This application is not in your queue.'}
        </Text>
      </Screen>
    );
  }

  function act(toStatus: RebateStatus) {
    const note = remarks.trim() || null;
    if (toStatus === 'rejected' && !note) return setFormError('Add remarks so the student knows why it was rejected.');
    setFormError(null);
    move.mutate({ id: r!.id, toStatus, remarks: note }, { onSuccess: () => setRemarks('') });
  }

  const open = r.status === 'pending_verification' || r.status === 'biometric_cross_checked';

  return (
    <Screen>
      <Card className="gap-space-sm">
        <View className="flex-row items-start justify-between gap-space-sm">
          <View className="flex-1">
            <Text className="font-headline text-headline-md text-on-surface">{r.student_name ?? 'Student'}</Text>
            {r.student_email ? (
              <Text className="font-body text-body-sm text-on-surface-variant">{r.student_email}</Text>
            ) : null}
          </View>
          <RebateStatusBadge status={r.status} />
        </View>
        <View className="rounded-lg bg-surface-container-low p-space-sm">
          <Text className="font-label-bold text-label-md uppercase text-primary">
            {formatDateRange(r.start_date, r.end_date)} · {r.days} days
          </Text>
          <Text className="font-body text-body-sm text-on-surface-variant">
            {bhawans.data?.find((b) => b.id === r.bhawan_id)?.name} Mess · applied {timeAgo(r.created_at)}
          </Text>
        </View>
        <Text className="font-body text-body-md text-on-surface">{r.reason}</Text>
      </Card>

      {r.document_path ? (
        <View className="gap-space-sm">
          <SectionHeader title="Supporting document" />
          <RebateDocument path={r.document_path} />
        </View>
      ) : null}

      <SectionHeader title="Progress" />
      <Card>
        <RebateTimeline status={r.status} events={r.rebate_events} />
      </Card>

      {open ? (
        <Card className="gap-space-md">
          <Text className="font-body text-body-sm text-on-surface-variant">
            {r.status === 'pending_verification'
              ? 'Check the mess biometric register for these dates. If there are no meal entries, mark it cross-checked.'
              : 'Cross-check done. Approve, or reject with remarks.'}
          </Text>
          <TextField
            label="Remarks (required to reject)"
            placeholder="e.g. Biometric shows dinner on 21 Oct"
            value={remarks}
            onChangeText={setRemarks}
            maxLength={500}
            multiline
          />
          {formError || move.error ? (
            <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
              {formError ?? rebateErrorMessage(move.error)}
            </Text>
          ) : null}
          {r.status === 'pending_verification' ? (
            <Button
              label="Mark biometric cross-checked"
              onPress={() => act('biometric_cross_checked')}
              loading={move.isPending && move.variables?.toStatus === 'biometric_cross_checked'}
            />
          ) : (
            <Button
              label="Approve rebate"
              onPress={() => act('approved')}
              loading={move.isPending && move.variables?.toStatus === 'approved'}
            />
          )}
          <Button
            label="Reject"
            variant="secondary"
            onPress={() => act('rejected')}
            loading={move.isPending && move.variables?.toStatus === 'rejected'}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
