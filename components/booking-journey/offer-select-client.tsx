"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { approveOfferChoicesAction } from "@/app/offer/actions";
import { Button } from "@/components/ui/button";
import type { OfferView } from "@/lib/booking-journey/offer";
import { calculateProposalTotal } from "@/lib/commercial-proposals/types";
import { formatCurrency } from "@/lib/invoices/constants";
import type { CSSProperties } from "react";

const DEFAULT_BRAND = {
  primaryColor: "#5D6F5D",
  secondaryColor: "#4F5F4F",
  accentColor: "#B8AEA1",
  neutralColor: "#F7F5F1",
};

/**
 * Couple multi-option proposal: choose package + add-ons → see total → approve.
 * Legacy single-package offers still use OfferAcceptClient.
 */
export function OfferSelectClient({
  token,
  offer,
}: {
  token: string;
  offer: OfferView;
}) {
  const router = useRouter();
  const options = offer.options ?? [];
  const primaries = options.filter((o) => o.offerRole === "primary");
  const addons = options.filter((o) => o.offerRole === "addon");
  const approved = offer.status === "approved";

  const initialPrimary =
    offer.choices?.find((c) => c.offerRole === "primary")?.optionId ??
    (primaries.length === 1 ? primaries[0]!.id : "");
  const initialAddons = new Set(
    (offer.choices ?? []).filter((c) => c.offerRole === "addon").map((c) => c.optionId),
  );

  const [primaryId, setPrimaryId] = React.useState(initialPrimary);
  const [addonIds, setAddonIds] = React.useState<Set<string>>(initialAddons);
  const [pending, startTransition] = React.useTransition();

  const choices = React.useMemo(() => {
    const list: { optionId: string; quantity: number }[] = [];
    if (primaryId) list.push({ optionId: primaryId, quantity: 1 });
    for (const id of addonIds) list.push({ optionId: id, quantity: 1 });
    return list;
  }, [primaryId, addonIds]);

  const total = calculateProposalTotal(options, choices);
  const brand = offer.brand ?? DEFAULT_BRAND;
  const brandStyle = {
    "--venue-primary": brand.primaryColor,
    "--venue-secondary": brand.secondaryColor,
    "--venue-accent": brand.accentColor,
    "--venue-neutral": brand.neutralColor,
    backgroundColor: "var(--venue-neutral)",
  } as CSSProperties;

  function toggleAddon(id: string) {
    setAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApprove() {
    if (!primaryId) {
      toast.error("Choose a package to continue.");
      return;
    }
    startTransition(async () => {
      const result = await approveOfferChoicesAction(token, choices);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Thank you — your selection is approved.");
      router.refresh();
    });
  }

  const selectedPrimary = primaries.find((p) => p.id === primaryId);
  const selectedAddons = addons.filter((a) => addonIds.has(a.id));

  return (
    <div
      className="mx-auto min-h-full max-w-lg px-4 py-12"
      style={brandStyle}
      data-venue-brand="proposal"
    >
      <p
        className="text-xs font-medium uppercase tracking-widest"
        style={{ color: "var(--venue-secondary)" }}
      >
        Your proposal
      </p>
      {offer.venueName ? (
        <p className="mt-2 text-sm" style={{ color: "var(--venue-secondary)" }}>
          {offer.venueName}
        </p>
      ) : null}
      <h1
        className="mt-2 font-heading text-3xl text-foreground"
        style={{ borderBottom: "3px solid var(--venue-primary)", paddingBottom: "0.5rem" }}
      >
        Choose what you want
      </h1>
      {offer.offerMessage ? (
        <p
          className="mt-6 whitespace-pre-wrap rounded-lg border px-4 py-3 text-sm text-foreground"
          style={{ borderColor: "var(--venue-primary)", backgroundColor: "rgba(255,255,255,0.6)" }}
        >
          {offer.offerMessage}
        </p>
      ) : null}

      {approved ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm font-medium text-heading">You approved this selection</p>
          <ul className="space-y-2 text-sm">
            {offer.choices?.map((c) => (
              <li key={c.optionId} className="flex justify-between gap-3">
                <span>
                  {c.name}
                  {c.offerRole === "addon" ? " (add-on)" : ""}
                </span>
                <span className="font-medium">{formatCurrency(c.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <p className="text-2xl font-semibold" style={{ color: "var(--venue-accent)" }}>
            {formatCurrency(offer.totalAmount)}
          </p>
          <p className="text-sm text-muted-foreground">
            Your venue will follow up with the contract. This is not a booking yet.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Choose your package
            </h2>
            {primaries.map((opt) => {
              const active = opt.id === primaryId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPrimaryId(opt.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    active ? "border-heading bg-white/80" : "border-border bg-white/40 hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{opt.name}</p>
                      {opt.description ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                          {opt.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{formatCurrency(opt.unitPrice)}</p>
                  </div>
                </button>
              );
            })}
          </section>

          {addons.length > 0 ? (
            <section className="mt-8 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Optional additions
              </h2>
              {addons.map((opt) => {
                const active = addonIds.has(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
                      active ? "border-heading bg-white/80" : "border-border bg-white/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={active}
                      onChange={() => toggleAddon(opt.id)}
                    />
                    <div className="flex flex-1 items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{opt.name}</p>
                        {opt.description ? (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {opt.description}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{formatCurrency(opt.unitPrice)}</p>
                    </div>
                  </label>
                );
              })}
            </section>
          ) : null}

          <section className="mt-8 rounded-lg border border-border bg-white/70 px-4 py-4">
            <h2 className="text-sm font-semibold text-heading">Your selection</h2>
            {!selectedPrimary ? (
              <p className="mt-2 text-sm text-muted-foreground">Select a package above.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex justify-between gap-3">
                  <span>{selectedPrimary.name}</span>
                  <span>{formatCurrency(selectedPrimary.unitPrice)}</span>
                </li>
                {selectedAddons.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 text-muted-foreground">
                    <span>{a.name}</span>
                    <span>{formatCurrency(a.unitPrice)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-2xl font-semibold" style={{ color: "var(--venue-accent)" }}>
              {formatCurrency(total)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              What you are approving — not a contract or booking yet.
            </p>
          </section>

          <div className="mt-6">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={handleApprove}
              disabled={pending || !primaryId}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving…
                </>
              ) : (
                "Approve my selection"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
