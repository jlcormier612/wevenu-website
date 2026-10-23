"use client";

/**
 * P2-B — Compose existing commercial panels into one continuous venue spine.
 * Domain actions stay on ClientChoicesPanel / EventOrderPanel.
 */
import { ClientChoicesPanel } from "@/components/client-choices/client-choices-panel";
import { EventCommercialStatusStrip } from "@/components/event-orders/event-commercial-status-strip";
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
  clientChoicesNextActor,
  isClientChoicesNeedsVenueReview,
} from "@/lib/client-choices/constants";
import {
  resolveCommercialWorkflowStep,
  type CommercialWorkflowStepId,
} from "@/lib/event-orders/commercial-workflow-step";

export { resolveCommercialWorkflowStep, type CommercialWorkflowStepId };

const STEPS: { id: CommercialWorkflowStepId; label: string; hint: string }[] = [
  {
    id: "build",
    label: "Build proposed order",
    hint: "Start selectable packets and add fixed/included lines on the Event Order.",
  },
  {
    id: "awaiting",
    label: "Awaiting couple",
    hint: "Selections are with the couple in their portal (email delivery is a later step).",
  },
  {
    id: "review",
    label: "Review response",
    hint: "Inspect submitted choices, then create or update the Event Order.",
  },
  {
    id: "order",
    label: "Final Event Order",
    hint: "Review lines, finalize if needed, then share the final order.",
  },
  {
    id: "invoice",
    label: "Invoice & payments",
    hint: "Create or open the invoice and payment plan from the Event Order.",
  },
];

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
  const hasEoInvoice = Boolean(
    stripInput.eventOrderId
      && stripInput.invoices.some(
        (inv) => inv.eventOrderId === stripInput.eventOrderId && inv.status !== "void",
      ),
  );
  const current = resolveCommercialWorkflowStep({ choices, eventOrder, hasEoInvoice });
  const reviewCount = choices.filter((c) => isClientChoicesNeedsVenueReview(c.status)).length;
  const awaitingActor = choices.find((c) => clientChoicesNextActor(c.status) === "client");

  return (
    <div className="space-y-4" data-testid="event-commercial-workflow">
      <div
        className="rounded-lg border border-border bg-background px-3 py-3 space-y-2"
        data-testid="event-commercial-workflow-spine"
      >
        <p className="text-sm font-medium text-heading">Event Order workflow</p>
        <p className="text-xs text-muted-foreground">
          One commercial path for this booked event: build the proposed order, wait for the couple&apos;s
          selections, create the Event Order from those selections, review and share the final order, then
          invoice. Inventory remains operational; billable amounts live on the Event Order and invoice.
        </p>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Event Order steps">
          {STEPS.map((step, index) => {
            const active = step.id === current;
            return (
              <li
                key={step.id}
                data-testid={`eo-workflow-step-${step.id}`}
                data-state={active ? "current" : "idle"}
                className={
                  active
                    ? "rounded-md border border-primary/40 bg-muted/20 px-2.5 py-2 text-xs ring-1 ring-primary/15"
                    : "rounded-md border border-border/70 px-2.5 py-2 text-xs text-muted-foreground"
                }
              >
                <p className={active ? "font-medium text-heading" : "font-medium"}>
                  {index + 1}. {step.label}
                </p>
                <p className="mt-1 leading-snug">{step.hint}</p>
              </li>
            );
          })}
        </ol>
        {reviewCount > 0 ? (
          <p className="text-xs font-medium text-heading" data-testid="eo-workflow-review-banner">
            {reviewCount === 1
              ? "1 client submission is ready for review below."
              : `${reviewCount} client submissions are ready for review below.`}
          </p>
        ) : null}
        {awaitingActor && reviewCount === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="eo-workflow-awaiting-banner">
            Waiting on the couple in their portal. Active email send arrives in a later release step.
          </p>
        ) : null}
      </div>

      <EventCommercialStatusStrip input={stripInput} onNavigate={onNavigate} />

      <div id="event-order-choices" data-testid="event-order-choices">
        <ClientChoicesPanel
          eventId={eventId}
          eventOrderTemplates={eventOrderTemplates}
          choices={choices}
          financialImpact={financialImpact}
          hasEventOrder={Boolean(eventOrder)}
        />
      </div>

      <div id="event-order-order" data-testid="event-order-order">
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
        />
      </div>
    </div>
  );
}
