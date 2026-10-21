"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge } from "lucide-react";

import {
  confirmMergeLeadsAction,
  previewMergeLeadsAction,
} from "@/app/(app)/leads/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  KEEP_BOTH_INQUIRY_CHOICE,
  type FieldDiff,
  type MergePreview,
} from "@/lib/leads/merge";

function formatTour(scheduledAt: string | null, status: string) {
  if (!scheduledAt) return `${status} (no scheduled time)`;
  try {
    return `${new Date(scheduledAt).toLocaleString()} · ${status}`;
  } catch {
    return `${scheduledAt} · ${status}`;
  }
}

export function MergeLeadButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="merge-lead-open"
      >
        <GitMerge className="mr-1 h-3.5 w-3.5" />
        Merge lead
      </Button>
      <MergeLeadDialog open={open} onOpenChange={setOpen} currentLeadId={leadId} />
    </>
  );
}

export function MergeLeadDialog({
  open,
  onOpenChange,
  currentLeadId,
  initialOtherLeadId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLeadId: string;
  initialOtherLeadId?: string;
}) {
  const router = useRouter();
  const [otherId, setOtherId] = React.useState(initialOtherLeadId ?? "");
  const [preview, setPreview] = React.useState<MergePreview | null>(null);
  const [pending, setPending] = React.useState(false);
  const [fieldChoices, setFieldChoices] = React.useState<Record<string, string>>({});
  const [tourCancelIds, setTourCancelIds] = React.useState<string[]>([]);
  const [explicitPrimaryId, setExplicitPrimaryId] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!open) {
      setPreview(null);
      setFieldChoices({});
      setTourCancelIds([]);
      setExplicitPrimaryId(undefined);
      if (!initialOtherLeadId) setOtherId("");
      return;
    }
    if (initialOtherLeadId) setOtherId(initialOtherLeadId);
  }, [open, initialOtherLeadId]);

  async function runPreview(primaryOverride?: string, otherOverride?: string) {
    const other = (otherOverride ?? otherId).trim();
    if (!other) {
      toast.error("Enter the other lead’s ID to merge with.");
      return;
    }
    setPending(true);
    const result = await previewMergeLeadsAction(
      currentLeadId,
      other,
      primaryOverride ?? explicitPrimaryId,
    );
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      setPreview(null);
      return;
    }
    setPreview(result);
    const fills: Record<string, string> = {};
    for (const d of result.fieldDiffs) {
      if (d.kind === "fill") fills[d.key] = d.secondaryValue;
      // Default inquiry conflicts to Keep both (recommended).
      if (d.kind === "conflict" && d.key === "inquiry_message") {
        fills[d.key] = KEEP_BOTH_INQUIRY_CHOICE;
      }
    }
    setFieldChoices(fills);
    setTourCancelIds([]);
  }

  // When opened from duplicate review with a matched lead, load preview immediately.
  React.useEffect(() => {
    if (!open || !initialOtherLeadId) return;
    void runPreview(undefined, initialOtherLeadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open with matched id
  }, [open, initialOtherLeadId, currentLeadId]);

  async function confirm() {
    if (!preview) return;
    if (preview.blockers.length > 0) {
      toast.error(preview.blockers.map((b) => b.message).join(" "));
      return;
    }
    if (preview.needsExplicitPrimaryChoice && !explicitPrimaryId) {
      toast.error("These leads have the same created time — choose which one survives.");
      return;
    }
    for (const d of preview.fieldDiffs) {
      if (d.kind === "conflict" && !fieldChoices[d.key]) {
        toast.error(`Choose a value for ${d.label}.`);
        return;
      }
    }
    setPending(true);
    const result = await confirmMergeLeadsAction({
      primaryId: preview.primary.id,
      secondaryId: preview.secondary.id,
      primaryUpdatedAt: preview.primary.updatedAt,
      secondaryUpdatedAt: preview.secondary.updatedAt,
      fieldChoices,
      tourCancelIds,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(
      result.alreadyMerged
        ? "Already merged — opening the surviving lead."
        : "Leads merged. Opening the surviving lead.",
    );
    onOpenChange(false);
    router.push(`/leads/${result.primaryId}`);
    router.refresh();
  }

  function renderDiff(d: FieldDiff) {
    if (d.kind === "same") {
      return (
        <p key={d.key} className="text-xs text-muted-foreground">
          {d.label}: identical ({d.value})
        </p>
      );
    }
    if (d.kind === "keep_primary") {
      return (
        <p key={d.key} className="text-xs text-muted-foreground">
          {d.label}: keeping primary ({d.primaryValue ?? "empty"})
        </p>
      );
    }
    if (d.kind === "fill") {
      return (
        <p key={d.key} className="text-sm">
          <span className="font-medium text-heading">{d.label}</span>
          {" — fill empty primary from secondary: "}
          <span className="text-muted-foreground">{d.secondaryValue}</span>
        </p>
      );
    }
    if (d.key === "inquiry_message" && d.kind === "conflict") {
      return (
        <div
          key={d.key}
          className="space-y-2 rounded-md border border-border px-3 py-2"
          data-testid="merge-inquiry-choices"
        >
          <p className="text-sm font-medium text-heading">{d.label}</p>
          <p className="text-xs text-muted-foreground">
            Keep both stores each submission separately in history. It does not combine them into one
            field.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={`merge-field-${d.key}`}
              checked={fieldChoices[d.key] === KEEP_BOTH_INQUIRY_CHOICE}
              onChange={() => setFieldChoices((c) => ({ ...c, [d.key]: KEEP_BOTH_INQUIRY_CHOICE }))}
              data-testid="merge-inquiry-keep-both"
            />
            <span>
              <span className="font-medium">Keep both messages</span>
              <span className="block text-xs text-muted-foreground">
                Recommended — primary inquiry stays: {d.primaryValue}. Secondary is kept as
                additional inquiry history.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={`merge-field-${d.key}`}
              checked={fieldChoices[d.key] === d.primaryValue}
              onChange={() => setFieldChoices((c) => ({ ...c, [d.key]: d.primaryValue }))}
              data-testid="merge-inquiry-keep-primary"
            />
            <span>
              Keep primary message only
              <span className="block text-xs text-muted-foreground">{d.primaryValue}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={`merge-field-${d.key}`}
              checked={fieldChoices[d.key] === d.secondaryValue}
              onChange={() => setFieldChoices((c) => ({ ...c, [d.key]: d.secondaryValue }))}
              data-testid="merge-inquiry-use-secondary"
            />
            <span>
              Use secondary message as primary inquiry
              <span className="block text-xs text-muted-foreground">{d.secondaryValue}</span>
            </span>
          </label>
        </div>
      );
    }
    return (
      <div key={d.key} className="space-y-1 rounded-md border border-border px-3 py-2">
        <p className="text-sm font-medium text-heading">{d.label} — choose one</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`merge-field-${d.key}`}
            checked={fieldChoices[d.key] === d.primaryValue}
            onChange={() => setFieldChoices((c) => ({ ...c, [d.key]: d.primaryValue }))}
          />
          <span>Keep primary: {d.primaryValue}</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`merge-field-${d.key}`}
            checked={fieldChoices[d.key] === d.secondaryValue}
            onChange={() => setFieldChoices((c) => ({ ...c, [d.key]: d.secondaryValue }))}
          />
          <span>Use secondary: {d.secondaryValue}</span>
        </label>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="merge-lead-dialog">
        <DialogHeader>
          <DialogTitle>Merge lead</DialogTitle>
          <DialogDescription>
            Combine a confirmed duplicate into one surviving lead. The earliest submission
            survives by default. Appointments are reassociated — not deleted and recreated.
            This cannot be undone automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <Label htmlFor="merge-other-lead">Other lead ID</Label>
            <div className="flex gap-2">
              <Input
                id="merge-other-lead"
                value={otherId}
                onChange={(e) => setOtherId(e.target.value)}
                placeholder="Paste the duplicate lead’s ID"
                data-testid="merge-other-lead-id"
              />
              <Button type="button" variant="secondary" disabled={pending} onClick={() => void runPreview()}>
                Preview
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Current lead: <code className="text-[11px]">{currentLeadId}</code>
            </p>
          </div>

          {preview ? (
            <div className="space-y-4">
              {preview.blockers.length > 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  {preview.blockers.map((b) => (
                    <p key={b.code}>{b.message}</p>
                  ))}
                </div>
              ) : null}

              {(preview.needsExplicitPrimaryChoice || !preview.primaryIsDefaultEarliest) && (
                <div className="space-y-2 rounded-md border border-border px-3 py-2">
                  <p className="font-medium text-heading">Which lead survives?</p>
                  {preview.needsExplicitPrimaryChoice ? (
                    <p className="text-xs text-muted-foreground">
                      Created times match — you must choose explicitly.
                    </p>
                  ) : null}
                  <label className="flex gap-2">
                    <input
                      type="radio"
                      name="merge-primary"
                      checked={preview.primary.id === (explicitPrimaryId ?? preview.primary.id)
                        && (explicitPrimaryId === preview.primary.id || !explicitPrimaryId)}
                      onChange={() => {
                        setExplicitPrimaryId(preview.primary.id);
                        void runPreview(preview.primary.id);
                      }}
                    />
                    <span>
                      {preview.primary.displayName} (created {new Date(preview.primary.createdAt).toLocaleString()})
                      {preview.primaryIsDefaultEarliest ? " — earliest" : ""}
                    </span>
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="radio"
                      name="merge-primary"
                      checked={explicitPrimaryId === preview.secondary.id}
                      onChange={() => {
                        setExplicitPrimaryId(preview.secondary.id);
                        void runPreview(preview.secondary.id);
                      }}
                    />
                    <span>
                      {preview.secondary.displayName} (created {new Date(preview.secondary.createdAt).toLocaleString()})
                    </span>
                  </label>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Survives (primary)</p>
                  <p className="font-medium text-heading">{preview.primary.displayName}</p>
                  <p className="text-muted-foreground">{preview.primary.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(preview.primary.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Merged away (secondary)</p>
                  <p className="font-medium text-heading">{preview.secondary.displayName}</p>
                  <p className="text-muted-foreground">{preview.secondary.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(preview.secondary.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-heading">Fields</p>
                {preview.fieldDiffs.length === 0 ? (
                  <p className="text-muted-foreground">No field differences requiring action.</p>
                ) : (
                  preview.fieldDiffs.map(renderDiff)
                )}
              </div>

              <div className="space-y-2">
                <p className="font-medium text-heading">Notes & history</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {preview.relatedSummary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-heading">Tour appointments</p>
                {preview.tours.length === 0 ? (
                  <p className="text-muted-foreground">No tour appointments on either lead.</p>
                ) : (
                  <ul className="space-y-2">
                    {preview.tours.map((t) => {
                      const cancel = tourCancelIds.includes(t.id);
                      return (
                        <li key={t.id} className="rounded-md border border-border px-3 py-2">
                          <p className="text-sm">
                            {formatTour(t.scheduledAt, t.status)}
                            {t.leadId === preview.primary.id ? " · on primary" : " · on secondary"}
                          </p>
                          {(t.status === "scheduled" || t.status === "confirmed") && (
                            <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={cancel}
                                onChange={(e) => {
                                  setTourCancelIds((ids) =>
                                    e.target.checked
                                      ? [...ids, t.id]
                                      : ids.filter((id) => id !== t.id),
                                  );
                                }}
                              />
                              Cancel this tour (releases the slot). Leave unchecked to keep and
                              reassociate to the primary lead.
                            </label>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {preview.occupyingTourConflict ? (
                  <p className="text-xs text-muted-foreground">
                    Both leads have active tours. Both will be kept on the primary unless you
                    cancel one above. Times are never chosen silently.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !preview || preview.blockers.length > 0}
            onClick={() => void confirm()}
            data-testid="merge-lead-confirm"
          >
            Confirm merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
