"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OfferOptionView, OfferView } from "@/lib/booking-journey/offer";
import type { ProposalBrand } from "@/lib/booking-journey/proposal-view";
import { calculateProposalTotal } from "@/lib/commercial-proposals/types";
import { formatCurrency } from "@/lib/invoices/constants";
import type { CSSProperties } from "react";

const DEFAULT_BRAND: ProposalBrand = {
  primaryColor: "#5D6F5D",
  secondaryColor: "#4F5F4F",
  accentColor: "#B8AEA1",
  neutralColor: "#F7F5F1",
};

/**
 * Customer-facing multi-option proposal body.
 * Shared by /offer/{token} and the venue Create proposal → Preview step so
 * preview cannot drift from what the couple receives.
 */
export function MultiOptionProposalView({
  offer,
  mode = "live",
  onApprove,
  pending = false,
}: {
  offer: Pick<
    OfferView,
    "venueName" | "offerMessage" | "status" | "choices" | "totalAmount" | "brand" | "options"
  >;
  mode?: "live" | "preview";
  onApprove?: (choices: { optionId: string; quantity: number }[]) => void;
  pending?: boolean;
}) {
  const options = offer.options ?? [];
  const primaries = options.filter((o) => o.offerRole === "primary");
  const addons = options.filter((o) => o.offerRole === "addon");
  const approved = offer.status === "approved";
  const isPreview = mode === "preview";

  const initialPrimary =
    offer.choices?.find((c) => c.offerRole === "primary")?.optionId ??
    (primaries.length === 1 ? primaries[0]!.id : "");
  const initialAddons = new Set(
    (offer.choices ?? []).filter((c) => c.offerRole === "addon").map((c) => c.optionId),
  );

  const [primaryId, setPrimaryId] = React.useState(initialPrimary);
  const [addonIds, setAddonIds] = React.useState<Set<string>>(initialAddons);

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

  const selectedPrimary = primaries.find((p) => p.id === primaryId);
  const selectedAddons = addons.filter((a) => addonIds.has(a.id));

  return (
    <div
      className="mx-auto min-h-full max-w-lg px-4 py-12"
      style={brandStyle}
      data-venue-brand="proposal"
      data-proposal-mode={mode}
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
            {primaries.map((opt) => (
              <OptionCard
                key={opt.id}
                opt={opt}
                active={opt.id === primaryId}
                kind="primary"
                onSelect={() => setPrimaryId(opt.id)}
              />
            ))}
          </section>

          {addons.length > 0 ? (
            <section className="mt-8 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Optional additions
              </h2>
              {addons.map((opt) => (
                <OptionCard
                  key={opt.id}
                  opt={opt}
                  active={addonIds.has(opt.id)}
                  kind="addon"
                  onSelect={() => toggleAddon(opt.id)}
                />
              ))}
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
            {isPreview ? (
              <Button type="button" size="lg" className="w-full" disabled>
                Approve my selection
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => onApprove?.(choices)}
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
            )}
            {isPreview ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                The couple sees this button. Preview does not send or approve anything.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function OptionCard({
  opt,
  active,
  kind,
  onSelect,
}: {
  opt: OfferOptionView;
  active: boolean;
  kind: "primary" | "addon";
  onSelect: () => void;
}) {
  const inclusions = opt.includedItems ?? [];
  const body = (
    <div className="flex flex-1 items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{opt.name}</p>
        {opt.description ? (
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{opt.description}</p>
        ) : null}
        {inclusions.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {inclusions.map((item, i) => (
              <li key={`${opt.id}-inc-${i}`}>
                {item.description}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                {item.unit ? ` ${item.unit}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="shrink-0 text-sm font-semibold">{formatCurrency(opt.unitPrice)}</p>
    </div>
  );

  if (kind === "addon") {
    return (
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
          active ? "border-heading bg-white/80" : "border-border bg-white/40"
        }`}
      >
        <input type="checkbox" className="mt-1" checked={active} onChange={onSelect} />
        {body}
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
        active ? "border-heading bg-white/80" : "border-border bg-white/40 hover:bg-white/60"
      }`}
    >
      {body}
    </button>
  );
}
