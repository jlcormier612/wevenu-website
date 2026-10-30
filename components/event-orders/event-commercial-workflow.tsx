"use client";

/**
 * Event Order tab — lead card rows (Event Order → Couple approval → New
 * charges invoice → Payment plan) + the document editor below.
 * Preview shows exactly what the couple sees; Send emails one /order/ link.
 * No competing spine/strip progress chrome. Inventory not in this presentation.
 */
import * as React from "react";
import type { ReactNode } from "react";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addSelectionsToExistingInvoiceAction,
  createInvoiceFromEventOrderAction,
  evaluateEventOrderShareStaleAction,
  getEventOrderDocumentPreviewAction,
  sendEventOrderToCoupleAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { ClientChoicesPanel } from "@/components/client-choices/client-choices-panel";
import { EventOrderDocumentView } from "@/components/event-orders/event-order-document-view";
import { EventOrderJourney } from "@/components/event-orders/event-order-journey";
import { EventOrderPanel } from "@/components/event-orders/event-order-panel";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Button } from "@/components/ui/button";
import { isClientChoicesNeedsVenueReview } from "@/lib/client-choices/constants";
import type { CoupleDocumentView } from "@/lib/event-orders/couple-document";
import { eventOrderDocumentUrl } from "@/lib/event-orders/event-order-portal-link";
import type { EventOrderJourneyAction } from "@/lib/event-orders/event-order-journey";
import { publicAppOrigin } from "@/lib/env";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import type { CommercialNavTarget, CommercialStatusInput } from "@/lib/event-orders/commercial-status";
import type { SelectionsFinancialImpact } from "@/lib/client-choices/selections-billing";
import type { ClientChoicesWithHistory } from "@/lib/client-choices/types";
import type { EventOrderTemplate } from "@/lib/event-order-templates/types";
import type { EventOrderWithDetails } from "@/lib/event-orders/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Offering } from "@/lib/offerings/types";
import type { Package, PackageWithItems } from "@/lib/packages/types";
import {
  resolveCommercialWorkflowStep,
  type CommercialWorkflowStepId,
} from "@/lib/event-orders/commercial-workflow-step";

export { resolveCommercialWorkflowStep, type CommercialWorkflowStepId };

function StageSection({
  id,
  testId,
  title,
  emphasized,
  collapsedByDefault = false,
  children,
}: {
  id: string;
  testId: string;
  title: string;
  emphasized: boolean;
  /** Secondary detail stays one click away unless it needs the venue. */
  collapsedByDefault?: boolean;
  children: ReactNode;
}) {
  if (!emphasized) {
    return (
      <section id={id} data-testid={testId} data-stage-emphasis="secondary" className="rounded-lg border border-border bg-card px-3 py-3">
        <details open={!collapsedByDefault}>
          <summary className="cursor-pointer text-sm font-medium text-heading">{title}</summary>
          <div className="mt-3">{children}</div>
        </details>
      </section>
    );
  }
  return (
    <section id={id} data-testid={testId} data-stage-emphasis="primary">
      {children}
    </section>
  );
}

export function EventCommercialWorkflow({
  stripInput,
  onNavigate,
  eventId,
  eventOrderTemplates,
  choices,
  financialImpact = null,
  eventOrder,
  clientId,
  clientName,
  clientEmail,
  venueName,
  packages,
  packagesWithItems,
  selectedPackageName,
  offerings,
  inventoryItems,
  invoices,
  bookingCommitmentInvoiceIds,
  linkedScheduleId,
  floorPlans,
  templates,
  preferredTemplateId,
  overview,
}: {
  stripInput: CommercialStatusInput;
  onNavigate: (target: CommercialNavTarget) => void;
  eventId: string;
  eventOrderTemplates: Pick<EventOrderTemplate, "id" | "name">[];
  choices: ClientChoicesWithHistory[];
  financialImpact?: SelectionsFinancialImpact | null;
  eventOrder: EventOrderWithDetails | null;
  clientId: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  venueName?: string;
  packages: Package[];
  packagesWithItems: PackageWithItems[];
  selectedPackageName?: string | null;
  offerings: Offering[];
  inventoryItems: InventoryItem[];
  invoices: Invoice[];
  bookingCommitmentInvoiceIds?: string[];
  linkedScheduleId?: string | null;
  floorPlans: FloorPlan[];
  templates: EventOrderTemplate[];
  preferredTemplateId?: string | null;
  overview: {
    eventName?: string | null;
    eventDate: string | null;
    eventType?: string | null;
    guestCount: number | null;
    guaranteedGuestCount?: number | null;
    spaceName: string | null;
    ceremonyStartTime: string | null;
    receptionStartTime: string | null;
  };
}) {
  const eoLinkedInvoice =
    stripInput.eventOrderId
      ? stripInput.invoices.find(
          (inv) =>
            inv.eventOrderId === stripInput.eventOrderId
            && inv.status !== "void"
            && !(stripInput.bookingCommitmentInvoiceIds ?? []).includes(inv.id),
        )
      : undefined;
  const hasEoInvoice = Boolean(eoLinkedInvoice);
  const unbilledAmount = financialImpact?.unbilledAmount ?? 0;
  const [shareCommitmentStale, setShareCommitmentStale] = React.useState(false);

  React.useEffect(() => {
    if (!eventOrder?.id || !eventOrder.sharedAt) {
      setShareCommitmentStale(false);
      return;
    }
    let cancelled = false;
    void evaluateEventOrderShareStaleAction(eventOrder.id).then((r) => {
      if (!cancelled) setShareCommitmentStale(Boolean(r.liveDiffersFromLastShare));
    });
    return () => {
      cancelled = true;
    };
  }, [eventOrder?.id, eventOrder?.sharedAt, eventOrder?.revision, eventOrder?.updatedAt, eventOrder?.lines?.length]);

  const router = useRouter();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<CoupleDocumentView | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<EventOrderJourneyAction | null>(null);
  const choicesNeedReview = choices.some((c) => isClientChoicesNeedsVenueReview(c.status));
  const coupleLink = eventOrder?.reviewToken
    ? eventOrderDocumentUrl(publicAppOrigin(), eventOrder.reviewToken)
    : null;
  const shareMergeData = buildMergeData({
    venueName: venueName ?? "Your venue", clientName: clientName ?? "", coordinatorName: venueName ?? "",
    eventDate: overview.eventDate ?? null,
  });
  const sendDefaultMessage = mergeContent(
    "We've shared your Event Order for {{event_date}}. Please make your choices and approve it when you have a chance.",
    shareMergeData,
  );
  const canSend = Boolean(eventOrder && eventOrder.lines.length > 0 && clientId);

  function openPreview() {
    setPreviewOpen(true);
    setPreviewLoading(true);
    void getEventOrderDocumentPreviewAction(eventId).then((doc) => {
      setPreview(doc);
      setPreviewLoading(false);
    });
  }

  function copyCoupleLink() {
    if (!coupleLink) {
      toast.error("Send the Event Order first to get the couple link.");
      return;
    }
    void navigator.clipboard.writeText(coupleLink).then(
      () => toast.success("Couple link copied."),
      () => toast.error("Could not copy the link."),
    );
  }

  async function invoiceNewCharges() {
    if (!eventOrder || !clientId) return;
    setPendingAction("invoice_new_charges");
    const result = hasEoInvoice
      ? await addSelectionsToExistingInvoiceAction(eventOrder.id, eventId)
      : await createInvoiceFromEventOrderAction(eventOrder.id, eventId, clientId);
    setPendingAction(null);
    if (!result.ok) {
      toast.error(result.message ?? "Could not open the invoice.");
      return;
    }
    toast.success("Draft shows new charges only. Nothing is sent until you send it.");
    router.push(`/invoices/${result.invoiceId}`);
  }

  function handleAction(action: EventOrderJourneyAction) {
    switch (action) {
      case "build":
        onNavigate({ kind: "tab", tab: "event-order", anchor: "event-order-order" });
        return;
      case "review_choices":
        onNavigate({ kind: "tab", tab: "event-order", anchor: "event-order-choices" });
        return;
      case "send":
      case "resend":
        if (!canSend) {
          toast.error(clientId ? "Add at least one line before sending." : "Add a client to this event before sending.");
          return;
        }
        setSendOpen(true);
        return;
      case "copy_link":
        copyCoupleLink();
        return;
      case "invoice_new_charges":
        void invoiceNewCharges();
        return;
      case "open_invoice":
        if (eoLinkedInvoice) router.push(`/invoices/${eoLinkedInvoice.id}`);
        return;
      case "create_payment_plan":
        if (eoLinkedInvoice) router.push(`/payments/new?invoiceId=${eoLinkedInvoice.id}`);
        return;
      case "open_payment_plan":
        if (linkedScheduleId) router.push(`/payments/${linkedScheduleId}`);
        return;
    }
  }

  return (
    <div className="space-y-4" data-testid="event-commercial-workflow">
      <EventOrderJourney
        input={{
          choices,
          eventOrder: eventOrder
            ? {
                status: eventOrder.status,
                sharedAt: eventOrder.sharedAt,
                clientAgreedAt: eventOrder.clientAgreedAt ?? null,
                clientAgreedRevision: eventOrder.clientAgreedRevision ?? null,
                revision: eventOrder.revision,
              }
            : null,
          hasEoInvoice,
          eoInvoiceStatus: eoLinkedInvoice?.status ?? null,
          shareCommitmentStale,
          unbilledAmount,
          hasPaymentPlan: Boolean(linkedScheduleId),
        }}
        pendingAction={pendingAction}
        onAction={handleAction}
        onPreview={openPreview}
      />

      <ArtifactReviewOverlay
        open={previewOpen}
        eyebrow="What the couple sees"
        title={overview.eventName ? `Event Order — ${overview.eventName}` : "Event Order"}
        onBack={() => setPreviewOpen(false)}
        primary={
          canSend ? (
            <Button
              type="button"
              size="sm"
              data-testid="event-order-preview-send"
              onClick={() => {
                setPreviewOpen(false);
                setSendOpen(true);
              }}
            >
              {eventOrder?.sharedAt ? "Send updated copy" : "Send to couple"}
            </Button>
          ) : undefined
        }
      >
        {previewLoading || !preview ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading preview…
          </div>
        ) : (
          <EventOrderDocumentView doc={preview} mode="preview" />
        )}
      </ArtifactReviewOverlay>

      {eventOrder ? (
        <ShareDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          title={eventOrder.sharedAt ? "Send updated Event Order" : "Send Event Order"}
          recipient={clientName ? { name: clientName, contact: clientEmail ?? null, relationshipLabel: "Client" } : null}
          whatHappensNext="They get one link to their Event Order — no portal invite needed. They make their choices in each section and approve. This locks the current version; nothing is invoiced."
          defaultMessage={sendDefaultMessage}
          sendLabel="Send"
          onSend={async (message) => {
            const result = await sendEventOrderToCoupleAction(eventOrder.id, eventId, message);
            if (result.ok) toast.success("Event Order sent to the couple.");
            return result;
          }}
          onSent={() => {
            setSendOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      <StageSection
        id="event-order-order"
        testId="event-order-order"
        title="Event Order document"
        emphasized
      >
        <EventOrderPanel
          eventId={eventId}
          clientId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
          venueName={venueName}
          eventOrder={eventOrder}
          packages={packages}
          packagesWithItems={packagesWithItems}
          selectedPackageName={selectedPackageName}
          offerings={offerings}
          inventoryItems={inventoryItems}
          invoices={invoices}
          bookingCommitmentInvoiceIds={bookingCommitmentInvoiceIds}
          linkedScheduleId={linkedScheduleId}
          floorPlans={floorPlans}
          templates={templates}
          preferredTemplateId={preferredTemplateId}
          overview={overview}
          shareCommitmentStale={shareCommitmentStale}
          choices={choices}
          actionsOwnedByJourney
        />
      </StageSection>

      {/* Review/history only — Send to couple owns the selection request; no leftover Prepare/Send panel. */}
      {choices.length > 0 ? (
      <StageSection
        id="event-order-choices"
        testId="event-order-choices"
        title="Couple's choices — details and history"
        emphasized={false}
        collapsedByDefault={!choicesNeedReview}
      >
        <ClientChoicesPanel
          eventId={eventId}
          eventOrderTemplates={eventOrderTemplates}
          choices={choices}
          financialImpact={null}
          hasEventOrder={Boolean(eventOrder)}
          showFinancialImpact={false}
          selectionRequestComposer={false}
          clientName={clientName}
          clientEmail={clientEmail}
          venueName={venueName}
          eventName={overview.eventName}
          eventDate={overview.eventDate}
        />
      </StageSection>
      ) : null}
    </div>
  );
}
