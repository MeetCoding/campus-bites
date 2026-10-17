import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import {
  AttachmentThumb,
  ComplaintStatusBadge,
  ComplaintTimeline,
  ComplaintTracker,
  LongStandingBadge,
  NudgeButton,
} from '@/features/complaints/components';
import { complaintErrorMessage } from '@/features/complaints/errors';
import {
  availableActions,
  CATEGORY_LABEL,
  DOMAIN_LABEL,
  elapsedLabel,
  HANDLER_LABEL,
  isLongStanding,
  type ComplaintAction,
} from '@/features/complaints/logic';
import {
  useComplaint,
  useComplaintRules,
  useComplaintsLive,
  useComplaintTransition,
  useIsHandler,
} from '@/features/complaints/queries';
import { pickImage, type PickedImage } from '@/lib/images';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { colors } from '@/theme/tokens';

/**
 * Complaint detail per stitch-reference/accountability_complaint_hub (TASKS M6.9, M6.11):
 * tracker, T+ clock, LONG-STANDING badge, timeline, nudge, confirm / still unresolved, and the
 * handler's reply / mark-fixed actions. Shared by every role; RLS decides who can open it.
 */
export default function ComplaintDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { claims } = useSession();
  const complaint = useComplaint(id);
  const rules = useComplaintRules();
  const isHandler = useIsHandler(complaint.data);
  const now = useNow();
  useComplaintsLive();

  if (complaint.isPending) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  const c = complaint.data;
  if (!c) {
    return (
      <Screen>
        <Card tone="low">
          <Text className="font-body text-body-md text-on-surface-variant">
            {complaint.isError
              ? complaint.error.message
              : 'Only the student who raised this complaint and the people handling it can open it.'}
          </Text>
        </Card>
      </Screen>
    );
  }

  const isOwner = c.created_by === claims?.sub;
  const longStanding = rules.data ? isLongStanding(c, rules.data, now) : false;
  const actions = availableActions(c.status, { isOwner, isHandler });

  return (
    <Screen>
      <Card className="gap-space-sm">
        <View className="flex-row flex-wrap items-center justify-between gap-space-xs">
          <Text className="font-label-bold text-label-sm uppercase text-primary">
            {DOMAIN_LABEL[c.domain]} · {CATEGORY_LABEL[c.category]}
          </Text>
          {c.status !== 'resolved' ? (
            <Text className={longStanding ? 'font-label-bold text-label-md text-error' : 'font-label-bold text-label-md text-on-surface-variant'}>
              {elapsedLabel(c.opened_at, now)}
            </Text>
          ) : null}
        </View>
        {longStanding ? <LongStandingBadge /> : null}
        {c.escalated_at ? (
          <Text className="font-body-semibold text-body-sm text-error">
            Escalated {timeAgo(c.escalated_at)}
            {c.domain === 'campus_eatery' ? '' : ' to the Warden office'}
          </Text>
        ) : null}
        <Text className="font-headline text-headline-md text-on-surface">{c.title}</Text>
        <Text className="font-body text-body-sm text-on-surface-variant">
          {c.outlets?.name} · raised {timeAgo(c.created_at)} · handled by the {HANDLER_LABEL[c.domain]}
        </Text>
        <ComplaintStatusBadge status={c.status} />
        <ComplaintTracker status={c.status} />
        <Text className="font-body text-body-md text-on-surface">{c.body}</Text>
        {c.attachment_paths.length > 0 ? (
          <View className="flex-row gap-space-sm">
            {c.attachment_paths.map((path) => (
              <AttachmentThumb key={path} path={path} label="Complaint photo" />
            ))}
          </View>
        ) : null}
      </Card>

      {isOwner && rules.data ? (
        <View className="gap-space-xs">
          <NudgeButton complaint={c} rules={rules.data} />
          {c.nudge_count === 0 && c.status !== 'resolved' && c.status !== 'awaiting_confirmation' ? (
            <Text className="font-body text-body-sm text-on-surface-variant">
              A “Nudge” button appears {Math.round(rules.data.nudge_eligible_after_hours / 24)} days after raising if it
              is still unresolved.
            </Text>
          ) : null}
        </View>
      ) : null}

      {actions.length > 0 ? (
        <ActionPanel
          complaintId={c.id}
          userId={claims?.sub ?? ''}
          actions={actions}
          prompt={
            isOwner
              ? 'Has this issue been resolved on the ground?'
              : c.status === 'in_progress'
                ? 'Post progress, or mark it fixed (a proof photo helps the student confirm).'
                : 'Reply with your action plan to start work. The student is notified.'
          }
        />
      ) : null}

      <SectionHeader title="Timeline" />
      <Card>
        <ComplaintTimeline complaint={c} />
      </Card>
    </Screen>
  );
}

function ActionPanel({
  complaintId,
  userId,
  actions,
  prompt,
}: {
  complaintId: string;
  userId: string;
  actions: ComplaintAction[];
  prompt: string;
}) {
  const move = useComplaintTransition();
  const [message, setMessage] = useState('');
  const [proof, setProof] = useState<PickedImage | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const canAttach = actions.some((a) => a.to === 'awaiting_confirmation');

  function run(action: ComplaintAction) {
    const text = message.trim() || null;
    if (action.needsMessage && !text) return setFormError('Write a short reply first.');
    setFormError(null);
    move.mutate(
      {
        id: complaintId,
        userId,
        toStatus: action.to,
        message: text,
        proof: action.to === 'awaiting_confirmation' ? proof : null,
      },
      {
        onSuccess: () => {
          setMessage('');
          setProof(null);
        },
      },
    );
  }

  async function attach() {
    try {
      const image = await pickImage('camera');
      if (image) setProof(image);
    } catch (error) {
      setFormError(complaintErrorMessage(error));
    }
  }

  return (
    <Card className="gap-space-md">
      <Text className="font-body-semibold text-body-md text-on-surface">{prompt}</Text>
      <TextField
        label="Message (optional unless starting work)"
        placeholder="e.g. Electrician scheduled for 4 PM today"
        value={message}
        onChangeText={setMessage}
        maxLength={1000}
        multiline
      />
      {canAttach ? (
        proof ? (
          <View className="flex-row items-center justify-between rounded-lg bg-surface-container-low p-space-sm">
            <Text className="font-body text-body-sm text-on-surface">Proof photo attached</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove proof photo" onPress={() => setProof(null)}>
              <MaterialIcons name="close" size={20} color={colors['on-surface-variant']} />
            </Pressable>
          </View>
        ) : (
          <Button label="Add proof photo" variant="tertiary" onPress={() => void attach()} />
        )
      ) : null}
      {formError || move.error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {formError ?? complaintErrorMessage(move.error)}
        </Text>
      ) : null}
      {actions.map((action) => (
        <Button
          key={`${action.to}-${action.label}`}
          label={action.label}
          variant={action.primary ? 'primary' : 'secondary'}
          loading={move.isPending && move.variables?.toStatus === action.to}
          onPress={() => run(action)}
        />
      ))}
    </Card>
  );
}
