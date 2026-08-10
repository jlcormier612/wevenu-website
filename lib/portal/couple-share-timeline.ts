/**
 * Couple Tasks Impl 6 — verified share-timeline completion gates.
 *
 * Completion signal is a durable event_vendor_timeline_shares row written by
 * share_portal_timeline_with_vendor — never navigate / Mark complete / title match /
 * timeline_submitted / vendors audience alone.
 */

export const SHARE_TIMELINE_ACTION_TYPE = "share_timeline" as const;
export const SHARE_TIMELINE_CELEBRATION_TYPE = "timeline_shared_with_vendor" as const;
export const SHARE_TIMELINE_SOURCE = "couple_portal" as const;

export type VendorTaskActionType = typeof SHARE_TIMELINE_ACTION_TYPE;

export function normalizeVendorTaskActionType(
  value: string | null | undefined,
): VendorTaskActionType | null {
  if (value === SHARE_TIMELINE_ACTION_TYPE) return SHARE_TIMELINE_ACTION_TYPE;
  return null;
}

/** Title must never drive completion or routing. */
export function actionTypeFromTitleNever(_title: string | null | undefined): null {
  return null;
}

/**
 * Pending owned share_timeline obligations stay in Home / Tasks attention even
 * when Mark complete is disabled (canComplete=false).
 */
export function isShareTimelineVendorAttention(opts: {
  status: "pending" | "complete";
  coupleVisibility: "visible" | "owned" | "private" | string;
  actionType: string | null | undefined;
  canComplete?: boolean;
}): boolean {
  if (opts.status === "complete") return false;
  if (opts.coupleVisibility !== "owned") return false;
  if (normalizeVendorTaskActionType(opts.actionType) === SHARE_TIMELINE_ACTION_TYPE) return true;
  return Boolean(opts.canComplete);
}

export function shareTimelineWorkspace(): {
  section: "timeline";
  focus: "share";
  actionLabel: "Share timeline";
} {
  return { section: "timeline", focus: "share", actionLabel: "Share timeline" };
}

/** Manual Mark complete is not the verified path for share_timeline. */
export function mayManuallyCompleteVendorTask(actionType: string | null | undefined): boolean {
  return normalizeVendorTaskActionType(actionType) !== SHARE_TIMELINE_ACTION_TYPE;
}

/**
 * Celebrate only when the share RPC reports celebrated === true
 * (first durable share insert that won the luv_celebrations unique slot).
 */
export function shouldPresentShareTimelineCelebration(
  celebratedFlag: boolean | null | undefined,
): boolean {
  return celebratedFlag === true;
}

/**
 * Which vendor tasks would auto-complete for a successful share of (E, V).
 * Pure predicate for tests / client optimism — server still is SoT.
 */
export function vendorTasksCompletedByShare(opts: {
  eventId: string;
  vendorId: string;
  tasks: Array<{
    id: string;
    eventId: string;
    vendorId: string;
    coupleVisibility: string;
    actionType: string | null | undefined;
    status: string;
  }>;
}): string[] {
  return opts.tasks
    .filter(
      (t) =>
        t.eventId === opts.eventId &&
        t.vendorId === opts.vendorId &&
        t.coupleVisibility === "owned" &&
        normalizeVendorTaskActionType(t.actionType) === SHARE_TIMELINE_ACTION_TYPE &&
        t.status === "pending",
    )
    .map((t) => t.id);
}
