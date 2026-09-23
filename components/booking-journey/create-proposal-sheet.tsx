"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  createProposalAction,
  sendProposalAction,
} from "@/app/(app)/booking-journey/actions";
import { MultiOptionProposalView } from "@/components/booking-journey/multi-option-proposal-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { OfferView } from "@/lib/booking-journey/offer";
import type { ProposalBrand } from "@/lib/booking-journey/proposal-view";
import { evaluatePackageEligibility } from "@/lib/packages/eligibility";
import type { PackageOfferRole } from "@/lib/packages/eligibility";
import type { PackageWithItems } from "@/lib/packages/types";
import { formatCurrency } from "@/lib/invoices/constants";

type DraftOption = {
  packageId: string;
  offerRole: PackageOfferRole;
};

type Step = "edit" | "preview" | "sent";

/** Build the same OfferView shape the couple page uses — not a second representation. */
export function buildDraftOfferView(input: {
  drafts: DraftOption[];
  packages: PackageWithItems[];
  message: string;
  venueName: string | null;
  brand: ProposalBrand | null;
}): OfferView {
  const options = input.drafts
    .map((d, sortOrder) => {
      const pkg = input.packages.find((p) => p.id === d.packageId);
      if (!pkg || pkg.basePrice == null) return null;
      return {
        id: `draft-${pkg.id}`,
        offerRole: d.offerRole,
        name: pkg.name,
        description: pkg.description,
        unitPrice: Number(pkg.basePrice),
        includedItems: (pkg.items ?? []).map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
        })),
        sortOrder,
      };
    })
    .filter((o): o is NonNullable<typeof o> => o != null);

  return {
    kind: "proposal",
    id: "draft-preview",
    name: "Choose what you want",
    venueName: input.venueName,
    totalAmount: 0,
    depositAmount: 0,
    remainingAmount: 0,
    includedItems: [],
    status: "draft",
    offerMessage: input.message.trim() || null,
    brand: input.brand,
    options,
    choices: [],
  };
}

export function CreateProposalSheet({
  open,
  onOpenChange,
  packages,
  leadId,
  clientId,
  eventId,
  eventType,
  guestCount,
  spaceId,
  venueName = null,
  brand = null,
  defaultDepositPercent = 25,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: PackageWithItems[];
  leadId?: string;
  clientId?: string;
  eventId?: string;
  eventType?: string | null;
  guestCount?: number | null;
  spaceId?: string | null;
  venueName?: string | null;
  brand?: ProposalBrand | null;
  /** Venue default % — shown as guidance only; deposit is set after the couple chooses. */
  defaultDepositPercent?: number;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<DraftOption[]>([]);
  const [message, setMessage] = React.useState("");
  const [step, setStep] = React.useState<Step>("edit");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");
  const [acceptUrl, setAcceptUrl] = React.useState<string | null>(null);

  const ctx = { eventType, guestCount, spaceId };
  const eligible = packages.filter((p) =>
    evaluatePackageEligibility(
      {
        isActive: p.isActive,
        basePrice: p.basePrice,
        offerRole: p.offerRole,
        eligibleEventTypes: p.eligibleEventTypes,
        minGuestCount: p.minGuestCount,
        maxGuestCount: p.maxGuestCount,
        eligibleSpaceIds: p.eligibleSpaceIds,
      },
      ctx,
    ).eligible,
  );

  function toggle(pkg: PackageWithItems) {
    setError("");
    setAcceptUrl(null);
    setStep("edit");
    setDrafts((prev) => {
      const exists = prev.find((d) => d.packageId === pkg.id);
      if (exists) return prev.filter((d) => d.packageId !== pkg.id);
      return [...prev, { packageId: pkg.id, offerRole: pkg.offerRole ?? "primary" }];
    });
  }

  function setRole(packageId: string, offerRole: PackageOfferRole) {
    setDrafts((prev) => prev.map((d) => (d.packageId === packageId ? { ...d, offerRole } : d)));
  }

  function reset() {
    setDrafts([]);
    setMessage("");
    setError("");
    setAcceptUrl(null);
    setStep("edit");
  }

  function validateDrafts(): string | null {
    if (drafts.length === 0) return "Choose at least one package or option to offer.";
    if (!drafts.some((d) => d.offerRole === "primary")) {
      return "Include at least one package choice (not only add-ons).";
    }
    return null;
  }

  function handlePreview() {
    const err = validateDrafts();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep("preview");
  }

  function handleCreateAndSend() {
    const err = validateDrafts();
    if (err) {
      setError(err);
      return;
    }
    startTransition(async () => {
      // Multi-option: no proposal-level purchase deposit. Deposit is computed
      // from the couple's chosen total after approve (see approveProposalByToken).
      const created = await createProposalAction({
        leadId,
        clientId,
        eventId,
        options: drafts,
        depositAmount: 0,
        message,
        eventType,
        guestCount,
        spaceId,
      });
      if (!created.ok) {
        setError(created.message);
        toast.error(created.message);
        return;
      }
      const sent = await sendProposalAction({
        proposalId: created.proposalId,
        message,
        leadId,
        clientId,
      });
      if (!sent.ok) {
        setError(sent.message);
        toast.error(sent.message);
        return;
      }
      setAcceptUrl(sent.acceptUrl);
      setStep("sent");
      toast.success("Proposal sent — share the link with the couple.");
      router.refresh();
    });
  }

  const draftOffer = buildDraftOfferView({
    drafts,
    packages,
    message,
    venueName,
    brand,
  });

  const sheetWide = step === "preview";

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent
        side="right"
        className={`w-full overflow-y-auto ${sheetWide ? "sm:max-w-xl" : "sm:max-w-lg"}`}
      >
        {step === "preview" ? (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle>Proposal preview</SheetTitle>
              <p className="text-sm text-muted-foreground">
                This is a preview — nothing has been sent. This is the same presentation the couple
                will receive.
              </p>
            </SheetHeader>
            <div className="rounded-lg border border-border overflow-hidden">
              <MultiOptionProposalView
                key={drafts.map((d) => `${d.packageId}:${d.offerRole}`).join("|") + "|" + message}
                offer={draftOffer}
                mode="preview"
              />
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("edit")} disabled={pending}>
                Back to edit
              </Button>
              <Button type="button" onClick={handleCreateAndSend} disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send proposal"
                )}
              </Button>
            </div>
          </>
        ) : step === "sent" && acceptUrl ? (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle>Proposal sent</SheetTitle>
            </SheetHeader>
            <div className="space-y-4">
              <p className="text-sm text-heading">Share this link with the couple:</p>
              <Input readOnly value={acceptUrl} onFocus={(e) => e.target.select()} />
              <Button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(acceptUrl);
                  toast.success("Link copied.");
                }}
              >
                Copy link
              </Button>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle>Create proposal</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Choose what you want to offer. Preview the couple&apos;s view, then send. Prices
                freeze when you send. Deposit is calculated after they choose a package.
              </p>
            </SheetHeader>

            <div className="space-y-4">
              {eligible.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No eligible priced packages. Add prices in Library → Packages, or relax eligibility
                  rules.
                </p>
              ) : (
                eligible.map((pkg) => {
                  const draft = drafts.find((d) => d.packageId === pkg.id);
                  const selected = Boolean(draft);
                  return (
                    <div
                      key={pkg.id}
                      className={`rounded-lg border px-4 py-3 ${
                        selected ? "border-heading bg-muted/40" : "border-border"
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected}
                          onChange={() => toggle(pkg)}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-heading">{pkg.name}</p>
                            <p className="shrink-0 text-sm font-semibold">
                              {formatCurrency(Number(pkg.basePrice))}
                            </p>
                          </div>
                          {pkg.description ? (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {pkg.description}
                            </p>
                          ) : null}
                          {selected && (
                            <div className="mt-2 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={draft?.offerRole === "primary" ? "default" : "outline"}
                                onClick={() => setRole(pkg.id, "primary")}
                              >
                                Package choice
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={draft?.offerRole === "addon" ? "default" : "outline"}
                                onClick={() => setRole(pkg.id, "addon")}
                              >
                                Optional add-on
                              </Button>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })
              )}

              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-heading">Deposit</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  There is no single deposit for a multi-option proposal. After the couple chooses,
                  Hello to Cheers will suggest {defaultDepositPercent}% of their selected total for
                  the deposit on the booking file.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proposal-message">Message to couple (optional)</Label>
                <Textarea
                  id="proposal-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="button" onClick={handlePreview} disabled={pending || drafts.length === 0}>
                  Preview
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
