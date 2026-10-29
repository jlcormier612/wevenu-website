"use client";

/**
 * Stage 0 — One Event Order journey (Booking Details pattern) + staged panels.
 * Domain actions stay on ClientChoicesPanel / EventOrderPanel.
 * No competing spine/strip progress chrome. Inventory not in this presentation.
 */
import * as React from "react";
import type { ReactNode } from "react";

import { evaluateEventOrderShareStaleAction } from "@/app/(app)/events/[id]/event-order-actions";
import { ClientChoicesPanel } from "@/components/client-choices/client-choices-panel";
import { EventOrderJourney } from "@/components/event-orders/event-order-journey";
import { EventOrderPanel } from "@/components/event-orders/event-order-panel";
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
  panelEmphasisForStep,
  shouldShowChoicesFinancialImpact,
} from "@/lib/event-orders/event-order-journey";
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
  children,
}: {
  id: string;
  testId: string;
  title: string;
  emphasized: boolean;
  children: ReactNode;
}) {
  // Both stages stay open, matching the proposal → contract document flow.
  // Collapsing the Event Order hid Start selections and the document itself.
  return (
    <section
      id={id}
      data-testid={testId}
      data-stage-emphasis={emphasized ? "primary" : "secondary"}
      className={emphasized ? undefined : "rounded-lg border border-border bg-card px-3 py-3"}
    >
      {emphasized ? null : (
        <h3 className="mb-3 text-sm font-medium text-heading">{title}</h3>
      )}
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

  const current = resolveCommercialWorkflowStep({
    choices,
    eventOrder: eventOrder
      ? { sharedAt: eventOrder.sharedAt, status: eventOrder.status }
      : null,
    hasEoInvoice,
    shareCommitmentStale,
    unbilledAmount,
  });
  const { emphasizeChoices, emphasizeOrder } = panelEmphasisForStep(current);
  const showFinancialImpact = shouldShowChoicesFinancialImpact(
    hasEoInvoice,
    unbilledAmount,
  );

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
              }
            : null,
          hasEoInvoice,
          eoInvoiceStatus: eoLinkedInvoice?.status ?? null,
          shareCommitmentStale,
          unbilledAmount,
        }}
        onNavigate={onNavigate}
      />

      {/* Anchors preserved; emphasis follows current journey stage. No Inventory chrome. */}
      <StageSection
        id="event-order-choices"
        testId="event-order-choices"
        title="Client selections"
        emphasized={emphasizeChoices}
      >
        <ClientChoicesPanel
          eventId={eventId}
          eventOrderTemplates={eventOrderTemplates}
          choices={choices}
          financialImpact={showFinancialImpact ? financialImpact : null}
          hasEventOrder={Boolean(eventOrder)}
          showFinancialImpact={showFinancialImpact}
          clientName={clientName}
          clientEmail={clientEmail}
          venueName={venueName}
          eventName={overview.eventName}
          eventDate={overview.eventDate}
        />
      </StageSection>

      <StageSection
        id="event-order-order"
        testId="event-order-order"
        title="Event Order document"
        emphasized={emphasizeOrder}
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
        />
      </StageSection>
    </div>
  );
}
