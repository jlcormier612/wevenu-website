"use client";

/**
 * Phase 4 — progressive venue before/after room-flip link.
 * Opt-in only. Does not claim automatic, timed, or staffed room turnover.
 * FP-SR starters remain illustrations until two real layout IDs are linked here.
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  getEventFloorPlanFlipAction,
  linkEventFloorPlanFlipAction,
  unlinkEventFloorPlanFlipAction,
  updateEventFloorPlanFlipNotesAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import { Button } from "@/components/ui/button";
import { spaceIdsMismatch, type EventFloorPlanFlip } from "@/lib/floor-plans/flips";
import type { FloorPlan } from "@/lib/floor-plans/types";

type Props = {
  eventId: string;
  floorPlans: FloorPlan[];
  canEdit: boolean;
};

export function FloorPlanFlipPanel({ eventId, floorPlans, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [flip, setFlip] = React.useState<EventFloorPlanFlip | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [beforeId, setBeforeId] = React.useState("");
  const [afterId, setAfterId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [drafting, setDrafting] = React.useState(false);

  async function reload() {
    setLoading(true);
    try {
      const next = await getEventFloorPlanFlipAction(eventId);
      setFlip(next);
      if (next) {
        setOpen(true);
        setBeforeId(next.beforeFloorPlanId);
        setAfterId(next.afterFloorPlanId);
        setNotes(next.transitionNotes ?? "");
        setDrafting(false);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, floorPlans.length]);

  const beforePlan = floorPlans.find((p) => p.id === beforeId);
  const afterPlan = floorPlans.find((p) => p.id === afterId);
  const mismatch =
    beforePlan && afterPlan
      ? spaceIdsMismatch(beforePlan.spaceId, afterPlan.spaceId)
      : flip
        ? spaceIdsMismatch(flip.beforeSpaceId, flip.afterSpaceId)
        : false;

  function run(fn: () => Promise<{ ok: boolean; message?: string; spaceMismatchWarning?: boolean }>) {
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.message ?? "Could not update the linked flip.");
        return;
      }
      if (r.spaceMismatchWarning) {
        setWarning(
          "These layouts are linked to different rooms. That is allowed — confirm the room context is intentional. This does not schedule an automatic room switch.",
        );
      }
      await reload();
      router.refresh();
    });
  }

  function cancelDraft() {
    setDrafting(false);
    setError(null);
    setWarning(null);
    if (flip) {
      setBeforeId(flip.beforeFloorPlanId);
      setAfterId(flip.afterFloorPlanId);
      setNotes(flip.transitionNotes ?? "");
    } else {
      setBeforeId("");
      setAfterId("");
      setNotes("");
    }
  }

  return (
    <section
      className="rounded-lg border border-border bg-muted/10 p-4 space-y-3"
      data-testid="floor-plan-flip-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-heading">Same-room flip link (optional)</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Link two real layouts as before and after for venue/staff planning. This records a
            relationship only — Hello to Cheers does not switch rooms automatically, on a timer, or
            with staffing. A static starter illustration is not a link.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="floor-plan-flip-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide flip link" : "Set up flip link"}
        </Button>
      </div>

      {!open ? (
        flip ? (
          <p className="text-xs text-muted-foreground" data-testid="floor-plan-flip-summary">
            Linked for staff planning: {flip.beforeName ?? "Before"} → {flip.afterName ?? "After"}.
            Open to review notes or unlink. Layouts stay on the event either way.
          </p>
        ) : null
      ) : (
        <div className="space-y-3" data-testid="floor-plan-flip-editor">
          {loading && !flip && !drafting ? (
            <p className="text-xs text-muted-foreground">Loading flip link…</p>
          ) : null}

          {flip && !drafting ? (
            <div className="rounded-md border border-border bg-background p-3 space-y-2" data-testid="floor-plan-flip-linked">
              <p className="text-sm text-heading" data-testid="floor-plan-flip-pair-label">
                Linked for venue/staff planning (not an automatic room switch)
              </p>
              <p className="text-sm" data-testid="floor-plan-flip-before-label">
                Before: <span className="font-medium">{flip.beforeName ?? flip.beforeFloorPlanId}</span>
              </p>
              <p className="text-sm" data-testid="floor-plan-flip-after-label">
                After: <span className="font-medium">{flip.afterName ?? flip.afterFloorPlanId}</span>
              </p>
              {mismatch ? (
                <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="floor-plan-flip-space-mismatch">
                  Room context differs between these layouts. Linking is still allowed — this is
                  informational only.
                </p>
              ) : null}
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Transition notes (venue only — not shown to the couple)
                </span>
                <textarea
                  className="w-full min-h-[72px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                  data-testid="floor-plan-flip-notes"
                  value={notes}
                  disabled={!canEdit || pending}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional staff turnover notes"
                />
              </label>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid="floor-plan-flip-save-notes"
                    onClick={() =>
                      run(() => updateEventFloorPlanFlipNotesAction(eventId, notes))
                    }
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Save notes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid="floor-plan-flip-relink"
                    onClick={() => setDrafting(true)}
                  >
                    Change linked layouts
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid="floor-plan-flip-unlink"
                    onClick={() =>
                      run(async () => {
                        const r = await unlinkEventFloorPlanFlipAction(eventId);
                        return r;
                      })
                    }
                  >
                    Unlink (keep both layouts)
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground" data-testid="floor-plan-flip-unlink-help">
                Unlinking removes only this relationship and its notes. Both layouts, their contents,
                seating, and setup membership stay intact.
              </p>
            </div>
          ) : null}

          {(!flip || drafting) && canEdit ? (
            <div className="rounded-md border border-dashed border-border bg-background p-3 space-y-2" data-testid="floor-plan-flip-form">
              <p className="text-xs text-muted-foreground">
                Choose two real event layouts. Cancel discards this form without saving a link.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Before layout</span>
                  <select
                    className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                    data-testid="floor-plan-flip-before"
                    value={beforeId}
                    onChange={(e) => setBeforeId(e.target.value)}
                    disabled={pending}
                  >
                    <option value="">Select…</option>
                    {floorPlans.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === afterId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">After layout</span>
                  <select
                    className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                    data-testid="floor-plan-flip-after"
                    value={afterId}
                    onChange={(e) => setAfterId(e.target.value)}
                    disabled={pending}
                  >
                    <option value="">Select…</option>
                    {floorPlans.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === beforeId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {mismatch ? (
                <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="floor-plan-flip-space-mismatch">
                  These layouts reference different rooms. You can still link them — this warning is
                  informational and does not block the link.
                </p>
              ) : null}
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Transition notes (venue only)
                </span>
                <textarea
                  className="w-full min-h-[72px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                  data-testid="floor-plan-flip-notes-draft"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={pending}
                  placeholder="Optional staff turnover notes"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !beforeId || !afterId}
                  data-testid="floor-plan-flip-link"
                  onClick={() =>
                    run(() => linkEventFloorPlanFlipAction(eventId, beforeId, afterId, notes))
                  }
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Link layouts
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  data-testid="floor-plan-flip-cancel"
                  onClick={cancelDraft}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {!canEdit && !flip ? (
            <p className="text-xs text-muted-foreground">View-only — ask an editor to link a flip.</p>
          ) : null}

          {floorPlans.length < 2 ? (
            <p className="text-xs text-muted-foreground" data-testid="floor-plan-flip-need-two">
              Add a second layout on this event before linking a before/after pair. A single-layout
              wedding does not need a flip link.
            </p>
          ) : null}

          {warning ? (
            <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="floor-plan-flip-warning">
              {warning}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" data-testid="floor-plan-flip-error">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
