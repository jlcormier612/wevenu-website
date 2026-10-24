"use client";

/**
 * Client selections composer — mirrors Package/Proposal sheet grammar:
 * template dropdown + right-hand full offering preview + send via ShareDialog.
 * Sending creates a selection request only — does not finalize EO or invoice.
 */
import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createClientChoicesFromEventOrderTemplateAction,
  finalizeClientChoicesAction,
  requestClientChoicesChangesAction,
  reviseClientChoicesAction,
  sendClientChoicesAction,
  sendClientChoicesRequestAction,
} from "@/app/(app)/events/[id]/client-choices-actions";
import {
  addSelectionsToExistingInvoiceAction,
  createInvoiceFromEventOrderAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { getEventOrderTemplateDetailAction } from "@/app/(app)/library/event-order-templates/actions";
import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { ChoicesDefinitionView } from "@/components/client-choices/choices-definition-view";
import { EventOrderTemplatePreviewView } from "@/components/event-order-templates/event-order-template-preview";
import { ShareDialog } from "@/components/sharing/share-dialog";
import {
  eventOrderApplyConfirmMessage,
  eventOrderApplyLabel,
} from "@/lib/client-choices/event-order-apply-cta";
import { financialImpactCopy } from "@/lib/client-choices/selections-billing";
import type { SelectionsFinancialImpact } from "@/lib/client-choices/selections-billing";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  clientChoicesDisplayLabel,
  clientChoicesNextActor,
  isClientChoicesNeedsVenueReview,
} from "@/lib/client-choices/constants";
import type { ClientChoices, ClientChoicesWithHistory } from "@/lib/client-choices/types";
import type {
  EventOrderTemplate,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

export { eventOrderApplyConfirmMessage, eventOrderApplyLabel };

type ShareRecipientProps = {
  clientName?: string | null;
  clientEmail?: string | null;
  venueName?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
};

function summarizeAnswers(row: ClientChoices): string {
  const parts: string[] = [];
  for (const group of row.definition.groups) {
    const answer = row.answers[group.id];
    if (!answer?.optionIds?.length) continue;
    const labels = answer.optionIds
      .map((id) => row.definition.options.find((o) => o.id === id)?.label)
      .filter(Boolean);
    if (labels.length) parts.push(`${group.name}: ${labels.join(", ")}`);
  }
  return parts.length ? parts.join(" · ") : "No selections yet";
}

/** Prefer the packet that needs venue action, then awaiting client, then draft. */
function pickActiveChoices(
  choices: ClientChoicesWithHistory[],
): ClientChoicesWithHistory | null {
  if (choices.length === 0) return null;
  return (
    choices.find((c) => isClientChoicesNeedsVenueReview(c.status))
    ?? choices.find((c) => {
      const s = c.status;
      return s === "sent" || s === "in_progress" || s === "changes_requested";
    })
    ?? choices.find((c) => c.status === "draft")
    ?? choices[0]
    ?? null
  );
}

function ChoicesComposerActions({
  eventId,
  row,
  hasEventOrder,
  shareContext,
  onPreviewSend,
}: {
  eventId: string;
  row: ClientChoicesWithHistory | ClientChoices;
  hasEventOrder: boolean;
  shareContext: ShareRecipientProps;
  onPreviewSend: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [showNote, setShowNote] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [sendingRequest, setSendingRequest] = React.useState(false);
  const actor = clientChoicesNextActor(row.status);
  const submissions = "submissions" in row ? row.submissions : [];
  const needsReview = isClientChoicesNeedsVenueReview(row.status);
  const appliedLineIds = row.appliedLineIds ?? [];
  const applyLabel = eventOrderApplyLabel({
    hasEventOrder,
    eventOrderId: row.eventOrderId,
    appliedLineIds,
  });
  const canEmailRequest = row.status === "draft" || row.status === "sent" || row.status === "in_progress";
  const shareRecipient = shareContext.clientName
    ? {
        name: shareContext.clientName,
        contact: shareContext.clientEmail ?? null,
        relationshipLabel: "Client",
      }
    : null;
  const shareDefaultMessage = mergeContent(
    "Please review and submit your selections for {{event_name}} when you have a moment.",
    buildMergeData({
      venueName: shareContext.venueName ?? "Your venue",
      clientName: shareContext.clientName ?? "",
      coordinatorName: shareContext.venueName ?? "",
      eventDate: shareContext.eventDate ?? null,
      eventName: shareContext.eventName ?? "",
    }),
  );

  async function runSelectionRequest(message: string) {
    if (sendingRequest) {
      return { ok: false as const, message: "Already sending — wait for this request to finish." };
    }
    setSendingRequest(true);
    try {
      const r = await sendClientChoicesRequestAction(eventId, row.id, message);
      if (!r.ok) {
        return { ok: false as const, message: r.message ?? "Could not send the selection request." };
      }
      router.refresh();
      if (!r.email.submitted) {
        toast.message("Available in the couple’s portal. Email was not submitted.");
        return {
          ok: false as const,
          message: r.email.message
            ?? "Available in the portal, but the email was not submitted. You can retry.",
        };
      }
      toast.success(
        r.email.message ?? "Selection request email submitted. Delivery is confirmed separately.",
      );
      return { ok: true as const };
    } finally {
      setSendingRequest(false);
    }
  }

  return (
    <div
      className="space-y-3"
      data-testid={`client-choices-row-${row.id}`}
      data-status={row.status}
      data-needs-review={needsReview ? "true" : "false"}
    >
      <div>
        <p className="text-sm font-medium text-heading">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {clientChoicesDisplayLabel(row.status)}
          {actor === "venue" ? " · Venue to act" : actor === "client" ? " · Client to act" : ""}
          {needsReview ? " · Couple submission (not yet on Event Order)" : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{summarizeAnswers(row)}</p>
        {appliedLineIds.length > 0 ? (
          <p className="text-xs text-muted-foreground mt-1" data-testid="choices-prior-applied">
            Previously applied {appliedLineIds.length} Event Order line
            {appliedLineIds.length === 1 ? "" : "s"} from this packet — updating replaces those
            selection lines (not venue-authored fixed lines).
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="choices-staff-preview"
          onClick={onPreviewSend}
        >
          Preview selection request
        </Button>
        {needsReview ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="choices-review-submission"
            onClick={() => setReviewOpen(true)}
          >
            Review selections
          </Button>
        ) : null}
        {canEmailRequest ? (
          <>
            <Button
              type="button"
              size="sm"
              data-testid="choices-send-selection-request"
              onClick={() => setShareOpen(true)}
            >
              {row.status === "draft" ? "Send selection request" : "Resend selection request"}
            </Button>
            <ShareDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              title={row.status === "draft" ? "Send selection request" : "Resend selection request"}
              recipient={shareRecipient}
              whatHappensNext="They'll open their portal, review the complete offering and selectable options, and submit their choices. This emails a secure link — it does not finalize the Event Order, create an invoice, or change booking status."
              defaultMessage={shareDefaultMessage}
              sendLabel={row.status === "draft" ? "Send" : "Resend"}
              onSend={(message) => runSelectionRequest(message)}
              onSent={() => {
                setShareOpen(false);
                router.refresh();
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || sendingRequest}
              data-testid="choices-portal-only"
              onClick={() => startTransition(async () => {
                const r = await sendClientChoicesAction(eventId, row.id);
                if (!r.ok) toast.error(r.message ?? "Could not open in portal.");
                else {
                  toast.success(
                    "Available in the couple’s portal (task created). No email was sent.",
                  );
                  router.refresh();
                }
              })}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Make available in portal"}
            </Button>
          </>
        ) : null}
        {needsReview ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setShowNote((v) => !v)}
            >
              Request Changes
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              data-testid="choices-create-event-order"
              onClick={() => {
                const msg = eventOrderApplyConfirmMessage({
                  hasEventOrder,
                  eventOrderId: row.eventOrderId,
                  appliedLineIds,
                });
                if (!window.confirm(msg)) return;
                startTransition(async () => {
                  const r = await finalizeClientChoicesAction(eventId, row.id);
                  if (!r.ok) {
                    toast.error(r.message ?? "Could not update the Event Order.");
                    return;
                  }
                  if (r.financialDelta === 0) {
                    toast.success("Event Order updated from selections — no additional cost.");
                  } else {
                    toast.success("Event Order updated from selections.");
                  }
                  window.location.hash = "event-order-order";
                  document.getElementById("event-order-order")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                  router.refresh();
                });
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : applyLabel}
            </Button>
          </>
        ) : null}
        {row.status === "finalized" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const r = await reviseClientChoicesAction(eventId, row.id);
              if (!r.ok) toast.error(r.message ?? "Could not start the amendment.");
              else {
                toast.success("Amendment started. Send a selection request when ready.");
                router.refresh();
              }
            })}
          >
            Amend
          </Button>
        ) : null}
      </div>

      {showNote ? (
        <div className="space-y-2">
          <Textarea
            placeholder="What should the client change?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const r = await requestClientChoicesChangesAction(eventId, row.id, note);
              if (!r.ok) toast.error(r.message ?? "Could not request changes.");
              else {
                toast.success("Changes requested.");
                setShowNote(false);
                setNote("");
                router.refresh();
              }
            })}
          >
            Send change request
          </Button>
        </div>
      ) : null}

      {needsReview ? (
        <div
          className="rounded-sm border border-dashed border-border bg-background/80 p-3 space-y-2"
          data-testid="choices-submission-summary"
        >
          <p className="text-xs font-medium text-heading">Couple-submitted choices</p>
          <ChoicesDefinitionView definition={row.definition} answers={row.answers} mode="review" />
        </div>
      ) : null}

      {submissions.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Submission history ({submissions.length})</summary>
          <ul className="mt-2 space-y-1 pl-2">
            {submissions.map((s) => (
              <li key={s.id}>
                #{s.submissionNumber} · {s.outcomeStatus} · {s.submittedBy} ·{" "}
                {new Date(s.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {row.status === "finalized" ? (
        <p className="text-xs text-muted-foreground">
          Locked — applied to the Event Order.
          {row.eventOrderId ? "" : ""}
        </p>
      ) : null}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-testid="choices-review-dialog">
          <DialogHeader>
            <DialogTitle>Review selections</DialogTitle>
            <DialogDescription>
              Selected options are marked. Use {applyLabel} to apply them to the Event Order.
              This does not finalize the Event Order or create an invoice.
            </DialogDescription>
          </DialogHeader>
          <ChoicesDefinitionView definition={row.definition} answers={row.answers} mode="review" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinancialImpact({
  eventId,
  impact,
}: {
  eventId: string;
  impact: SelectionsFinancialImpact;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const copy = financialImpactCopy(impact.unbilledAmount, impact.eoInvoice);
  if (!copy || !impact.eventOrderId) return null;
  const canAdd = impact.eoInvoice != null;

  function go(invoiceId: string) {
    router.push(`/invoices/${invoiceId}`);
    router.refresh();
  }

  return (
    <div className="rounded-sm border border-border bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-medium text-heading">Financial impact</p>
      <p className="text-sm text-muted-foreground">{copy}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !impact.clientId}
          onClick={() => startTransition(async () => {
            const result = await createInvoiceFromEventOrderAction(
              impact.eventOrderId!,
              eventId,
              impact.clientId!,
            );
            if (!result.ok) {
              toast.error(result.message ?? "Could not create the invoice.");
              return;
            }
            go(result.invoiceId);
          })}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create invoice & payment plan"}
        </Button>
        {canAdd ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await addSelectionsToExistingInvoiceAction(impact.eventOrderId!, eventId);
              if (!result.ok) {
                toast.error(result.message ?? "Could not open the Event Order invoice.");
                return;
              }
              go(result.invoiceId);
            })}
          >
            Add to Existing Invoice
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            toast.message("Nothing billed. The amount stays unbilled until you choose an invoice.");
          }}
        >
          Not now
        </Button>
      </div>
    </div>
  );
}

export function ClientChoicesPanel({
  eventId,
  eventOrderTemplates,
  choices,
  financialImpact = null,
  hasEventOrder = false,
  showFinancialImpact = true,
  clientName = null,
  clientEmail = null,
  venueName = null,
  eventName = null,
  eventDate = null,
}: {
  eventId: string;
  /** Selectable Event Order Templates (preferred authoring source). */
  eventOrderTemplates: Pick<EventOrderTemplate, "id" | "name">[];
  choices: ClientChoicesWithHistory[];
  financialImpact?: SelectionsFinancialImpact | null;
  /** True when this event already has an Event Order (Create vs Update CTA). */
  hasEventOrder?: boolean;
  /** False when the Event Order panel already owns the invoice handoff. */
  showFinancialImpact?: boolean;
  clientName?: string | null;
  clientEmail?: string | null;
  venueName?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState(eventOrderTemplates[0]?.id ?? "");
  const [pending, startTransition] = React.useTransition();
  const [templateDetail, setTemplateDetail] = React.useState<EventOrderTemplateWithDetails | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [sendPreviewOpen, setSendPreviewOpen] = React.useState(false);
  const shareContext: ShareRecipientProps = {
    clientName,
    clientEmail,
    venueName,
    eventName,
    eventDate,
  };

  const active = pickActiveChoices(choices);
  const otherChoices = choices.filter((c) => c.id !== active?.id);

  React.useEffect(() => {
    if (!templateId) {
      setTemplateDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void getEventOrderTemplateDetailAction(templateId).then((detail) => {
      if (cancelled) return;
      setTemplateDetail(detail);
      setDetailLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Prefer the template behind the active packet when present.
  React.useEffect(() => {
    if (active?.eventOrderTemplateId && active.eventOrderTemplateId !== templateId) {
      setTemplateId(active.eventOrderTemplateId);
    }
  }, [active?.eventOrderTemplateId]);

  return (
    <Card className="mb-4" data-testid="client-choices-panel">
      <CardHeader>
        <CardTitle className="text-base">Client selections</CardTitle>
        <CardDescription>
          Choose an Event Order template, review the complete offering, then send a selection
          request. Same composer pattern as Package/Proposal — sending does not finalize the Event
          Order or create an invoice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {eventOrderTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Event Order Templates yet.{" "}
            <Link href="/library/event-order-templates" className="text-primary hover:underline">
              Create one in Library
            </Link>
            {" "}with choice groups to start client selections here.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {/* Left: template select + request actions */}
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1 space-y-1">
                  <label
                    htmlFor="choices-template-select"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Event Order template
                  </label>
                  <select
                    id="choices-template-select"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    data-testid="choices-template-select"
                  >
                    {eventOrderTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                {!active || active.status === "finalized" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || !templateId}
                    data-testid="choices-start-selections"
                    onClick={() => startTransition(async () => {
                      const r = await createClientChoicesFromEventOrderTemplateAction(eventId, templateId);
                      if (!r.ok) toast.error(r.message ?? "Could not create.");
                      else { toast.success("Selection request prepared."); router.refresh(); }
                    })}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Prepare selection request"}
                  </Button>
                ) : null}
                <Link
                  href="/library/event-order-templates"
                  className="text-xs text-muted-foreground hover:underline self-center"
                >
                  Manage templates
                </Link>
              </div>

              {active ? (
                <ChoicesComposerActions
                  eventId={eventId}
                  row={active}
                  hasEventOrder={hasEventOrder}
                  shareContext={shareContext}
                  onPreviewSend={() => setSendPreviewOpen(true)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a template to preview the full offering on the right. Prepare a selection
                  request when you are ready to send it to the couple.
                </p>
              )}

              {otherChoices.length > 0 ? (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    Other selection packets ({otherChoices.length})
                  </summary>
                  <ul className="mt-2 space-y-1 pl-2">
                    {otherChoices.map((c) => (
                      <li key={c.id}>
                        {c.name} · {clientChoicesDisplayLabel(c.status)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {showFinancialImpact
                && financialImpact
                && choices.some((c) => c.status === "finalized") ? (
                <FinancialImpact eventId={eventId} impact={financialImpact} />
              ) : null}
            </div>

            {/* Right: full template / packet preview (proposal composer pattern) */}
            <aside
              className="min-w-0 rounded-lg border border-border bg-muted/20 p-4 lg:sticky lg:top-4 lg:max-h-[min(70vh,40rem)] lg:overflow-y-auto"
              data-testid="choices-template-preview"
            >
              <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {active ? "Selection request preview" : "Template preview"}
              </p>
              {detailLoading && !active ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading template…
                </div>
              ) : active ? (
                <ChoicesDefinitionView
                  definition={active.definition}
                  answers={active.answers}
                  mode={isClientChoicesNeedsVenueReview(active.status) ? "review" : "preview"}
                />
              ) : templateDetail ? (
                <EventOrderTemplatePreviewView template={templateDetail} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose a template to see categories, included offerings, prices, and choice groups.
                </p>
              )}
            </aside>
          </div>
        )}

        {/* Full send preview — ArtifactReviewOverlay (same pattern as proposal send) */}
        {active ? (
          <ArtifactReviewOverlay
            open={sendPreviewOpen}
            eyebrow="This is a preview — nothing has been sent"
            title="Selection request preview"
            onBack={() => setSendPreviewOpen(false)}
            primary={
              active.status === "draft" || active.status === "sent" || active.status === "in_progress" ? (
                <Button
                  type="button"
                  data-testid="choices-preview-continue-send"
                  onClick={() => {
                    setSendPreviewOpen(false);
                    // Re-open send via DOM click on the primary send control after overlay closes.
                    window.setTimeout(() => {
                      document
                        .querySelector<HTMLButtonElement>("[data-testid='choices-send-selection-request']")
                        ?.click();
                    }, 50);
                  }}
                >
                  {active.status === "draft" ? "Send selection request" : "Resend selection request"}
                </Button>
              ) : undefined
            }
          >
            <p className="border-b border-border bg-background px-4 py-2 text-sm text-muted-foreground sm:px-6">
              This is the complete client-facing selection request — included offerings and selectable
              groups — not only the choice form.
            </p>
            <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
              <ChoicesDefinitionView
                definition={active.definition}
                answers={active.answers}
                mode="preview"
              />
            </div>
          </ArtifactReviewOverlay>
        ) : null}
      </CardContent>
    </Card>
  );
}
