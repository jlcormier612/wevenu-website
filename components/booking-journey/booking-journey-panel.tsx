"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  markOfferAcceptedAction,
  prepareCreateContractAction,
  resendProposalEmailAction,
  sendOfferAction,
} from "@/app/(app)/booking-journey/actions";
import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { CommercialFacts } from "@/components/booking-journey/commercial-facts";
import { ProposalArtifact } from "@/components/booking-journey/proposal-artifact";
import { CreateProposalSheet } from "@/components/booking-journey/create-proposal-sheet";
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
import { proposalViewFromSelection } from "@/lib/booking-journey/proposal-view";
import { publicAppOrigin } from "@/lib/env";
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
  eventType,
  guestCount,
}: {
  journey: BookingJourneyModel;
  packages: PackageWithItems[];
  leadId?: string;
  clientId?: string;
  eventId?: string;
  eventDate?: string | null;
  /** Event Space selected on the Lead — used when quietly creating a dated Event. */
  spaceId?: string;
  eventType?: string | null;
  guestCount?: number | null;
}) {
  const router = useRouter();
  const [selectOpen, setSelectOpen] = React.useState(false);
  const [proposalOpen, setProposalOpen] = React.useState(false);
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
          toast.error("The app was updated. Stay on this page, reload once, then try Create contract again.");
        } else if (message.trim()) {
          toast.error(message);
        } else {
          toast.error("Could not open Create contract. Stay on this Lead and try again.");
        }
      }
    });
  }

  function copyShareLink() {
    const token = selection?.acceptToken;
    if (!token) {
      toast.error("Create a share link first. Nothing has been emailed.");
      return;
    }
    const url = `${publicAppOrigin()}/offer/${token}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied. This was not emailed."),
      () => toast.error("Could not copy the link."),
    );
  }

  function handleRecordDeposit() {
    if (!clientId) {
      toast.error("Create the client before recording a deposit.");
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
        toast.success("Marked accepted.");
        router.refresh();
      } catch {
        toast.error("Could not mark accepted. Reload and try again.");
      }
    });
  }

  function handleResendProposalEmail() {
    const proposalId = journey.proposal?.id;
    if (!proposalId) return;
    startTransition(async () => {
      const result = await resendProposalEmailAction({ proposalId, leadId, clientId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.emailSubmitted) toast.success(result.emailMessage ?? "Proposal email submitted.");
      else toast.error(result.emailMessage ?? "The proposal email was not submitted.");
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
          toast.error(("message" in result && result.message) || "Could not create the share link.");
          return;
        }
        setAcceptUrl(result.acceptUrl);
        toast.success("Share link created. This was not emailed.");
        setOfferReviewOpen(false);
        setOfferOpen(true);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/Failed to find Server Action|older or newer deployment/i.test(message)) {
          toast.error("The app was updated — reload this page and try Create share link again.");
        } else {
          toast.error("Could not create the share link. Reload and try again.");
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      <CommercialFacts
        journey={journey}
        contractPending={pending}
        onSelectPackage={() => setSelectOpen(true)}
        onCreateProposal={() => setProposalOpen(true)}
        onPreviewProposal={() => setOfferReviewOpen(true)}
        onCreateShareLink={() => setOfferOpen(true)}
        onCopyShareLink={copyShareLink}
        onResendProposalEmail={journey.proposal?.id ? handleResendProposalEmail : undefined}
        onCreateContract={handleCreateContract}
        onSetupPayments={() => {
          if (selection) setPaymentsOpen(true);
        }}
        onRecordDeposit={handleRecordDeposit}
      />

      <CreateProposalSheet
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        packages={packages}
        leadId={leadId}
        clientId={clientId}
        eventId={eventId}
        eventType={eventType}
        guestCount={guestCount}
        spaceId={spaceId}
        venueName={journey.venueName}
        brand={journey.brand}
        defaultDepositPercent={journey.prefs.defaultDepositPercent}
      />

      <SelectPackageSheet
        open={selectOpen}
        onOpenChange={setSelectOpen}
        packages={packages}
        leadId={leadId}
        clientId={clientId}
        eventId={eventId}
        defaultDepositPercent={journey.prefs.defaultDepositPercent}
        initialPaymentRequired={journey.prefs.collectInitialPayment}
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
          customSchedule={journey.prefs.defaultCustomSchedule}
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
            <SheetTitle>Share message</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Optional note on {selection?.name}. Preview before creating a share link.
              Creating the link does not email it.
            </p>
          </SheetHeader>
          {selection && (
            <div className="mb-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p className="font-medium text-heading">{selection.name}</p>
              <p>{formatCurrency(selection.totalAmount)}</p>
              {journey.prefs.collectInitialPayment && (
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
              Review
            </Button>
          </div>
          {selection && selection.status !== "accepted" && (
            <div className="mt-8 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Internal exception — does not send anything to the couple.
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
          eyebrow="Customer-facing preview"
          title={selection.name}
          onBack={() => {
            setOfferReviewOpen(false);
          }}
          primary={
            selection.status === "accepted" ? undefined : (
            <Button type="button" size="sm" onClick={handleSendOffer} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Creating link…
                </>
              ) : (
                "Create share link"
              )}
            </Button>
            )
          }
        >
          <ProposalArtifact
            proposal={proposalViewFromSelection(selection, offerMessage, journey.brand)}
            context="venue-preview"
            eyebrow={selection.proposalId ? "Your proposal" : "Review and accept"}
            previewAcceptLabel={selection.proposalId ? "Accept proposal" : "Accept"}
          />
        </ArtifactReviewOverlay>
      ) : null}
    </div>
  );
}
