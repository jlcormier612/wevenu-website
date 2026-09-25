"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";

import {
  sendInvoiceEmailAction,
  updateInvoiceDisplayNameAction,
  updateInvoiceStatusAction,
} from "@/app/(app)/invoices/actions";
import { invoiceHumanLabel } from "@/lib/invoices/display-name";
import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { EventOrderDriftBanner } from "@/components/invoices/event-order-drift-banner";
import { InvoiceLineItemsEditor } from "@/components/invoices/invoice-line-items-editor";
import { PaymentPlanEditor, PaymentPlanNeedsReview } from "@/components/payments/payment-plan-editor";
import { InvoicePrintDocument } from "@/components/invoices/invoice-print-document";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { BusinessAssetActionRow, BusinessAssetHeader } from "@/components/business-assets/asset-header";
import type { WaitingOn } from "@/components/business-assets/waiting-state";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { QuickBooksSyncStatusBadge } from "@/components/quickbooks/sync-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, invoiceStatusLabel } from "@/lib/invoices/constants";
import {
  planTotalsReconcile,
  scheduleHasPaymentActivity,
  scheduledPlanTotal,
} from "@/lib/payments/reconcile-commitment";
import type { AmountDueNowResult } from "@/lib/invoices/amount-due-now";
import type { EventOrderDrift, InvoiceStatus, InvoiceWithLineItems } from "@/lib/invoices/types";
import type { Package } from "@/lib/packages/types";
import type { Venue } from "@/lib/venue/types";
import { NOTES_FROM_YOUR_VENUE_LABEL } from "@/lib/notes/internal-notes-copy";
import { safePaymentScheduleReturnPath } from "@/lib/payments/starters";

const STATUS_TRANSITIONS: Record<InvoiceStatus, { next: InvoiceStatus; label: string } | null> = {
  draft: { next: "sent",  label: "Mark as issued" },
  sent:  { next: "paid",  label: "Mark as Paid" },
  paid:  null,
  void:  null,
};

// Same "whose turn" question Contracts/Questionnaires/Messaging already
// answer, generalized here (BA4, Step 1C).
const INVOICE_WAITING_ON: Record<InvoiceStatus, WaitingOn> = {
  draft: "venue", sent: "client", paid: "completed", void: "none",
};

export function InvoiceDetail({
  invoice,
  packages,
  eventOrderDrift = null,
  emailConfigured = true,
  returnToPaymentSchedule = null,
  amountDueNow = null,
  paidToDate = null,
  cancelledPlanAmount = 0,
  venue,
  linkedScheduleId = null,
  scheduleLines = null,
  scheduleNotes = null,
  scheduleTiming = null,
}: {
  invoice: InvoiceWithLineItems;
  packages: Package[];
  eventOrderDrift?: EventOrderDrift | null;
  emailConfigured?: boolean;
  /** When set (from payment-schedule handoff), show continue CTA after amount exists. */
  returnToPaymentSchedule?: string | null;
  /** Next open installment — never the full outstanding under "Amount Due Now". */
  amountDueNow?: AmountDueNowResult | null;
  /**
   * Net retained collections from the linked payment plan (refund-aware).
   * When null, fall back to total − balanceDue (no schedule / legacy).
   */
  paidToDate?: number | null;
  /** Sum of cancelled schedule commitments still shown on the plan history. */
  cancelledPlanAmount?: number;
  venue: Venue;
  linkedScheduleId?: string | null;
  scheduleLines?: {
    label: string;
    amount: number;
    dueDate: string | null;
    status: string;
    obligationKind?: import("@/lib/payments/types").PaymentObligationKind | null;
    paidAmount?: number | null;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  }[] | null;
  scheduleNotes?: string | null;
  scheduleTiming?: {
    eventDate: string | null;
    bookingDate: string | null;
    executedAt: string | null;
    today: string;
  } | null;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<InvoiceStatus>(invoice.status);
  const [pending, startTransition] = React.useTransition();
  const [emailPending, startEmail] = React.useTransition();
  const [namePending, startName] = React.useTransition();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState(false);
  const [editingName, setEditingName] = React.useState(false);
  const humanTitle = invoiceHumanLabel({
    displayName: invoice.displayName,
    invoiceNumber: invoice.invoiceNumber,
  });
  const [nameDraft, setNameDraft] = React.useState(invoice.displayName?.trim() || humanTitle);
  const transition = STATUS_TRANSITIONS[status];
  const continueToSchedule = safePaymentScheduleReturnPath(returnToPaymentSchedule);
  const displayPaidToDate = paidToDate != null
    ? paidToDate
    : Math.max(0, invoice.total - invoice.balanceDue);
  const scheduledTotal = scheduleLines ? scheduledPlanTotal(scheduleLines) : 0;
  const planMismatch = Boolean(
    scheduleLines && scheduleLines.length > 0 && !planTotalsReconcile(scheduledTotal, invoice.total),
  );
  const planHasActivity = Boolean(
    scheduleLines && scheduleHasPaymentActivity(scheduleLines),
  );

  function saveDisplayName() {
    startName(async () => {
      const result = await updateInvoiceDisplayNameAction(invoice.id, nameDraft);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save invoice name.");
        return;
      }
      toast.success("Invoice name saved.");
      setEditingName(false);
      router.refresh();
    });
  }

  function sendInvoiceEmail() {
    startEmail(async () => {
      const result = await sendInvoiceEmailAction(invoice.id);
      if (!result.ok) { toast.error(result.message ?? "Could not send."); return; }
      if ("method" in result && result.method === "mailto" && result.mailtoUrl) {
        window.open(result.mailtoUrl, "_blank");
        toast.success("Your email app opened. Hello to Cheers did not send this email.");
      } else {
        toast.success("Emailed to the client.");
      }
      setPreviewOpen(false);
    });
  }

  function handleStatusChange(next: InvoiceStatus) {
    startTransition(async () => {
      const result = await updateInvoiceStatusAction(invoice.id, next);
      if (result.ok) { setStatus(next); toast.success(`Invoice marked as ${invoiceStatusLabel(next)}.`); router.refresh(); }
      else toast.error(result.message ?? "Could not update status.");
    });
  }

  return (
    <div className="space-y-6">
      <BusinessAssetHeader
        backHref="/invoices"
        backLabel="Invoices"
        whatIsThis="Invoice"
        title={humanTitle}
        status={<>
          <InvoiceStatusBadge status={status} />
          <QuickBooksSyncStatusBadge status={invoice.quickbooksSyncStatus} entityType="invoice" entityId={invoice.id} />
        </>}
        waitingOn={INVOICE_WAITING_ON[status]}
        lastUpdated={new Date(invoice.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        relationship={invoice.clientName ? { name: invoice.clientName, href: `/clients/${invoice.clientId}` } : null}
        primaryAction={transition && (
          <Button type="button" size="sm" onClick={() => handleStatusChange(transition.next)} disabled={pending}>
            {pending ? "Updating…" : transition.label}
          </Button>
        )}
      />

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          System number <span className="font-medium text-foreground">{invoice.invoiceNumber}</span>
          {" "}(immutable — for accounting and integrations)
        </p>
        {editingName ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-8 min-w-[12rem] flex-1 rounded-md border border-border bg-background px-2 text-sm"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={120}
              aria-label="Invoice name"
            />
            <Button type="button" size="sm" onClick={saveDisplayName} disabled={namePending || !nameDraft.trim()}>
              {namePending ? "Saving…" : "Save name"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameDraft(humanTitle); }} disabled={namePending}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingName(true)}>
            Edit invoice name
          </Button>
        )}
      </div>

      {(invoice.eventDate || invoice.eventOrderRevisionAtFreeze != null || invoice.amendsInvoiceId || invoice.amendedByInvoiceId) && (
        <div className="space-y-1">
          {invoice.eventDate && (
            <p className="text-xs text-muted-foreground">
              {new Date(invoice.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          {invoice.eventOrderRevisionAtFreeze != null && (
            <p className="text-xs text-muted-foreground">Generated from Event Order v{invoice.eventOrderRevisionAtFreeze}</p>
          )}
          {invoice.amendsInvoiceId && (
            <p className="text-xs text-muted-foreground">
              Amends <Link href={`/invoices/${invoice.amendsInvoiceId}`} className="text-primary hover:underline">an earlier invoice</Link>
            </p>
          )}
          {invoice.amendedByInvoiceId && (
            <p className="text-xs text-muted-foreground">
              An amended invoice exists: <Link href={`/invoices/${invoice.amendedByInvoiceId}`} className="text-primary hover:underline">{invoice.amendedByInvoiceNumber} →</Link>
              {" "}This invoice remains the active financial record until that one is sent.
            </p>
          )}
        </div>
      )}

      <BusinessAssetActionRow
        secondary={<>
          {invoice.clientId && status !== "void" && (
            <Button type="button" variant="outline" size="sm"
              title="Full-page preview of the invoice the client would receive. Preview does not send it."
              onClick={() => setPreviewOpen(true)}>
              <Mail className="mr-1 h-3.5 w-3.5" /> Preview
            </Button>
          )}
          {linkedScheduleId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<Link href={`/payments/${linkedScheduleId}`} />}
            >
              View payment plan
            </Button>
          )}
          {status !== "void" && status !== "paid" && (
            <Button type="button" variant="outline" size="sm"
              onClick={() => { if (confirm("Void this invoice?")) handleStatusChange("void"); }}
              disabled={pending} className="text-muted-foreground">
              Void
            </Button>
          )}
        </>}
        printOrDownload={
          <Button type="button" variant="outline" size="sm" render={<Link href={`/invoices/${invoice.id}/print`} target="_blank" />}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print
          </Button>
        }
      />

      {eventOrderDrift && (
        <EventOrderDriftBanner
          invoiceId={invoice.id} drift={eventOrderDrift}
          canRevertToDraft={invoice.balanceDue >= invoice.total}
          hasExistingAmendment={!!invoice.amendedByInvoiceId}
        />
      )}

      {/* Contracted vs paid vs remaining vs next installment due */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Contracted</p>
              <p className="text-xl font-semibold text-heading">{formatCurrency(invoice.total)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid to Date</p>
              <p className="text-xl font-semibold text-success">{formatCurrency(displayPaidToDate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance Remaining</p>
              <p className="text-xl font-semibold text-heading">{formatCurrency(invoice.balanceDue)}</p>
              {cancelledPlanAmount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(cancelledPlanAmount)} cancelled on the payment plan
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              {amountDueNow?.kind === "paid_in_full" || (!(invoice.balanceDue > 0) && !amountDueNow) ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount Due Now</p>
                  <p className="text-2xl font-semibold text-success">Paid in Full</p>
                </>
              ) : amountDueNow?.kind === "next_installment" ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount Due Now</p>
                  <p className="text-2xl font-semibold text-heading">{formatCurrency(amountDueNow.amount)}</p>
                  {amountDueNow.label && (
                    <p className="text-xs text-muted-foreground mt-0.5">{amountDueNow.label}</p>
                  )}
                  {amountDueNow.dueDate && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {new Date(amountDueNow.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-semibold text-heading">{formatCurrency(invoice.balanceDue)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {amountDueNow?.reason === "no_schedule"
                      ? "No payment schedule yet — create one to see the next installment due."
                      : "No open installment on the payment schedule."}
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-muted-foreground" /> Line Items
          </CardTitle>
          <CardDescription>
            {status === "draft" && invoice.eventOrderId
              ? "Lines tagged “Event Order” update automatically from this event's Event Order. Add packages or custom line items for anything else."
              : status === "draft"
                ? "Add packages from your catalog or enter custom line items."
                : "Invoice is locked — edit is only available in Draft status."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceLineItemsEditor
            invoiceId={invoice.id}
            initialItems={invoice.lineItems}
            packages={packages}
            invoiceStatus={status}
          />
        </CardContent>
      </Card>

      {/* Totals summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <dl className="space-y-2 text-sm min-w-64">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatCurrency(invoice.subtotal)}</dd>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discounts / Deposits</dt>
                  <dd className="font-medium text-success">−{formatCurrency(invoice.discountAmount)}</dd>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-medium">{formatCurrency(invoice.taxAmount)}</dd>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold text-heading">
                <dt>Total</dt>
                <dd>{formatCurrency(invoice.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Balance Due</dt>
                <dd className={`font-semibold ${invoice.balanceDue > 0 ? "text-destructive" : "text-success"}`}>
                  {formatCurrency(invoice.balanceDue)}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Notes from your venue */}
      {invoice.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base text-sm">{NOTES_FROM_YOUR_VENUE_LABEL}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p></CardContent>
        </Card>
      )}

      {/* Payment schedule CTAs — primary booking path is Invoice → Schedule */}
      {status !== "void" && invoice.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            {linkedScheduleId && scheduleLines && scheduleLines.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-heading">Payment plan</p>
                    <p className="text-xs text-muted-foreground">
                      Complete schedule for this booking. Preview does not send. Requesting the initial payment is a separate action.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewOpen(true)}
                    >
                      Preview payment plan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      render={<Link href={`/payments/${linkedScheduleId}`} />}
                    >
                      View payment plan
                    </Button>
                    {!planHasActivity && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPlan(true)}
                      >
                        Edit payment plan
                      </Button>
                    )}
                    {invoice.clientId && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={emailPending || planMismatch}
                        onClick={sendInvoiceEmail}
                      >
                        {emailPending
                          ? "Sending…"
                          : emailConfigured
                            ? "Request initial payment"
                            : "Open request in email"}
                      </Button>
                    )}
                  </div>
                </div>
                {planMismatch && (
                  <PaymentPlanNeedsReview
                    previousTotal={scheduledTotal}
                    nextTotal={invoice.total}
                    canEdit={!planHasActivity}
                    onEdit={() => setEditingPlan(true)}
                  />
                )}
                {editingPlan && !planHasActivity ? (
                  <div className="rounded-lg border border-border p-4">
                    <PaymentPlanEditor
                      scheduleId={linkedScheduleId}
                      invoiceId={invoice.id}
                      invoiceTotal={invoice.total}
                      lines={scheduleLines}
                      timingCtx={scheduleTiming ?? {
                        eventDate: invoice.eventDate,
                        bookingDate: invoice.bookedAt,
                        executedAt: null,
                        today: new Date().toISOString().slice(0, 10),
                      }}
                      commitLabel="Save payment plan"
                      onSaved={() => setEditingPlan(false)}
                    />
                  </div>
                ) : (
                <ul className="space-y-2 text-sm">
                  {scheduleLines.map((line, i) => (
                    <li
                      key={`${line.label}-${i}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-foreground">{line.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.dueDate
                            ? new Date(line.dueDate + "T12:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "No due date"}
                          {" · "}
                          <span className="capitalize">{line.status.replace(/_/g, " ")}</span>
                        </p>
                      </div>
                      <p className="font-semibold text-heading">{formatCurrency(line.amount)}</p>
                    </li>
                  ))}
                </ul>
                )}
              </div>
            ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-heading">
                  {continueToSchedule
                    ? "This invoice is ready — continue your payment schedule"
                    : "Create a payment schedule from this invoice"}
                </p>
                <p className="text-xs text-muted-foreground">
                  A payment schedule is the installment plan for this booking. Amounts come from this invoice
                  total ({formatCurrency(invoice.total)}); due dates come from the Event date when you use a starter.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                render={<Link href={continueToSchedule ?? `/payments/new?invoiceId=${invoice.id}`} />}
              >
                {continueToSchedule ? "Continue to payment schedule →" : "Create payment schedule →"}
              </Button>
            </div>
            )}
          </CardContent>
        </Card>
      )}
      {status !== "void" && invoice.total <= 0 && (
        <Card>
          <CardContent className="pt-6 space-y-1">
            <p className="text-sm font-medium text-heading">Add an amount before creating a payment schedule</p>
            <p className="text-xs text-muted-foreground">
              This draft is at $0. Add line items or a package above. Once the total is greater than $0,
              {continueToSchedule
                ? " you can continue back to the payment schedule you started."
                : " you can create a payment schedule from this invoice."}
            </p>
            {continueToSchedule && (
              <p className="text-[11px] text-muted-foreground pt-1">
                We&apos;ll keep your place — after you add the amount, use{" "}
                <span className="font-medium text-foreground">Continue to payment schedule</span> on this page.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Work Package D8 — invoice_activities was already recorded (status
          changes, sends) but never rendered anywhere; this is now the fifth
          of five Business Asset detail pages to show it, matching Contract/
          Event Order/Brochure/Questionnaire. */}
      {invoice.activities.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent><ActivityTimeline activities={invoice.activities} /></CardContent>
        </Card>
      )}

      <ArtifactReviewOverlay
        open={previewOpen}
        eyebrow="Customer-facing invoice"
        title={humanTitle}
        onBack={() => setPreviewOpen(false)}
        primary={invoice.clientId && status !== "void" && !planMismatch ? (
          <Button type="button" size="sm" disabled={emailPending} onClick={sendInvoiceEmail}>
            {emailPending
              ? "Sending…"
              : emailConfigured ? "Send by email" : "Open in my email app"}
          </Button>
        ) : undefined}
      >
        <div className="bg-white py-8">
          <InvoicePrintDocument
            invoice={invoice}
            venue={venue}
            amountDueNow={amountDueNow}
            paidToDateOverride={paidToDate}
            cancelledPlanAmount={cancelledPlanAmount}
            scheduleLines={scheduleLines}
            paymentInstructions={scheduleNotes ?? invoice.notes}
          />
        </div>
      </ArtifactReviewOverlay>
    </div>
  );
}
