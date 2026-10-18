import { Image } from 'expo-image';
import { Link } from 'expo-router';
import {
  Armchair,
  Check,
  ChevronsUp,
  CircleHelp,
  IndianRupee,
  Lightbulb,
  Sparkles,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Badge, Button, Card, IconBadge, PressableScale } from '@/components/ui';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import { complaintErrorMessage } from '@/features/complaints/errors';
import {
  CATEGORY_LABEL,
  elapsedLabel,
  HANDLER_LABEL,
  isLongStanding,
  nudgeState,
  STATUS_LABEL,
  trackerStep,
  type ComplaintCategory,
  type ComplaintRules,
  type ComplaintStatus,
} from '@/features/complaints/logic';
import { useAttachmentUrl, useNudge, type BoardRow, type Complaint, type ComplaintEvent } from '@/features/complaints/queries';
import { cn } from '@/lib/cn';
import { ImpactFeedbackStyle, impactTap, successTap } from '@/lib/haptics';
import { formatDuration, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { colors } from '@/theme/tokens';

const STATUS_TONE = {
  open: 'warning',
  in_progress: 'official',
  awaiting_confirmation: 'open',
  resolved: 'neutral',
  reopened: 'warning',
} as const;

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}

export function LongStandingBadge() {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-error-container px-2 py-0.5">
      <TriangleAlert size={12} color={colors['on-error-container']} />
      <Text className="font-label-bold text-label-sm uppercase text-on-error-container">Long-standing issue</Text>
    </View>
  );
}

// ─── 3-step tracker: Raised → In work → Student sign-off ─────────────────────
export function ComplaintTracker({ status }: { status: ComplaintStatus }) {
  const { step, done } = trackerStep(status);
  const steps = ['Raised', 'In work', 'Student sign-off'];
  return (
    <View className="flex-row items-start rounded-2xl bg-surface-container-low p-space-sm">
      {steps.map((label, index) => {
        const n = index + 1;
        const complete = n < step || (n === step && done);
        const current = n === step && !done;
        return (
          <View key={label} className="flex-1 items-center gap-space-xs">
            <View
              className={cn(
                'h-7 w-7 items-center justify-center rounded-full',
                complete ? 'bg-status-open' : current ? 'bg-primary' : 'bg-surface-container-high',
              )}>
              {complete ? (
                <Check size={16} color={colors['on-primary']} strokeWidth={3} />
              ) : (
                <Text className={cn('font-label-bold text-label-md', current ? 'text-on-primary' : 'text-on-surface-variant')}>
                  {n}
                </Text>
              )}
            </View>
            <Text
              className={cn(
                'text-center font-label text-label-sm',
                current ? 'text-primary' : 'text-on-surface-variant',
              )}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────
function eventTitle(e: ComplaintEvent, handler: string): string {
  switch (e.kind) {
    case 'created':
      return 'Complaint raised';
    case 'nudged':
      return `Student nudged the ${handler}`;
    case 'escalated':
      return 'Escalated — LONG-STANDING';
    case 'reply':
      return `${handler} posted an update`;
    default:
      if (e.to_status === 'in_progress') return `${handler} started work`;
      if (e.to_status === 'awaiting_confirmation') return `${handler} marked it fixed`;
      if (e.to_status === 'resolved') return 'Student confirmed resolved';
      if (e.to_status === 'reopened') return 'Student reopened it';
      return 'Status changed';
  }
}

export function ComplaintTimeline({ complaint }: { complaint: Complaint }) {
  const handler = HANDLER_LABEL[complaint.domain];
  return (
    <View className="gap-space-sm">
      {complaint.complaint_events.map((e) => (
        <View key={e.id} className="flex-row gap-space-sm">
          <View
            className={cn(
              'mt-1 h-2.5 w-2.5 rounded-full',
              e.kind === 'escalated' ? 'bg-error' : e.actor_role === 'handler' ? 'bg-primary' : 'bg-outline',
            )}
          />
          <View className="flex-1 gap-space-xs">
            <Text className="font-body-semibold text-body-sm text-on-surface">{eventTitle(e, handler)}</Text>
            <Text className="font-body text-body-sm text-on-surface-variant">{timeAgo(e.created_at)}</Text>
            {e.message ? (
              <View className="rounded-lg bg-surface-container-low p-space-sm">
                <Text className="font-body text-body-sm text-on-surface">“{e.message}”</Text>
              </View>
            ) : null}
            {e.attachment_path ? <AttachmentThumb path={e.attachment_path} label="Proof photo" /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Photos (private bucket → signed URL) ────────────────────────────────────
export function AttachmentThumb({ path, label }: { path: string; label: string }) {
  const url = useAttachmentUrl(path);
  const [zoomed, setZoomed] = useState(false);
  if (url.isPending) return <ActivityIndicator />;
  if (url.isError) return <Text className="font-body text-body-sm text-error">{url.error.message}</Text>;
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${label}. Tap to zoom.`}
        onPress={() => setZoomed(true)}
        className="h-24 w-24 overflow-hidden rounded-lg bg-surface-container-low active:opacity-90">
        <Image source={{ uri: url.data }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </Pressable>
      <ZoomableImage uri={url.data} visible={zoomed} onClose={() => setZoomed(false)} accessibilityLabel={label} />
    </>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────
export const CATEGORY_ICON: Record<ComplaintCategory, LucideIcon> = {
  hygiene: Sparkles,
  seating: Armchair,
  lighting: Lightbulb,
  food_quality: UtensilsCrossed,
  overcharging: IndianRupee,
  other: CircleHelp,
};

type TicketFields = {
  category: ComplaintCategory;
  title: string;
  outletName: string | null | undefined;
  status: ComplaintStatus;
  openedAt: string;
  nudgeCount: number;
  longStanding: boolean;
  mine?: boolean;
};

/** Linear-style issue card: category anchor, title, then status · clock · nudges. */
function Ticket({ t }: { t: TicketFields }) {
  const now = useNow();
  return (
    <Card className={cn('gap-space-sm', t.longStanding && 'bg-error-container/50')}>
      <View className="flex-row items-center gap-space-sm">
        <IconBadge icon={CATEGORY_ICON[t.category]} tone={t.longStanding ? 'error' : 'primary'} size="sm" />
        <Text numberOfLines={1} className="flex-1 font-label text-label-md text-on-surface-variant">
          {CATEGORY_LABEL[t.category]}
          {t.outletName ? ` · ${t.outletName}` : ''}
        </Text>
        {t.status !== 'resolved' ? (
          <Text className={cn('font-label-bold text-label-sm', t.longStanding ? 'text-error' : 'text-on-surface-variant')}>
            {elapsedLabel(t.openedAt, now)}
          </Text>
        ) : null}
      </View>
      <Text numberOfLines={2} className="font-body-semibold text-body-lg text-on-surface">
        {t.title}
      </Text>
      <View className="flex-row flex-wrap items-center gap-space-xs">
        {t.longStanding ? <LongStandingBadge /> : <ComplaintStatusBadge status={t.status} />}
        {t.nudgeCount > 0 ? (
          <View className="flex-row items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5">
            <ChevronsUp size={12} color={colors.primary} />
            <Text className="font-label-bold text-label-sm text-primary">{t.nudgeCount}</Text>
          </View>
        ) : null}
        {t.mine ? <Badge label="Yours" /> : null}
      </View>
    </Card>
  );
}

/** A complaint the viewer can open (their own, or one they handle / oversee). */
export function ComplaintCard({ complaint, rules }: { complaint: Complaint; rules: ComplaintRules | undefined }) {
  const now = useNow();
  const longStanding = rules ? isLongStanding(complaint, rules, now) : false;
  return (
    <Link href={{ pathname: '/complaint/[id]', params: { id: complaint.id } }} asChild>
      <PressableScale accessibilityRole="link">
        <Ticket
          t={{
            category: complaint.category,
            title: complaint.title,
            outletName: complaint.outlets?.name,
            status: complaint.status,
            openedAt: complaint.opened_at,
            nudgeCount: complaint.nudge_count,
            longStanding,
          }}
        />
      </PressableScale>
    </Link>
  );
}

/** Public, anonymised board row. Only the author's own rows open the full ticket. */
export function BoardCard({ row }: { row: BoardRow }) {
  const body = (
    <Ticket
      t={{
        category: row.category,
        title: row.title,
        outletName: row.outlet_name,
        status: row.status,
        openedAt: row.opened_at,
        nudgeCount: row.nudge_count,
        longStanding: row.is_long_standing,
        mine: row.is_mine,
      }}
    />
  );
  if (!row.is_mine) return body;
  return (
    <Link href={{ pathname: '/complaint/[id]', params: { id: row.id } }} asChild>
      <PressableScale accessibilityRole="link">{body}</PressableScale>
    </Link>
  );
}

// ─── Nudge ───────────────────────────────────────────────────────────────────
export function NudgeButton({ complaint, rules }: { complaint: Complaint; rules: ComplaintRules }) {
  const now = useNow();
  const nudge = useNudge();
  const state = nudgeState(complaint, rules, now);
  if (state.kind === 'hidden') return null;

  return (
    <View className="gap-space-xs">
      {state.kind === 'ready' ? (
        <Button
          label={`Nudge ${HANDLER_LABEL[complaint.domain]}${complaint.nudge_count ? ` (nudged ${complaint.nudge_count}×)` : ''}`}
          variant="secondary"
          loading={nudge.isPending}
          onPress={() => {
            impactTap(ImpactFeedbackStyle.Medium);
            nudge.mutate(complaint.id, { onSuccess: successTap });
          }}
        />
      ) : (
        <View className="flex-row items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1.5">
          <ChevronsUp size={14} color={colors.primary} />
          <Text className="font-label-bold text-label-md text-primary">
            Nudged {complaint.nudge_count}× · again in {formatDuration(state.minutesLeft)}
          </Text>
        </View>
      )}
      {nudge.error ? (
        <Text accessibilityRole="alert" className="font-body text-body-sm text-error">
          {complaintErrorMessage(nudge.error)}
        </Text>
      ) : null}
    </View>
  );
}
