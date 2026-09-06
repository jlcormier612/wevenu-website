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
import { BookingJourneyStrip } from "@/components/booking-journey/booking-journey-strip";
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
import { remainingAmount } from "@/lib/commercial-selections/constants";
import { formatCurrency } from "@/lib/invoices/constants";
import type { PackageWithItems } from "@/lib/packages/types";

export function BookingJourneyPanel({
  journey,
  packages,
  leadId,
  clientId,
  eventId,
}: {
  journey: BookingJourneyModel;
  packages: PackageWithItems[];
  leadId?: string;
  clientId?: string;
  eventId?: string;
}) {
  const router = useRouter();
  const [selectOpen, setSelectOpen] = React.useState(false);
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [paymentsOpen, setPaymentsOpen] = React.useState(false);
  const [offerMessage, setOfferMessage] = React.useState("");
  const [acceptUrl, setAcceptUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const selection = journey.selection;

  function handleCreateContract() {
    if (!selection) return;
    startTransition(async () => {
      const result = await prepareCreateContractAction({
        selectionId: selection.id,
        leadId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push(result.href);
      router.refresh();
    });
  }

  function handlePrimary(action: string) {
    if (action === "select_package") setSelectOpen(true);
    else if (action === "send_offer" || action === "remind_offer") setOfferOpen(true);
    else if (action === "mark_accepted") handleMarkAccepted();
    else if (action === "setup_payments") {
      if (selection) setPaymentsOpen(true);
    } else if (action === "create_contract") handleCreateContract();
    else if (action === "invite_portal" || action === "start_planning") {
      if (journey.primaryHref) router.push(journey.primaryHref);
    }
  }

  function handleSecondary(action: string) {
    if (action === "mark_accepted") handleMarkAccepted();
    else if (action === "create_contract") handleCreateContract();
  }

  function handleMarkAccepted() {
    if (!selection) return;
    startTransition(async () => {
      const result = await markOfferAcceptedAction({
        selectionId: selection.id,
        leadId,
        clientId,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not mark accepted.");
        return;
      }
      toast.success("Offer marked accepted.");
      router.refresh();
    });
  }

  function handleSendOffer() {
    if (!selection) return;
    startTransition(async () => {
      const result = await sendOfferAction({
        selectionId: selection.id,
        message: offerMessage,
        leadId,
        clientId,
      });
      if (!result.ok || !("acceptUrl" in result)) {
        toast.error(("message" in result && result.message) || "Could not send offer.");
        return;
      }
      setAcceptUrl(result.acceptUrl);
      toast.success("Offer ready — share the link with the couple.");
      router.refresh();
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
              <p className="mt-1 text-sm text-muted-foreground">
                Deposit {formatCurrency(selection.depositAmount)} · Remaining{" "}
                {formatCurrency(remainingAmount(selection.totalAmount, selection.depositAmount))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Status: {selectionStatusLabel(selection.status)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {journey.currentKey === "agreement" && (
                <>
                  <Button type="button" size="sm" onClick={() => setOfferOpen(true)}>
                    Send offer
                  </Button>
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
              Sending an offer lets them accept {selection.name}. After they accept, you&apos;ll
              collect the {formatCurrency(selection.depositAmount)} deposit. Or create a contract
              from this package — they sign, then you collect the deposit. You do not need to start
              a planning workspace first.
            </p>
          )}
          {journey.primaryAction === "setup_payments" && (
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
      />

      {selection && (
        <SetupPaymentsSheet
          open={paymentsOpen}
          onOpenChange={setPaymentsOpen}
          selection={selection}
          clientId={clientId}
          eventId={eventId}
          leadId={leadId}
        />
      )}

      <Sheet
        open={offerOpen}
        onOpenChange={(v) => {
          setOfferOpen(v);
          if (!v) {
            setAcceptUrl(null);
            setOfferMessage("");
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle>Send offer</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Share {selection?.name} — {selection ? formatCurrency(selection.totalAmount) : ""} with
              deposit {selection ? formatCurrency(selection.depositAmount) : ""}.
            </p>
          </SheetHeader>
          {selection && (
            <div className="mb-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p className="font-medium text-heading">{selection.name}</p>
              <p>{formatCurrency(selection.totalAmount)}</p>
              <p className="mt-1 text-muted-foreground">
                Deposit {formatCurrency(selection.depositAmount)} · Remaining{" "}
                {formatCurrency(remainingAmount(selection.totalAmount, selection.depositAmount))}
              </p>
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
            <Button type="button" onClick={handleSendOffer} disabled={pending || !selection}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send offer"
              )}
            </Button>
          </div>
          {selection && selection.status !== "accepted" && (
            <button
              type="button"
              className="mt-4 text-xs text-muted-foreground underline-offset-2 hover:underline"
              disabled={pending}
              onClick={handleMarkAccepted}
            >
              Mark accepted (offline)
            </button>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
