"use client";

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
} from "@/app/(app)/events/[id]/client-choices-actions";
import {
  addSelectionsToExistingInvoiceAction,
  createInvoiceFromEventOrderAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { ChoicesDefinitionView } from "@/components/client-choices/choices-definition-view";
import {
  eventOrderApplyConfirmMessage,
  eventOrderApplyLabel,
} from "@/lib/client-choices/event-order-apply-cta";
import { financialImpactCopy } from "@/lib/client-choices/selections-billing";
import type { SelectionsFinancialImpact } from "@/lib/client-choices/selections-billing";
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
import type { EventOrderTemplate } from "@/lib/event-order-templates/types";

export { eventOrderApplyConfirmMessage, eventOrderApplyLabel };

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

function ChoicesRow({
  eventId,
  row,
  hasEventOrder,
}: {
  eventId: string;
  row: ClientChoicesWithHistory | ClientChoices;
  hasEventOrder: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [showNote, setShowNote] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const actor = clientChoicesNextActor(row.status);
  const submissions = "submissions" in row ? row.submissions : [];
  const needsReview = isClientChoicesNeedsVenueReview(row.status);
  const appliedLineIds = row.appliedLineIds ?? [];
  const applyLabel = eventOrderApplyLabel({
    hasEventOrder,
    eventOrderId: row.eventOrderId,
    appliedLineIds,
  });

  return (
    <div
      className={
        needsReview
          ? "rounded-sm border border-primary/40 bg-muted/15 p-4 space-y-3 ring-1 ring-primary/10"
          : "rounded-sm border border-border p-4 space-y-3"
      }
      data-testid={`client-choices-row-${row.id}`}
      data-status={row.status}
      data-needs-review={needsReview ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-heading">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {clientChoicesDisplayLabel(row.status)}
            {actor === "venue" ? " · Venue to act" : actor === "client" ? " · Client to act" : ""}
            {needsReview ? " · Couple submission (not yet on Event Order)" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{summarizeAnswers(row)}</p>
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
            onClick={() => setPreviewOpen(true)}
          >
            Preview couple view
          </Button>
          {needsReview ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="choices-review-submission"
              onClick={() => setReviewOpen(true)}
            >
              Review submission
            </Button>
          ) : null}
          {row.status === "draft" ? (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              data-testid="choices-send-to-client"
              onClick={() => startTransition(async () => {
                const r = await sendClientChoicesAction(eventId, row.id);
                if (!r.ok) toast.error(r.message ?? "Could not send.");
                else {
                  toast.success(
                    "Opened for the couple in their portal. Active proposed-order email delivery is a later step.",
                  );
                  router.refresh();
                }
              })}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to Client"}
            </Button>
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
                else { toast.success("Amendment started. Send to the client when ready."); router.refresh(); }
              })}
            >
              Amend
            </Button>
          ) : null}
          {(row.status === "sent" || row.status === "in_progress") ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const r = await sendClientChoicesAction(eventId, row.id);
                if (!r.ok) toast.error(r.message ?? "Could not re-send.");
                else {
                  toast.success(
                    "Reminder recorded in the portal. Active email delivery is a later step.",
                  );
                  router.refresh();
                }
              })}
            >
              Re-send
            </Button>
          ) : null}
        </div>
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
          <p className="text-xs text-muted-foreground">
            Highlighted options below are what the couple selected. Fixed/included Event Order lines
            (authored on the order itself) are separate and appear in the Event Order section.
          </p>
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
          Locked — this is what will be provided.
          {row.eventOrderId ? " Applied to the Event Order." : ""}
        </p>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-testid="choices-preview-dialog">
          <DialogHeader>
            <DialogTitle>Couple view preview</DialogTitle>
            <DialogDescription>
              Same choice packet the couple sees in their portal. Selections shown are the current
              answers on this packet (empty until they respond). This is a preview — it does not send.
            </DialogDescription>
          </DialogHeader>
          <ChoicesDefinitionView definition={row.definition} answers={row.answers} mode="preview" />
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-testid="choices-review-dialog">
          <DialogHeader>
            <DialogTitle>Review couple submission</DialogTitle>
            <DialogDescription>
              Selected options are marked. Use {applyLabel} on the row to apply them to the Event Order
              without creating a second commercial system.
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
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create New Invoice"}
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
}: {
  eventId: string;
  /** Selectable Event Order Templates (preferred authoring source). */
  eventOrderTemplates: Pick<EventOrderTemplate, "id" | "name">[];
  choices: ClientChoicesWithHistory[];
  financialImpact?: SelectionsFinancialImpact | null;
  /** True when this event already has an Event Order (Create vs Update CTA). */
  hasEventOrder?: boolean;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState(eventOrderTemplates[0]?.id ?? "");
  const [pending, startTransition] = React.useTransition();

  return (
    <Card className="mb-4" data-testid="client-choices-panel">
      <CardHeader>
        <CardTitle className="text-base">Build proposed order — client selections</CardTitle>
        <CardDescription>
          Combine selectable packets (menus, add-ons, rentals) with the fixed and included lines on the
          Event Order below. This is one commercial path — not a second invoice or inventory workflow.
          After the couple submits, use Create Event Order (or Update Event Order from selections) to
          apply their picks. Included/free options stay informational. Sending opens the portal task;
          proposed-order email delivery is a later step.
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
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="min-w-[220px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              data-testid="choices-template-select"
            >
              {eventOrderTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabled={pending || !templateId}
              data-testid="choices-start-selections"
              onClick={() => startTransition(async () => {
                const r = await createClientChoicesFromEventOrderTemplateAction(eventId, templateId);
                if (!r.ok) toast.error(r.message ?? "Could not create.");
                else { toast.success("Client selections created."); router.refresh(); }
              })}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start selections"}
            </Button>
            <Link href="/library/event-order-templates" className="text-xs text-muted-foreground hover:underline self-center">
              Manage Event Order Templates
            </Link>
          </div>
        )}

        {choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No client selections for this event yet. Add fixed/included lines on the Event Order below,
            or start selections when the couple should choose from a template. Operational Inventory
            remains on its own surface and is not a billable Event Order line source.
          </p>
        ) : (
          <div className="space-y-3">
            {choices.map((c) => (
              <ChoicesRow
                key={c.id}
                eventId={eventId}
                row={c}
                hasEventOrder={hasEventOrder}
              />
            ))}
            {financialImpact && choices.some((c) => c.status === "finalized") ? (
              <FinancialImpact eventId={eventId} impact={financialImpact} />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
