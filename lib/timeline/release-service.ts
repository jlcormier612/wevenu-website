/**
 * Timeline P1b — venue release preview/confirm against SECURITY DEFINER RPCs.
 */

import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

export type TimelineReleasePreviewResult =
  | {
      ok: true;
      eventId: string;
      willShare: Array<Record<string, unknown>>;
      heldOut: Array<Record<string, unknown>>;
      blocksRelease: Array<Record<string, unknown>>;
      softWarnings: Array<Record<string, unknown>>;
      canRelease: boolean;
      lastReleasedAt: string | null;
      workingFingerprint: string;
      lastWorkingFingerprint: string | null;
      workingAheadOfRelease: boolean;
      hasPriorRelease: boolean;
    }
  | { ok: false; message: string; error?: string; detail?: unknown };

export type TimelineReleaseConfirmResult =
  | {
      ok: true;
      releaseId: string;
      entryCount?: number;
      heldOutCount?: number;
      releasedAt?: string;
      idempotentReplay?: boolean;
    }
  | { ok: false; message: string; error?: string; detail?: unknown };

export async function previewVenueTimelineRelease(
  eventId: string,
): Promise<TimelineReleasePreviewResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found.", error: "unauthorized" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_venue_timeline_release", {
    p_event_id: eventId,
  });
  if (error) return { ok: false, message: error.message, error: "rpc_error" };
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.ok !== true) {
    return {
      ok: false,
      message: String(d.message ?? d.error ?? "Could not build the release preview."),
      error: String(d.error ?? "preview_failed"),
      detail: d,
    };
  }
  return {
    ok: true,
    eventId: String(d.eventId ?? eventId),
    willShare: Array.isArray(d.willShare) ? (d.willShare as Array<Record<string, unknown>>) : [],
    heldOut: Array.isArray(d.heldOut) ? (d.heldOut as Array<Record<string, unknown>>) : [],
    blocksRelease: Array.isArray(d.blocksRelease)
      ? (d.blocksRelease as Array<Record<string, unknown>>)
      : [],
    softWarnings: Array.isArray(d.softWarnings)
      ? (d.softWarnings as Array<Record<string, unknown>>)
      : [],
    canRelease: Boolean(d.canRelease),
    lastReleasedAt: (d.lastReleasedAt as string | null) ?? null,
    workingFingerprint: String(d.workingFingerprint ?? ""),
    lastWorkingFingerprint:
      typeof d.lastWorkingFingerprint === "string" ? d.lastWorkingFingerprint : null,
    workingAheadOfRelease: Boolean(d.workingAheadOfRelease),
    hasPriorRelease: Boolean(d.hasPriorRelease),
  };
}

export async function confirmVenueTimelineRelease(
  eventId: string,
  input: {
    acknowledgedHoldOutIds: string[];
    workingFingerprint: string;
    idempotencyKey?: string | null;
  },
): Promise<TimelineReleaseConfirmResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found.", error: "unauthorized" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_venue_timeline_release", {
    p_event_id: eventId,
    p_acknowledged_hold_out_ids: input.acknowledgedHoldOutIds,
    p_working_fingerprint: input.workingFingerprint,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) {
    return {
      ok: false,
      message: "Sharing didn't finish. The couple still has the previous shared timeline.",
      error: "rpc_error",
      detail: error.message,
    };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.ok !== true) {
    const err = String(d.error ?? "confirm_failed");
    const message =
      err === "stale_preview"
        ? String(d.message ?? "The working timeline changed since you reviewed the preview. Review again before sharing.")
        : err === "blocks_release"
          ? String(d.message ?? "Fix or replace items already on the shared timeline before sharing again.")
          : err === "hold_out_ack_required"
            ? String(d.message ?? "Confirm the items that will not be shared yet before continuing.")
            : err === "nothing_to_share"
              ? String(d.message ?? "Add resolved timeline items before sharing with the couple.")
              : "Sharing didn't finish. The couple still has the previous shared timeline.";
    return { ok: false, message, error: err, detail: d };
  }
  return {
    ok: true,
    releaseId: String(d.releaseId),
    entryCount: typeof d.entryCount === "number" ? d.entryCount : undefined,
    heldOutCount: typeof d.heldOutCount === "number" ? d.heldOutCount : undefined,
    releasedAt: typeof d.releasedAt === "string" ? d.releasedAt : undefined,
    idempotentReplay: Boolean(d.idempotentReplay),
  };
}

/** Prepare-and-release: preview then confirm, auto-acknowledging hold-outs. */
export async function releaseVenueTimelineForPrepare(
  eventId: string,
): Promise<TimelineReleaseConfirmResult> {
  const preview = await previewVenueTimelineRelease(eventId);
  if (!preview.ok) {
    return { ok: false, message: preview.message, error: preview.error };
  }
  if (preview.blocksRelease.length > 0) {
    return {
      ok: false,
      message: "Fix or replace items already on the shared timeline before sharing again.",
      error: "blocks_release",
      detail: preview.blocksRelease,
    };
  }
  if (!preview.canRelease) {
    return {
      ok: false,
      message: "Add resolved timeline items before sharing with the couple.",
      error: "nothing_to_share",
    };
  }
  const holdIds = preview.heldOut.map((h) => String(h.id));
  return confirmVenueTimelineRelease(eventId, {
    acknowledgedHoldOutIds: holdIds,
    workingFingerprint: preview.workingFingerprint,
    idempotencyKey: `prepare:${eventId}:${preview.workingFingerprint}`,
  });
}
