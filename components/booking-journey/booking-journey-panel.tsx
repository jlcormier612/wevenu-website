"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  markOfferAcceptedAction,
  prepareCreateContractAction,
  sendOfferAction,
} from "@/app/(app)/booking-journey/actions";
import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { BookingJourneyStrip } from "@/components/booking-journey/booking-journey-strip";
import { ProposalArtifact } from "@/components/booking-journey/proposal-artifact";
import { SelectPackageSheet } from "@/components/booking-journey/select-package-sheet";
import { SetupPaymentsSheet } from "@/components/booking-journey/setup-payments-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { BookingJourneyModel } from "@/lib/booking-journey/model";
import { selectionStatusLabel } from "@/lib/booking-journey/model";
import { proposalViewFromSelection } from "@/lib/booking-journey/proposal-view";
import { remainingAmount } from "@/lib/commercial-selections/constants";
import { formatCurrency } from "@/lib/invoices/constants";
import type { PackageWithItems } from "@/lib/packages/types";

export function BookingJourneyPanel({
  journey,
  packages,
  leadId,
  clientId,
  eventId,
  eventDate,
  spaceId,
}: {
  journey: BookingJourneyModel;
  packages: PackageWithItems[];
  leadId?: string;
  clientId?: string;
  eventId?: string;
  eventDate?: string | null;
  /** Event Space selected on the Lead — used when quietly creating a dated Event. */
  spaceId?: string;
}) {
  const router = useRouter();
  const [selectOpen, setSelectOpen] = React.useState(false);
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [offerReviewOpen, setOfferReviewOpen] = React.useState(false);
  const [paymentsOpen, setPaymentsOpen] = React.useState(false);
  const [offerMessage, setOfferMessage] = React.useState("");
  const [acceptUrl, setAcceptUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const selection = journey.selection;

  function handleCreateContract() {
    if (!selection) return;
    startTransition(async () => {
      try {
        const result = await prepareCreateContractAction({
          selectionId: selection.id,
          leadId,
          spaceId,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        // Hard navigate — soft push + refresh races with rolling deploys and can
        // leave the Lead detail route stuck on the parent loading skeleton.
        window.location.assign(result.href);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/Failed to find Server Action|older or newer deployment/i.test(message)) {
          toast.error("The app was updated — reload this page and try Create contract again.");
        } else {
          toast.error("Could not open Create contract. Reload and try again.");
        }
      }
    });
  }

  function handlePrimary(action: string) {
    if (action === "select_package") setSelectOpen(true);
    else if (action === "send_offer" || action === "remind_offer") setOfferOpen(true);
    else if (action === "mark_accepted") handleMarkAccepted();
    else if (action === "setup_payments") {
      if (selection) setPaymentsOpen(true);
    } else if (action === "create_contract") handleCreateContract();
    else if (action === "record_deposit") handleRecordDeposit();
    else if (action === "invite_portal" || action === "start_planning") {
      if (journey.primaryHref) router.push(journey.primaryHref);
    }
  }

  function handleSecondary(action: string) {
    if (action === "mark_accepted") handleMarkAccepted();
    else if (action === "create_contract") handleCreateContract();
    else if (action === "record_deposit") handleRecordDeposit();
  }

  function handleRecordDeposit() {
    if (!clientId) {
      toast.error("Open the booking file before recording a deposit.");
      return;
    }
    startTransition(async () => {
      try {
        const { recordDepositReceivedAction } = await import(
          "@/app/(app)/booking-journey/payments-actions"
        );
        const result = await recordDepositReceivedAction({ clientId, leadId });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success("Deposit recorded.");
        router.refresh();
      } catch {
        toast.error("Could not record deposit. Reload and try again.");
      }
    });
  }

  function handleMarkAccepted() {
    if (!selection) return;
    startTransition(async () => {
      try {
        const result = await markOfferAcceptedAction({
          selectionId: selection.id,
          leadId,
          clientId,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Could not mark accepted.");
          return;
        }
        toast.success("Proposal marked accepted.");
        router.refresh();
      } catch {
        toast.error("Could not mark accepted. Reload and try again.");
      }
    });
  }

  function handleSendOffer() {
    if (!selection) return;
    startTransition(async () => {
      try {
        const result = await sendOfferAction({
          selectionId: selection.id,
          message: offerMessage,
          leadId,
          clientId,
        });
        if (!result.ok || !("acceptUrl" in result)) {
          toast.error(("message" in result && result.message) || "Could not send proposal.");
          return;
        }
        setAcceptUrl(result.acceptUrl);
        toast.success("Proposal ready — share the link with the couple.");
        setOfferReviewOpen(false);
        setOfferOpen(true);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/Failed to find Server Action|older or newer deployment/i.test(message)) {
          toast.error("The app was updated — reload this page and try Send proposal again.");
        } else {
          toast.error("Could not send proposal. Reload and try again.");
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      <BookingJourneyStrip
        journey={journey}
        onPrimaryAction={handlePrimary}
        onSecondaryAction={handleSecondary}
      />

      {selection && (
        <div className="rounded-lg border border-border bg-card px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Selected Package
              </p>
              <p className="mt-1 text-base font-medium text-heading">{selection.name}</p>
              <p className="text-sm text-heading">{formatCurrency(selection.totalAmount)}</p>
              {journey.prefs.initialPaymentRequired && (
              <p className="mt-1 text-sm text-muted-foreground">
                Deposit {formatCurrency(selection.depositAmount)} · Remaining{" "}
                {formatCurrency(remainingAmount(selection.totalAmount, selection.depositAmount))}
              </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Status: {selectionStatusLabel(selection.status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {journey.currentKey === "agreement" && (
                <>
                  {(journey.prefs.agreementMethod === "offer" || journey.prefs.agreementMethod === "either") && (
                  <Button type="button" size="sm" onClick={() => setOfferOpen(true)}>
                    Send proposal
                  </Button>
                  )}
                  {(journey.prefs.agreementMethod === "contract" || journey.prefs.agreementMethod === "either") && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={handleCreateContract}
                  >
                    {pending ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Preparing…
                      </>
                    ) : (
                      "Create contract"
                    )}
                  </Button>
                  )}
                </>
              )}
              {(journey.primaryAction === "setup_payments" ||
                (journey.currentKey === "deposit" && !selection.invoiceId)) && (
                <Button type="button" size="sm" onClick={() => setPaymentsOpen(true)}>
                  Set up payments
                </Button>
              )}
              {journey.currentKey === "package" || journey.currentKey === "agreement" ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectOpen(true)}>
                  Change package
                </Button>
              ) : null}
            </div>
          </div>
          {journey.currentKey === "agreement" && selection.status === "draft" && (
            <p className="mt-3 text-sm text-muted-foreground">
              {journey.prefs.initialPaymentRequired
                ? `Sending a proposal lets them accept ${selection.name}. After they accept, you'll collect the ${formatCurrency(selection.depositAmount)} deposit. Or create a contract from this package — they sign, then you collect the deposit. You do not need to start a booking file first.`
                : `Sending a proposal lets them accept ${selection.name}. After they accept — or after they sign a contract — they are Booked. No deposit is required. You do not need to start a booking file first.`}
            </p>
          )}
          {journey.primaryAction === "setup_payments" && journey.prefs.initialPaymentRequired && (
            <p className="mt-3 text-sm text-muted-foreground">
              Next: set up payments for the {formatCurrency(selection.depositAmount)} deposit.
              Planning stays optional until after they&apos;re Booked.
            </p>
          )}
        </div>
      )}

      <SelectPackageSheet
        open={selectOpen}
        onOpenChange={setSelectOpen}
        packages={packages}
        leadId={leadId}
        clientId={clientId}
        eventId={eventId}
        defaultDepositPercent={journey.prefs.defaultDepositPercent}
        initialPaymentRequired={journey.prefs.initialPaymentRequired}
      />

      {selection && (
        <SetupPaymentsSheet
          open={paymentsOpen}
          onOpenChange={setPaymentsOpen}
          selection={selection}
          clientId={clientId}
          eventId={eventId}
          eventDate={eventDate}
          leadId={leadId}
          spaceId={spaceId}
          defaultScheduleStructure={
            journey.prefs.remainingBalanceMode === "final"
              ? "deposit_remaining"
              : journey.prefs.defaultSchedulePresetId ?? "deposit_remaining"
          }
          paymentCollection={journey.prefs.paymentCollection}
        />
      )}

      <Sheet
        open={offerOpen}
        onOpenChange={(v) => {
          setOfferOpen(v);
          if (!v && !offerReviewOpen) {
            setAcceptUrl(null);
            setOfferMessage("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle>Send proposal</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Share {selection?.name} — {selection ? formatCurrency(selection.totalAmount) : ""}
              {journey.prefs.initialPaymentRequired && selection
                ? ` with deposit ${formatCurrency(selection.depositAmount)}.`
                : ". No deposit is required to book."}
            </p>
          </SheetHeader>
          {selection && (
            <div className="mb-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p className="font-medium text-heading">{selection.name}</p>
              <p>{formatCurrency(selection.totalAmount)}</p>
              {journey.prefs.initialPaymentRequired && (
              <p className="mt-1 text-muted-foreground">
                Deposit {formatCurrency(selection.depositAmount)} · Remaining{" "}
                {formatCurrency(remainingAmount(selection.totalAmount, selection.depositAmount))}
              </p>
              )}
              {selection.includedItems.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {selection.includedItems.map((item, i) => (
                    <li key={`${item.description}-${i}`}>• {item.description}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="offer-message">Short message (optional)</Label>
            <Textarea
              id="offer-message"
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              rows={3}
              placeholder="We're so glad you chose the Garden Package…"
            />
          </div>
          {acceptUrl && (
            <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Share this link with the couple:</p>
              <p className="break-all text-sm text-heading">{acceptUrl}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(acceptUrl);
                  toast.success("Link copied.");
                }}
              >
                Copy link
              </Button>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOfferOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setOfferReviewOpen(true);
                setOfferOpen(false);
              }}
              disabled={!selection}
            >
              Review proposal
            </Button>
          </div>
          {selection && selection.status !== "accepted" && (
            <div className="mt-8 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Internal exception — does not send the proposal to the couple.
              </p>
              <button
                type="button"
                className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                disabled={pending}
                onClick={handleMarkAccepted}
              >
                Mark accepted (offline)
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {selection ? (
        <ArtifactReviewOverlay
          open={offerReviewOpen}
          eyebrow="Customer-facing proposal"
          title={selection.name}
          onBack={() => {
            setOfferReviewOpen(false);
            setOfferOpen(true);
          }}
          primary={
            <Button type="button" size="sm" onClick={handleSendOffer} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send proposal"
              )}
            </Button>
          }
        >
          <ProposalArtifact
            proposal={proposalViewFromSelection(selection, offerMessage)}
            context="venue-preview"
          />
        </ArtifactReviewOverlay>
      ) : null}
    </div>
  );
}
