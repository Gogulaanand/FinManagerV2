import {
  STAGE_OFFSETS,
  type EscalationStage,
} from '../../../packages/core/src/deadman/messages.ts';

export type Stage = EscalationStage;

export type DeadmanLogicSettings = {
  threshold_days: number;
};

export type DeadmanLogicEvent = {
  kind: string;
  status: string;
  recipient: string | null;
  created_at: string;
};

export const stages: readonly { kind: Stage; offset: number }[] = STAGE_OFFSETS.map((item) => ({
  kind: item.stage,
  offset: item.offset,
}));

export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export function isDue(settings: DeadmanLogicSettings, kind: Stage, inactiveDays: number): boolean {
  const stage = stages.find((item) => item.kind === kind);
  return stage !== undefined && inactiveDays >= settings.threshold_days + stage.offset;
}

export function dueStages(settings: DeadmanLogicSettings, inactiveDays: number): readonly Stage[] {
  return stages
    .filter((stage) => isDue(settings, stage.kind, inactiveDays))
    .map((stage) => stage.kind);
}

export function hasCurrentEvent(
  events: readonly DeadmanLogicEvent[],
  kind: string,
  recipient: string | null,
  activity: string | null,
  now = Date.now(),
): boolean {
  return events.some((event) => {
    const pendingIsFresh =
      event.status !== 'pending' || now - new Date(event.created_at).getTime() < 86_400_000;
    return (
      event.kind === kind &&
      event.recipient === recipient &&
      event.status !== 'failed' &&
      pendingIsFresh &&
      (!activity || new Date(event.created_at) > new Date(activity))
    );
  });
}

/** Advance at most one stage; a missed cron never consumes the user's warning grace. */
export function nextStageAfterGrace(
  settings: DeadmanLogicSettings,
  activity: string,
  events: readonly (DeadmanLogicEvent & {
    sent_at?: string | null;
    detail?: Record<string, unknown> | null;
  })[],
  ownerEmail: string,
  now = Date.now(),
): Stage | null {
  if (!Number.isFinite(Date.parse(activity)) || daysSince(activity, now) < settings.threshold_days)
    return null;
  for (let index = 0; index < stages.length; index++) {
    const kind = stages[index]!.kind;
    if (kind === 'disclosure') return kind;
    const sent = events.find(
      (event) =>
        event.kind === kind &&
        event.status === 'sent' &&
        event.recipient === ownerEmail &&
        event.detail?.simulation !== true &&
        event.sent_at &&
        Date.parse(event.sent_at) > Date.parse(activity),
    );
    if (!sent) return kind;
    if (now - Date.parse(sent.sent_at!) < 7 * 86_400_000) return null;
  }
  return null;
}
