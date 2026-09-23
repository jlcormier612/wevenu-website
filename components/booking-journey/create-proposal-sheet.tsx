"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  createProposalAction,
  sendProposalAction,
} from "@/app/(app)/booking-journey/actions";
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
import { evaluatePackageEligibility } from "@/lib/packages/eligibility";
import type { PackageOfferRole } from "@/lib/packages/eligibility";
import type { PackageWithItems } from "@/lib/packages/types";
import { formatCurrency } from "@/lib/invoices/constants";
import { suggestDepositAmount } from "@/lib/commercial-selections/constants";

type DraftOption = {
  packageId: string;
  offerRole: PackageOfferRole;
};

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
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<DraftOption[]>([]);
  const [message, setMessage] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
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
    setDeposit("");
    setError("");
    setAcceptUrl(null);
  }

  function handleCreateAndSend() {
    if (drafts.length === 0) {
      setError("Choose at least one package or option to offer.");
      return;
    }
    if (!drafts.some((d) => d.offerRole === "primary")) {
      setError("Include at least one package choice (not only add-ons).");
      return;
    }
    const depositAmount = deposit.trim()
      ? parseFloat(deposit.replace(/[$,]/g, ""))
      : undefined;
    startTransition(async () => {
      const created = await createProposalAction({
        leadId,
        clientId,
        eventId,
        options: drafts,
        depositAmount:
          depositAmount != null && !Number.isNaN(depositAmount) ? depositAmount : undefined,
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
      toast.success("Proposal sent — share the link with the couple.");
      router.refresh();
    });
  }

  const primaryDrafts = drafts.filter((d) => d.offerRole === "primary");
  const maxPrimary = Math.max(
    0,
    ...primaryDrafts.map((d) => {
      const p = packages.find((x) => x.id === d.packageId);
      return p?.basePrice != null ? Number(p.basePrice) : 0;
    }),
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-6">
          <SheetTitle>Create proposal</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Choose what you want to offer. The couple picks what they want, then approves. Prices
            freeze when you send.
          </p>
        </SheetHeader>

        {acceptUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-heading">Proposal sent. Share this link:</p>
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
        ) : (
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

            <div className="space-y-2">
              <Label htmlFor="proposal-deposit">Suggested deposit (optional)</Label>
              <Input
                id="proposal-deposit"
                value={deposit}
                placeholder={
                  maxPrimary > 0 ? String(suggestDepositAmount(maxPrimary, null)) : undefined
                }
                onChange={(e) => setDeposit(e.target.value)}
                inputMode="decimal"
              />
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
              <Button type="button" onClick={handleCreateAndSend} disabled={pending || drafts.length === 0}>
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
