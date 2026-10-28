"use client";

/**
 * Phase 5 — venue-only booking-change review flags in the event Floor Plan workspace.
 * Clear review acknowledges only — never repairs rooms, layouts, flips, or seating.
 */
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  clearFloorPlanReviewFlagAction,
  getEventBookingRoomSetAction,
  listOpenFloorPlanReviewFlagsAction,
  updateFloorPlanSpaceAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { VenueSpace } from "@/lib/availability/types";
import {
  DEFAULT_REVIEW_BANNER_COPY,
  type ReviewFlagRow,
} from "@/lib/floor-plans/review-flags";
import {
  FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT,
  floorPlanSpaceFingerprint,
  notifyFloorPlanReviewFlagsChanged,
} from "@/lib/floor-plans/review-flags-ui";
import type { FloorPlan } from "@/lib/floor-plans/types";

const NO_SPACE = "__none__";

type Props = {
  eventId: string;
  floorPlans: FloorPlan[];
  spaces: VenueSpace[];
  canEdit: boolean;
};

function spaceLabel(spaces: VenueSpace[], id: string | null | undefined): string {
  if (!id) return "No room";
  return spaces.find((s) => s.id === id)?.name ?? "Unknown room";
}

function targetName(
  flag: ReviewFlagRow,
  floorPlans: FloorPlan[],
): string {
  if (flag.targetKind === "layout" && flag.floorPlanId) {
    const plan = floorPlans.find((p) => p.id === flag.floorPlanId);
    return plan?.name ?? (flag.contextJson.layoutName as string | undefined) ?? "Layout";
  }
  const before = flag.contextJson.beforeName as string | undefined;
  const after = flag.contextJson.afterName as string | undefined;
  if (before || after) return `Flip: ${before ?? "?"} → ${after ?? "?"}`;
  return "Before/after flip";
}

export function FloorPlanReviewFlagsPanel({
  eventId,
  floorPlans,
  spaces,
  canEdit,
}: Props) {
  const router = useRouter();
  const [flags, setFlags] = React.useState<ReviewFlagRow[]>([]);
  const [bookingRoomIds, setBookingRoomIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [roomEditPlanId, setRoomEditPlanId] = React.useState<string | null>(null);
  const [roomDraft, setRoomDraft] = React.useState(NO_SPACE);
  const [roomPending, startRoomTransition] = React.useTransition();
  const spaceFingerprint = floorPlanSpaceFingerprint(floorPlans);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const [next, rooms] = await Promise.all([
        listOpenFloorPlanReviewFlagsAction(eventId),
        getEventBookingRoomSetAction(eventId),
      ]);
      setFlags(Array.isArray(next) ? next : []);
      setBookingRoomIds(Array.isArray(rooms) ? rooms : []);
    } catch {
      setLoadError("Could not load layout reviews. Refresh and try again.");
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // Re-fetch when layout rooms change (card save → router.refresh) or count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, spaceFingerprint, floorPlans.length]);

  React.useEffect(() => {
    function onFlagsChanged(ev: Event) {
      const detail = (ev as CustomEvent<{ eventId?: string }>).detail;
      if (detail?.eventId && detail.eventId !== eventId) return;
      void reload();
    }
    window.addEventListener(FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT, onFlagsChanged);
    return () => {
      window.removeEventListener(FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT, onFlagsChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function clearFlag(flagId: string) {
    if (!canEdit) return;
    setPendingId(flagId);
    void (async () => {
      const r = await clearFloorPlanReviewFlagAction(eventId, flagId);
      setPendingId(null);
      if (!r.ok) {
        toast.error(r.message ?? "Could not clear review.");
        return;
      }
      toast.success("Review cleared. Layouts and rooms were not changed.");
      notifyFloorPlanReviewFlagsChanged(eventId);
      await reload();
      router.refresh();
    })();
  }

  function openRoomEditor(planId: string) {
    const plan = floorPlans.find((p) => p.id === planId);
    setRoomEditPlanId(planId);
    setRoomDraft(plan?.spaceId ?? NO_SPACE);
  }

  function saveRoom() {
    if (!roomEditPlanId || !canEdit) return;
    const next = roomDraft === NO_SPACE ? null : roomDraft;
    startRoomTransition(async () => {
      const r = await updateFloorPlanSpaceAction(eventId, roomEditPlanId, next);
      if (!r.ok) {
        toast.error(r.message ?? "Could not update the layout room.");
        return;
      }
      if (r.flagWarning) toast.warning(r.flagWarning);
      else {
        toast.success(
          "Layout room saved. Changing the room does not clear an outstanding review — use Clear review when you have finished reviewing.",
        );
      }
      setRoomEditPlanId(null);
      notifyFloorPlanReviewFlagsChanged(eventId);
      await reload();
      router.refresh();
    });
  }

  const bookingRoomsLabel =
    bookingRoomIds.length === 0
      ? "None assigned"
      : bookingRoomIds.map((id) => spaceLabel(spaces, id)).join(", ");
  const showMismatchBanner = !loading && !loadError && flags.length > 0;

  return (
    <div
      className="space-y-3 rounded-sm border border-border bg-card p-4"
      data-testid="floor-plan-review-flags-panel"
      data-review-count={flags.length}
      data-review-loading={loading ? "true" : "false"}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Layout reviews
        </p>
        {showMismatchBanner ? (
          <p
            className="text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-sm px-2 py-1.5"
            data-testid="floor-plan-review-banner"
            role="status"
          >
            {DEFAULT_REVIEW_BANNER_COPY}
          </p>
        ) : null}
        {!loading ? (
          <p className="text-xs text-muted-foreground" data-testid="floor-plan-review-booking-rooms">
            Booking rooms (read-only): {bookingRoomsLabel}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="floor-plan-review-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
        </p>
      ) : loadError ? (
        <p className="text-sm text-destructive" data-testid="floor-plan-review-error" role="alert">
          {loadError}
        </p>
      ) : flags.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="floor-plan-review-empty">
          No open layout reviews for this booking.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="floor-plan-review-list">
          {flags.map((flag) => {
            const name = targetName(flag, floorPlans);
            const layoutSpaceId =
              (flag.contextJson.layoutSpaceId as string | undefined)
              ?? floorPlans.find((p) => p.id === flag.floorPlanId)?.spaceId
              ?? null;
            const href =
              flag.targetKind === "layout" && flag.floorPlanId
                ? `/events/${eventId}/floor-plans/${flag.floorPlanId}`
                : undefined;
            return (
              <li
                key={flag.id}
                className="space-y-2 rounded-sm border border-border bg-background p-3"
                data-testid="floor-plan-review-item"
                data-trigger={flag.triggerCode}
                data-flag-id={flag.id}
              >
                <p className="text-sm font-medium text-heading" data-testid="floor-plan-review-target">
                  {name}
                </p>
                <p className="text-sm text-foreground" data-testid="floor-plan-review-reason">
                  {flag.reasonSummary}
                </p>
                {flag.targetKind === "layout" ? (
                  <p className="text-xs text-muted-foreground" data-testid="floor-plan-review-layout-room">
                    Layout room (read-only): {spaceLabel(spaces, layoutSpaceId)}
                  </p>
                ) : (
                  <div className="space-y-0.5 text-xs text-muted-foreground" data-testid="floor-plan-review-flip-rooms">
                    <p>
                      Recorded rooms:{" "}
                      {spaceLabel(spaces, flag.contextJson.recordedBeforeSpaceId as string | null)}
                      {" → "}
                      {spaceLabel(spaces, flag.contextJson.recordedAfterSpaceId as string | null)}
                    </p>
                    <p>
                      Current rooms:{" "}
                      {spaceLabel(spaces, flag.contextJson.currentBeforeSpaceId as string | null)}
                      {" → "}
                      {spaceLabel(spaces, flag.contextJson.currentAfterSpaceId as string | null)}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {href ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      render={<Link href={href} />}
                      data-testid="floor-plan-review-open-layout"
                    >
                      Open layout
                    </Button>
                  ) : null}
                  {flag.targetKind === "layout" && flag.floorPlanId && canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openRoomEditor(flag.floorPlanId!)}
                      data-testid="floor-plan-review-change-room"
                    >
                      Change layout room
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingId === flag.id}
                      onClick={() => clearFlag(flag.id)}
                      data-testid="floor-plan-review-clear"
                    >
                      {pendingId === flag.id ? "Clearing…" : "Clear review"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {roomEditPlanId && canEdit ? (
        <div
          className="space-y-2 rounded-sm border border-dashed border-border p-3"
          data-testid="floor-plan-layout-room-editor"
        >
          <Label htmlFor="fp-layout-room-select" className="text-sm font-medium">
            Layout room for{" "}
            {floorPlans.find((p) => p.id === roomEditPlanId)?.name ?? "layout"}
          </Label>
          <p className="text-xs text-muted-foreground">
            Changing the room does not automatically clear a review. After you confirm the
            relationship is correct, use Clear review separately.
          </p>
          <select
            id="fp-layout-room-select"
            className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
            data-testid="floor-plan-layout-room-select"
            value={roomDraft}
            onChange={(e) => setRoomDraft(e.target.value)}
            disabled={roomPending}
          >
            <option value={NO_SPACE}>No specific room</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={roomPending}
              onClick={saveRoom}
              data-testid="floor-plan-layout-room-save"
            >
              {roomPending ? "Saving…" : "Save layout room"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={roomPending}
              onClick={() => setRoomEditPlanId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

    </div>
  );
}

/** Compact room picker used from the card menu path via review panel. */
export function LayoutRoomEditorInline({
  eventId,
  plan,
  spaces,
  canEdit,
}: {
  eventId: string;
  plan: FloorPlan;
  spaces: VenueSpace[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(plan.spaceId ?? NO_SPACE);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setDraft(plan.spaceId ?? NO_SPACE);
  }, [plan.spaceId]);

  if (!canEdit) {
    return (
      <p className="text-xs text-muted-foreground">
        {spaceLabel(spaces, plan.spaceId)}
      </p>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      data-testid="floor-plan-card-room-editor"
    >
      <select
        className="h-7 w-[160px] rounded-md border border-border bg-background px-1 text-[11px]"
        aria-label={`Room for ${plan.name}`}
        data-testid="floor-plan-card-room-select"
        data-plan-id={plan.id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={pending}
      >
        <option value={NO_SPACE}>No specific room</option>
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-[11px]"
        disabled={pending || draft === (plan.spaceId ?? NO_SPACE)}
        data-testid="floor-plan-card-room-save"
        data-plan-id={plan.id}
        onClick={() => {
          startTransition(async () => {
            const next = draft === NO_SPACE ? null : draft;
            const r = await updateFloorPlanSpaceAction(eventId, plan.id, next);
            if (!r.ok) {
              toast.error(r.message ?? "Could not update the layout room.");
              return;
            }
            if (r.flagWarning) toast.warning(r.flagWarning);
            else {
              toast.success(
                "Layout room saved. This does not clear an outstanding review.",
              );
            }
            notifyFloorPlanReviewFlagsChanged(eventId);
            router.refresh();
          });
        }}
      >
        {pending ? "…" : "Save room"}
      </Button>
    </div>
  );
}
