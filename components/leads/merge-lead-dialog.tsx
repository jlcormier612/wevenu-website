"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge, Loader2, Search } from "lucide-react";

import {
  confirmMergeLeadsAction,
  previewMergeLeadsAction,
  searchMergeLeadCandidatesAction,
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
import { KEEP_BOTH_INQUIRY_CHOICE } from "@/lib/leads/merge-inquiry-choice";
import type { FieldDiff, MergePreview, MergeSearchCandidate } from "@/lib/leads/merge";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

function formatTour(scheduledAt: string | null, status: string) {
  if (!scheduledAt) return `${status} (no scheduled time)`;
  try {
    return `${new Date(scheduledAt).toLocaleString()} · ${status}`;
  } catch {
    return `${scheduledAt} · ${status}`;
  }
}

function formatSubmitted(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function CandidateSummary({
  candidate,
  selected,
  onSelect,
}: {
  candidate: MergeSearchCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      data-testid="merge-candidate-row"
      data-lead-id={candidate.id}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left transition-colors",
        selected
          ? "border-heading bg-muted/40 ring-1 ring-heading/30"
          : "border-border hover:bg-muted/30",
      )}
    >
      <p className="font-medium text-heading">{candidate.displayName}</p>
      <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
        {candidate.email ? <p>{candidate.email}</p> : null}
        {candidate.phone ? <p>{candidate.phone}</p> : null}
        {candidate.partnerDisplayName || candidate.partnerEmail ? (
          <p>
            Partner: {[candidate.partnerDisplayName, candidate.partnerEmail].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {candidate.eventDate ? <p>Event date: {candidate.eventDate}</p> : null}
        <p>Submitted: {formatSubmitted(candidate.createdAt)}</p>
        <p className="font-mono text-[10px] opacity-70" title="Lead ID for troubleshooting">
          ID: {candidate.id}
        </p>
      </div>
    </button>
  );
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
  const [query, setQuery] = React.useState("");
  const [candidates, setCandidates] = React.useState<MergeSearchCandidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<MergeSearchCandidate | null>(null);
  const [otherId, setOtherId] = React.useState(initialOtherLeadId ?? "");
  const [preview, setPreview] = React.useState<MergePreview | null>(null);
  const [pending, setPending] = React.useState(false);
  const [fieldChoices, setFieldChoices] = React.useState<Record<string, string>>({});
  const [tourCancelIds, setTourCancelIds] = React.useState<string[]>([]);
  const [explicitPrimaryId, setExplicitPrimaryId] = React.useState<string | undefined>();
  const [showAdvancedId, setShowAdvancedId] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGen = React.useRef(0);

  function resetDiscoveryState(keepInitial = false) {
    setPreview(null);
    setFieldChoices({});
    setTourCancelIds([]);
    setExplicitPrimaryId(undefined);
    setQuery("");
    setCandidates([]);
    setSearching(false);
    setSearchError(null);
    setSelected(null);
    setShowAdvancedId(false);
    if (!keepInitial || !initialOtherLeadId) setOtherId("");
  }

  React.useEffect(() => {
    if (!open) {
      resetDiscoveryState(false);
      return;
    }
    if (initialOtherLeadId) {
      setOtherId(initialOtherLeadId);
      setSelected({
        id: initialOtherLeadId,
        displayName: "Matched duplicate",
        email: null,
        phone: null,
        partnerDisplayName: null,
        partnerEmail: null,
        eventDate: null,
        createdAt: "",
        salesStage: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens/closes
  }, [open, initialOtherLeadId]);

  function handleQueryChange(next: string) {
    setQuery(next);
    setPreview(null);
    setSelected(null);
    setOtherId("");
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setSearching(true);
  }

  React.useEffect(() => {
    const q = query.trim();
    if (!open || !q) return;
    debounceRef.current = setTimeout(() => {
      const gen = ++searchGen.current;
      void (async () => {
        const result = await searchMergeLeadCandidatesAction(currentLeadId, q);
        if (gen !== searchGen.current) return;
        setSearching(false);
        if (!result.ok) {
          setCandidates([]);
          setSearchError(result.message);
          return;
        }
        setSearchError(null);
        setCandidates(result.candidates);
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, currentLeadId]);

  function selectCandidate(c: MergeSearchCandidate) {
    if (c.id === currentLeadId) {
      toast.error("Choose a different lead — you cannot merge a lead into itself.");
      return;
    }
    setSelected(c);
    setOtherId(c.id);
    setPreview(null);
  }

  async function runPreview(primaryOverride?: string, otherOverride?: string) {
    const other = (otherOverride ?? otherId).trim();
    if (!other) {
      toast.error("Select a duplicate lead before previewing the merge.");
      return;
    }
    if (other === currentLeadId) {
      toast.error("Choose a different lead — you cannot merge a lead into itself.");
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

  const trimmedQuery = query.trim();
  const showResultsPanel = trimmedQuery.length > 0 && !searching;
  const noResults = showResultsPanel && !searchError && candidates.length === 0;
  const ambiguous = candidates.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="merge-lead-dialog">
        <DialogHeader>
          <DialogTitle>Merge lead</DialogTitle>
          <DialogDescription>
            Find a confirmed duplicate, preview what will happen, then confirm. The earliest
            submission survives by default. Appointments are reassociated — not deleted and
            recreated. This cannot be undone automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <Label htmlFor="merge-find-duplicate">Find the duplicate lead</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="merge-find-duplicate"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search by name, email, or phone"
                className="pl-9"
                data-testid="merge-find-duplicate"
                autoComplete="off"
              />
              {searching ? (
                <Loader2 className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Results are candidates only — select one, then preview. Current lead is excluded.
            </p>

            {searchError ? (
              <p className="text-sm text-destructive" data-testid="merge-search-error">
                {searchError}
              </p>
            ) : null}

            {noResults ? (
              <p className="rounded-md border border-border px-3 py-2 text-muted-foreground" data-testid="merge-search-empty">
                No matching leads in this venue. Try another name, email, or phone.
              </p>
            ) : null}

            {showResultsPanel && candidates.length > 0 ? (
              <div className="space-y-2" data-testid="merge-search-results" role="listbox">
                {ambiguous ? (
                  <p className="text-xs text-muted-foreground" data-testid="merge-search-ambiguous">
                    Multiple matches — pick the correct duplicate carefully.
                  </p>
                ) : null}
                {candidates.map((c) => (
                  <CandidateSummary
                    key={c.id}
                    candidate={c}
                    selected={selected?.id === c.id}
                    onSelect={() => selectCandidate(c)}
                  />
                ))}
              </div>
            ) : null}

            {selected && !preview ? (
              <div
                className="rounded-md border border-border bg-muted/20 px-3 py-2"
                data-testid="merge-selected-candidate"
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected duplicate</p>
                <p className="font-medium text-heading">{selected.displayName}</p>
                {selected.email ? <p className="text-muted-foreground">{selected.email}</p> : null}
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || !otherId}
                    onClick={() => void runPreview()}
                    data-testid="merge-preview"
                  >
                    Preview merge
                  </Button>
                </div>
              </div>
            ) : null}

            <div>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShowAdvancedId((v) => !v)}
                data-testid="merge-advanced-id-toggle"
              >
                {showAdvancedId ? "Hide lead ID entry" : "Paste lead ID (troubleshooting)"}
              </button>
              {showAdvancedId ? (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={otherId}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setOtherId(v);
                      setSelected(v ? {
                        id: v,
                        displayName: "Lead by ID",
                        email: null,
                        phone: null,
                        partnerDisplayName: null,
                        partnerEmail: null,
                        eventDate: null,
                        createdAt: "",
                        salesStage: null,
                      } : null);
                      setPreview(null);
                    }}
                    placeholder="Duplicate lead UUID"
                    data-testid="merge-other-lead-id"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || !otherId.trim()}
                    onClick={() => void runPreview()}
                  >
                    Preview
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {preview ? (
            <div className="space-y-4" data-testid="merge-preview-panel">
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {preview.primaryIsDefaultEarliest && !preview.needsExplicitPrimaryChoice ? (
                  <p data-testid="merge-survivor-reason">
                    Proposed survivor is the earliest submission (
                    {formatSubmitted(preview.primary.createdAt)}). You can choose the other lead
                    below if that is incorrect.
                  </p>
                ) : preview.needsExplicitPrimaryChoice ? (
                  <p data-testid="merge-survivor-reason">
                    Created times match — choose which lead survives before confirming.
                  </p>
                ) : (
                  <p data-testid="merge-survivor-reason">
                    You overrode the earliest-submission default. Confirm the survivor below.
                  </p>
                )}
              </div>

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
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{preview.primary.id}</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Merged away (secondary)</p>
                  <p className="font-medium text-heading">{preview.secondary.displayName}</p>
                  <p className="text-muted-foreground">{preview.secondary.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(preview.secondary.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{preview.secondary.id}</p>
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
