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
import {
  canAdvanceToMergeFinalConfirm,
  fieldDiffShown,
  type FieldDiff,
  type MergePreview,
  type MergeSearchCandidate,
} from "@/lib/leads/merge-client";
import { formatPhoneDisplay } from "@/lib/sms/phone";
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
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-heading">{candidate.displayName}</p>
        {selected ? (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-heading">
            Selected
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
        {candidate.email ? <p>{candidate.email}</p> : null}
        {candidate.phone ? <p>{formatPhoneDisplay(candidate.phone)}</p> : null}
        {candidate.partnerDisplayName || candidate.partnerEmail ? (
          <p>
            Partner: {[candidate.partnerDisplayName, candidate.partnerEmail].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {candidate.eventDate ? <p>Event date: {candidate.eventDate}</p> : null}
        {candidate.createdAt ? <p>Submitted: {formatSubmitted(candidate.createdAt)}</p> : null}
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
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [fieldChoices, setFieldChoices] = React.useState<Record<string, string>>({});
  const [tourCancelIds, setTourCancelIds] = React.useState<string[]>([]);
  const [explicitPrimaryId, setExplicitPrimaryId] = React.useState<string | undefined>();
  const [finalConfirmOpen, setFinalConfirmOpen] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGen = React.useRef(0);
  const previewGen = React.useRef(0);
  const submittingRef = React.useRef(false);

  function resetDiscoveryState() {
    setPreview(null);
    setPreviewError(null);
    setFieldChoices({});
    setTourCancelIds([]);
    setExplicitPrimaryId(undefined);
    setQuery("");
    setCandidates([]);
    setSearching(false);
    setSearchError(null);
    setSelected(null);
    setOtherId("");
    setFinalConfirmOpen(false);
    setPreviewing(false);
  }

  React.useEffect(() => {
    if (!open) {
      resetDiscoveryState();
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
    setPreviewError(null);
    setSelected(null);
    setOtherId("");
    setFinalConfirmOpen(false);
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

  async function runPreview(primaryOverride?: string, otherOverride?: string) {
    const other = (otherOverride ?? otherId).trim();
    if (!other) {
      setPreviewError("Select a duplicate lead to preview the merge.");
      toast.error("Select a duplicate lead to preview the merge.");
      return;
    }
    if (other === currentLeadId) {
      setPreview(null);
      setPreviewError("Choose a different lead — you cannot merge a lead into itself.");
      toast.error("Choose a different lead — you cannot merge a lead into itself.");
      return;
    }
    const gen = ++previewGen.current;
    setPreviewing(true);
    setPending(true);
    setPreviewError(null);
    setFinalConfirmOpen(false);
    const result = await previewMergeLeadsAction(
      currentLeadId,
      other,
      primaryOverride ?? explicitPrimaryId,
    );
    if (gen !== previewGen.current) return;
    setPreviewing(false);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      setPreview(null);
      setPreviewError(result.message);
      return;
    }
    setPreview(result);
    setPreviewError(null);
    const fills: Record<string, string> = {};
    for (const d of result.fieldDiffs) {
      if (d.kind === "fill") fills[d.key] = d.secondaryValue;
      if (d.kind === "conflict" && d.key === "inquiry_message") {
        fills[d.key] = KEEP_BOTH_INQUIRY_CHOICE;
      }
    }
    setFieldChoices(fills);
    // Do not clear tourCancelIds here — survivor reorientation must keep cancel choices.
    // selectCandidate / resetDiscoveryState clear them when the lead pair changes.
  }

  function selectCandidate(c: MergeSearchCandidate) {
    if (c.id === currentLeadId) {
      toast.error("Choose a different lead — you cannot merge a lead into itself.");
      return;
    }
    setSelected(c);
    setOtherId(c.id);
    setPreview(null);
    setPreviewError(null);
    setFinalConfirmOpen(false);
    setExplicitPrimaryId(undefined);
    setFieldChoices({});
    setTourCancelIds([]);
    void runPreview(undefined, c.id);
  }

  function selectSurvivor(leadId: string) {
    if (!preview || pending || previewing) return;
    if (leadId === preview.primary.id) return;
    setExplicitPrimaryId(leadId);
    setFinalConfirmOpen(false);
    void runPreview(leadId);
  }

  // Duplicate-review banner: auto-preview matched lead.
  React.useEffect(() => {
    if (!open || !initialOtherLeadId) return;
    void runPreview(undefined, initialOtherLeadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open with matched id
  }, [open, initialOtherLeadId, currentLeadId]);

  function openFinalConfirm() {
    if (!preview) {
      toast.error("Wait for the merge preview to finish loading.");
      return;
    }
    if (preview.blockers.length > 0) {
      toast.error(preview.blockers.map((b) => b.message).join(" "));
      return;
    }
    if (preview.needsExplicitPrimaryChoice && !explicitPrimaryId) {
      toast.error("These leads have the same created time — choose which one survives.");
      return;
    }
    if (!canAdvanceToMergeFinalConfirm({ preview, explicitPrimaryId, fieldChoices })) {
      const unresolved = preview.fieldDiffs.find(
        (d) => d.kind === "conflict" && !fieldChoices[d.key],
      );
      toast.error(unresolved ? `Choose a value for ${unresolved.label}.` : "Finish the merge preview first.");
      return;
    }
    setFinalConfirmOpen(true);
  }

  async function confirmPermanentMerge() {
    if (!preview || submittingRef.current) return;
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
    submittingRef.current = true;
    setPending(true);
    try {
      const result = await confirmMergeLeadsAction({
        primaryId: preview.primary.id,
        secondaryId: preview.secondary.id,
        primaryUpdatedAt: preview.primary.updatedAt,
        secondaryUpdatedAt: preview.secondary.updatedAt,
        fieldChoices,
        tourCancelIds,
      });
      if (!result.ok) {
        toast.error(result.message);
        setFinalConfirmOpen(false);
        // Refresh preview so stale timestamps / blockers surface clearly
        const other =
          preview.primary.id === currentLeadId ? preview.secondary.id : preview.primary.id;
        void runPreview(preview.primary.id, other);
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
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  function renderDiff(d: FieldDiff) {
    if (d.kind === "same") {
      return (
        <p key={d.key} className="text-xs text-muted-foreground">
          {d.label}: identical ({fieldDiffShown(d, "value")})
        </p>
      );
    }
    if (d.kind === "keep_primary") {
      return (
        <p key={d.key} className="text-xs text-muted-foreground">
          {d.label}: keeping primary ({fieldDiffShown(d, "primary")})
        </p>
      );
    }
    if (d.kind === "fill") {
      return (
        <p key={d.key} className="text-sm" data-testid={`merge-fill-${d.key}`}>
          <span className="font-medium text-heading">{d.label}</span>
          {" — fill empty primary from secondary: "}
          <span className="text-muted-foreground">{fieldDiffShown(d, "secondary")}</span>
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
                Recommended — primary inquiry stays: {fieldDiffShown(d, "primary")}. Secondary is kept as
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
              <span className="block text-xs text-muted-foreground">{fieldDiffShown(d, "primary")}</span>
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
              <span className="block text-xs text-muted-foreground">{fieldDiffShown(d, "secondary")}</span>
            </span>
          </label>
        </div>
      );
    }
    if (d.kind !== "conflict") return null;
    return (
      <div
        key={d.key}
        className="space-y-1 rounded-md border border-border px-3 py-2"
        data-testid={`merge-conflict-${d.key}`}
      >
        <p className="text-sm font-medium text-heading">{d.label} — choose one</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`merge-field-${d.key}`}
            checked={fieldChoices[d.key] === d.primaryValue}
            onChange={() => setFieldChoices((c) => ({ ...c, [d.key]: d.primaryValue }))}
          />
          <span>Keep primary: {fieldDiffShown(d, "primary")}</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`merge-field-${d.key}`}
            checked={fieldChoices[d.key] === d.secondaryValue}
            onChange={() => setFieldChoices((c) => ({ ...c, [d.key]: d.secondaryValue }))}
          />
          <span>Use secondary: {fieldDiffShown(d, "secondary")}</span>
        </label>
      </div>
    );
  }

  const trimmedQuery = query.trim();
  const showResultsPanel = trimmedQuery.length > 0 && !searching;
  const noResults = showResultsPanel && !searchError && candidates.length === 0;
  const ambiguous = candidates.length > 1;
  const canContinueToFinal = canAdvanceToMergeFinalConfirm({
    preview,
    explicitPrimaryId,
    fieldChoices,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="merge-lead-dialog">
        <DialogHeader>
          <DialogTitle>Merge lead</DialogTitle>
          <DialogDescription>
            Find the duplicate by name, email, or phone. Select it to preview what will happen.
            The earliest submission survives by default. Appointments are reassociated — not
            deleted and recreated. Merging permanently changes your records and cannot be undone
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground" data-testid="merge-steps">
            <li>Find the duplicate</li>
            <li>Select the matching lead (preview loads automatically)</li>
            <li>Review the preview</li>
            <li>Confirm the permanent merge</li>
          </ol>

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
              Candidates only — nothing merges until you confirm permanently. The current lead is
              excluded.
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

            {selected && previewing ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="merge-preview-loading">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading merge preview for {selected.displayName}…
              </p>
            ) : null}

            {previewError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="merge-preview-error">
                {previewError}
              </p>
            ) : null}
          </div>

          {preview ? (
            <div className="space-y-4" data-testid="merge-preview-panel">
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {preview.needsExplicitPrimaryChoice && !explicitPrimaryId ? (
                  <p data-testid="merge-survivor-reason">
                    Created times match — choose which lead survives before confirming.
                  </p>
                ) : preview.primaryIsDefaultEarliest ? (
                  <p data-testid="merge-survivor-reason">
                    Surviving lead defaults to the earliest submission (
                    {formatSubmitted(preview.primary.createdAt)}). Select the other lead below if
                    that is incorrect.
                  </p>
                ) : (
                  <p data-testid="merge-survivor-reason">
                    You selected a survivor other than the earliest submission. Field choices below
                    use this survivor as primary.
                  </p>
                )}
              </div>

              {preview.blockers.length > 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="merge-preview-blockers">
                  {preview.blockers.map((b) => (
                    <p key={b.code}>{b.message}</p>
                  ))}
                </div>
              ) : null}

              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Which lead survives"
                data-testid="merge-survivor-radiogroup"
              >
                <label
                  className={cn(
                    "cursor-pointer rounded-md border px-3 py-2 transition-colors",
                    "border-heading bg-muted/30 ring-1 ring-heading/30",
                  )}
                  data-testid="merge-preview-survivor"
                  data-lead-id={preview.primary.id}
                  data-role="survives"
                >
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="merge-primary"
                      className="mt-1"
                      checked
                      disabled={pending || previewing}
                      onChange={() => selectSurvivor(preview.primary.id)}
                      data-testid="merge-survivor-radio"
                      data-lead-id={preview.primary.id}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                        Survives
                        {preview.primaryIsDefaultEarliest ? " · earliest" : ""}
                      </span>
                      <span className="block font-medium text-heading">{preview.primary.displayName}</span>
                      {preview.primary.email ? (
                        <span className="block text-muted-foreground">{preview.primary.email}</span>
                      ) : null}
                      {preview.primary.phone ? (
                        <span className="block text-muted-foreground">
                          {formatPhoneDisplay(preview.primary.phone)}
                        </span>
                      ) : null}
                      <span className="block text-xs text-muted-foreground">
                        Submitted {new Date(preview.primary.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    "cursor-pointer rounded-md border px-3 py-2 transition-colors",
                    "border-border hover:bg-muted/30",
                  )}
                  data-testid="merge-preview-secondary"
                  data-lead-id={preview.secondary.id}
                  data-role="marked-merged"
                >
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="merge-primary"
                      className="mt-1"
                      checked={false}
                      disabled={pending || previewing}
                      onChange={() => selectSurvivor(preview.secondary.id)}
                      data-testid="merge-survivor-radio"
                      data-lead-id={preview.secondary.id}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                        Marked merged
                      </span>
                      <span className="block font-medium text-heading">{preview.secondary.displayName}</span>
                      {preview.secondary.email ? (
                        <span className="block text-muted-foreground">{preview.secondary.email}</span>
                      ) : null}
                      {preview.secondary.phone ? (
                        <span className="block text-muted-foreground">
                          {formatPhoneDisplay(preview.secondary.phone)}
                        </span>
                      ) : null}
                      <span className="block text-xs text-muted-foreground">
                        Submitted {new Date(preview.secondary.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </span>
                </label>
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

              <div className="space-y-2" data-testid="merge-tour-section">
                <p className="font-medium text-heading">Tour appointments</p>
                {preview.tours.length === 0 ? (
                  <p className="text-muted-foreground">No tour appointments on either lead.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground" data-testid="merge-tour-policy">
                      Each appointment below is a separate record. All are kept and reassociated to
                      the surviving lead unless you cancel an active (scheduled or confirmed) tour.
                      Completed and past appointments cannot be cancelled here.
                    </p>
                    <ul className="space-y-2">
                      {preview.tours.map((t) => {
                        const cancel = tourCancelIds.includes(t.id);
                        const canCancel = t.status === "scheduled" || t.status === "confirmed";
                        const ownership =
                          t.leadId === preview.primary.id ? "on surviving lead" : "on duplicate";
                        return (
                          <li
                            key={t.id}
                            className="rounded-md border border-border px-3 py-2"
                            data-testid="merge-tour-row"
                            data-tour-id={t.id}
                            data-tour-status={t.status}
                            data-ownership={t.leadId === preview.primary.id ? "survivor" : "duplicate"}
                          >
                            <p className="text-sm">
                              {formatTour(t.scheduledAt, t.status)}
                              {" · "}
                              {ownership}
                            </p>
                            {canCancel ? (
                              <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={cancel}
                                  onChange={(e) => {
                                    setTourCancelIds((ids) =>
                                      e.target.checked
                                        ? [...ids, t.id]
                                        : ids.filter((id) => id !== t.id),
                                    );
                                  }}
                                  data-testid="merge-tour-cancel"
                                  data-tour-id={t.id}
                                />
                                <span>
                                  {cancel
                                    ? "Will cancel this tour and release the slot."
                                    : "Keep and reassociate to the surviving lead (default). Check to cancel instead."}
                                </span>
                              </label>
                            ) : (
                              <p
                                className="mt-2 text-xs text-muted-foreground"
                                data-testid="merge-tour-keep-note"
                              >
                                Kept — will reassociate to the surviving lead. No choice needed for
                                this status.
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {preview.occupyingTourConflict ? (
                  <p className="text-xs text-muted-foreground" data-testid="merge-tour-occupying-hint">
                    Both leads have active tours. Both stay on the surviving lead unless you cancel
                    one above. Times are never chosen silently.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {finalConfirmOpen && preview ? (
            <div
              className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3"
              data-testid="merge-final-confirm"
            >
              <p className="font-medium text-heading">Confirm permanent merge</p>
              <p className="text-sm text-muted-foreground">
                This permanently changes your records and cannot be undone automatically.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li data-testid="merge-final-survivor" data-lead-id={preview.primary.id}>
                  Survives: <span className="font-medium text-heading">{preview.primary.displayName}</span>
                  {preview.primary.email ? ` (${preview.primary.email})` : ""}
                </li>
                <li data-testid="merge-final-merged" data-lead-id={preview.secondary.id}>
                  Marked merged: <span className="font-medium text-heading">{preview.secondary.displayName}</span>
                  {preview.secondary.email ? ` (${preview.secondary.email})` : ""}
                </li>
                <li data-testid="merge-final-tours">
                  {preview.tours.length === 0
                    ? "No tour appointments to reassociate."
                    : tourCancelIds.length > 0
                      ? `${preview.tours.length - tourCancelIds.length} tour appointment(s) reassociated; ${tourCancelIds.length} cancelled.`
                      : `${preview.tours.length} tour appointment(s) will be reassociated to the surviving lead (not deleted). Separate appointments are not mutually exclusive.`}
                </li>
                <li>
                  Notes, tasks, and activity on the duplicate move to the surviving lead per the preview.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setFinalConfirmOpen(false)}
                  data-testid="merge-final-cancel"
                >
                  Cancel — keep both leads
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void confirmPermanentMerge()}
                  data-testid="merge-lead-confirm"
                >
                  {pending ? "Merging…" : "Confirm permanent merge"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {!finalConfirmOpen ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || previewing || !canContinueToFinal}
              onClick={() => openFinalConfirm()}
              data-testid="merge-continue-to-confirm"
            >
              {previewing ? "Loading preview…" : "Continue to permanent merge"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
