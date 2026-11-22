"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatUsdFromCents } from "@shared/pricing/catalog";
import type { SaasPlanKey } from "@shared/pricing/types";
import { Panel, StatusPill } from "@/components/shared/ui";

type Preview = {
  planDisplayName: string;
  capacityLabel: string;
  listAmountCents: number;
  pricingKind: string;
  monthlyRecurringCents: number;
  monthlySavingsCents: number;
  whiteGloveAmountCents: number;
  whiteGloveLabel: string;
  initialPaymentCents: number;
  futureMonthlyCents: number;
  afterIntroMonthlyCents: number | null;
  afterIntroLabel: string;
  durationLabel: string;
  tierUpgradeLabel: string;
  expiresAt: string | null;
  promoNote: string;
  lines: string[];
};

type OfferRow = {
  id: string;
  relationshipId: string;
  status: string;
  internalName: string;
  internalNotes: string | null;
  reason: string | null;
  planKey: SaasPlanKey;
  listAmountCents: number;
  pricingKind: string;
  percentOff: number | null;
  amountOffCents: number | null;
  fixedRateCents: number | null;
  durationMode: string;
  durationBillingCycles: number | null;
  afterIntroPricing: string;
  percentUpgradePolicy: string;
  amountUpgradePolicy: string;
  fixedUpgradePolicy: string;
  fixedReplacementPrices: Partial<Record<"growing" | "professional", number>>;
  fixedUpgradeFallback: string | null;
  whiteGloveMode: string;
  whiteGloveAmountCents: number;
  expiresAt: string | null;
  replacesStandardPromos: boolean;
  revision: number;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  preview: Preview | null;
};

type RevisionRow = {
  id: string;
  revision: number;
  status: string;
  changeSummary: string | null;
  changedByEmail: string | null;
  createdAt: string;
};

type Props = {
  relationshipId: string;
  venueName: string;
  ownerName: string;
  ownerEmail: string;
  planId: string;
  canManage: boolean;
};

type EditorState = {
  internalName: string;
  internalNotes: string;
  reason: string;
  planKey: SaasPlanKey;
  pricingKind: "standard" | "percent_off" | "amount_off" | "fixed_rate";
  percentOff: string;
  amountOffDollars: string;
  fixedRateDollars: string;
  durationMode: "ongoing" | "billing_cycles";
  durationBillingCycles: string;
  afterIntroPricing: "standard_list" | "eligible_discount";
  percentUpgradePolicy: "follow" | "end";
  amountUpgradePolicy: "follow" | "end";
  fixedUpgradePolicy: "keep" | "end" | "replace";
  replaceGrowingDollars: string;
  replaceFlourishDollars: string;
  fixedUpgradeFallback: "standard_list" | "eligible_discount";
  whiteGloveMode: "none" | "standard_499" | "weven_399" | "custom" | "waived";
  whiteGloveCustomDollars: string;
  expiresAt: string;
};

function dollarsToCents(raw: string): number | null {
  const t = raw.trim().replace(/\$/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function planFromCrm(planId: string): SaasPlanKey {
  const k = planId.toLowerCase();
  if (k === "celebrate" || k === "growing") return "growing";
  if (k === "flourish" || k === "professional") return "professional";
  return "starter";
}

function defaultEditor(planId: string, venueName: string): EditorState {
  return {
    internalName: `${venueName} custom offer`,
    internalNotes: "",
    reason: "",
    planKey: planFromCrm(planId),
    pricingKind: "standard",
    percentOff: "15",
    amountOffDollars: "40",
    fixedRateDollars: "175",
    durationMode: "ongoing",
    durationBillingCycles: "3",
    afterIntroPricing: "standard_list",
    percentUpgradePolicy: "follow",
    amountUpgradePolicy: "follow",
    fixedUpgradePolicy: "keep",
    replaceGrowingDollars: "",
    replaceFlourishDollars: "",
    fixedUpgradeFallback: "standard_list",
    whiteGloveMode: "none",
    whiteGloveCustomDollars: "299",
    expiresAt: "",
  };
}

function editorFromOffer(offer: OfferRow): EditorState {
  return {
    internalName: offer.internalName,
    internalNotes: offer.internalNotes ?? "",
    reason: offer.reason ?? "",
    planKey: offer.planKey,
    pricingKind: offer.pricingKind as EditorState["pricingKind"],
    percentOff: String(offer.percentOff ?? 15),
    amountOffDollars: centsToDollarsInput(offer.amountOffCents),
    fixedRateDollars: centsToDollarsInput(offer.fixedRateCents),
    durationMode: offer.durationMode as EditorState["durationMode"],
    durationBillingCycles: String(offer.durationBillingCycles ?? 3),
    afterIntroPricing: offer.afterIntroPricing as EditorState["afterIntroPricing"],
    percentUpgradePolicy:
      offer.percentUpgradePolicy as EditorState["percentUpgradePolicy"],
    amountUpgradePolicy:
      offer.amountUpgradePolicy as EditorState["amountUpgradePolicy"],
    fixedUpgradePolicy:
      offer.fixedUpgradePolicy as EditorState["fixedUpgradePolicy"],
    replaceGrowingDollars: centsToDollarsInput(
      offer.fixedReplacementPrices?.growing ?? null,
    ),
    replaceFlourishDollars: centsToDollarsInput(
      offer.fixedReplacementPrices?.professional ?? null,
    ),
    fixedUpgradeFallback:
      (offer.fixedUpgradeFallback as EditorState["fixedUpgradeFallback"]) ||
      "standard_list",
    whiteGloveMode: offer.whiteGloveMode as EditorState["whiteGloveMode"],
    whiteGloveCustomDollars: centsToDollarsInput(
      offer.whiteGloveMode === "custom" ? offer.whiteGloveAmountCents : 29900,
    ),
    expiresAt: offer.expiresAt ? offer.expiresAt.slice(0, 10) : "",
  };
}

function buildTerms(editor: EditorState) {
  const fixedReplacementPrices: Partial<
    Record<"growing" | "professional", number>
  > = {};
  const g = dollarsToCents(editor.replaceGrowingDollars);
  const p = dollarsToCents(editor.replaceFlourishDollars);
  if (g != null) fixedReplacementPrices.growing = g;
  if (p != null) fixedReplacementPrices.professional = p;

  return {
    planKey: editor.planKey,
    pricingKind: editor.pricingKind,
    percentOff:
      editor.pricingKind === "percent_off"
        ? Number.parseInt(editor.percentOff, 10)
        : null,
    amountOffCents:
      editor.pricingKind === "amount_off"
        ? dollarsToCents(editor.amountOffDollars)
        : null,
    fixedRateCents:
      editor.pricingKind === "fixed_rate"
        ? dollarsToCents(editor.fixedRateDollars)
        : null,
    durationMode: editor.durationMode,
    durationBillingCycles:
      editor.durationMode === "billing_cycles"
        ? Number.parseInt(editor.durationBillingCycles, 10)
        : null,
    afterIntroPricing: editor.afterIntroPricing,
    percentUpgradePolicy: editor.percentUpgradePolicy,
    amountUpgradePolicy: editor.amountUpgradePolicy,
    fixedUpgradePolicy: editor.fixedUpgradePolicy,
    fixedReplacementPrices,
    fixedUpgradeFallback:
      editor.pricingKind === "fixed_rate" &&
      editor.fixedUpgradePolicy === "replace"
        ? editor.fixedUpgradeFallback
        : null,
    whiteGloveMode: editor.whiteGloveMode,
    whiteGloveAmountCents:
      editor.whiteGloveMode === "custom"
        ? dollarsToCents(editor.whiteGloveCustomDollars)
        : null,
    expiresAt: editor.expiresAt
      ? new Date(`${editor.expiresAt}T23:59:59.000Z`).toISOString()
      : null,
    replacesStandardPromos: true,
  };
}

function statusTone(status: string): "neutral" | "good" | "warn" | "muted" {
  if (status === "draft") return "neutral";
  if (status === "accepted" || status === "sent" || status === "viewed")
    return "good";
  if (status === "discarded" || status === "revoked" || status === "superseded")
    return "muted";
  if (status === "expired") return "warn";
  return "neutral";
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SalesOffersPanel({
  relationshipId,
  venueName,
  ownerName,
  ownerEmail,
  planId,
  canManage,
}: Props) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"list" | "edit" | "preview">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expectedRevision, setExpectedRevision] = useState(1);
  const [editor, setEditor] = useState<EditorState>(() =>
    defaultEditor(planId, venueName),
  );
  const [livePreview, setLivePreview] = useState<Preview | null>(null);
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(
      `/api/relationships/sales-offers?relationshipId=${encodeURIComponent(relationshipId)}`,
    );
    const data = (await res.json()) as {
      ok?: boolean;
      offers?: OfferRow[];
      error?: string;
    };
    if (!res.ok || !data.ok) {
      setError(data.error || "Could not load offers.");
      return;
    }
    setOffers(data.offers || []);
  }, [relationshipId]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  async function refreshPreview(next = editor) {
    const res = await fetch("/api/relationships/sales-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview",
        relationshipId,
        terms: buildTerms(next),
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      preview?: Preview;
      issues?: Array<{ message: string }>;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.preview) {
      setLivePreview(null);
      setError(
        data.issues?.map((i) => i.message).join(" ") ||
          data.error ||
          "Preview unavailable",
      );
      return;
    }
    setError(null);
    setLivePreview(data.preview);
  }

  useEffect(() => {
    if (mode === "edit" || mode === "preview") {
      const t = setTimeout(() => {
        void refreshPreview();
      }, 250);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, mode]);

  const listPriceHint = useMemo(() => {
    const map: Record<SaasPlanKey, string> = {
      starter: "$199/mo · 0–25 events",
      growing: "$249/mo · 26–75 events",
      professional: "$349/mo · 76+ events",
    };
    return map[editor.planKey];
  }, [editor.planKey]);

  function openCreate() {
    setEditingId(null);
    setExpectedRevision(1);
    setEditor(defaultEditor(planId, venueName));
    setRevisions([]);
    setShowHistory(false);
    setMessage(null);
    setMode("edit");
  }

  async function openOffer(offer: OfferRow) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/relationships/sales-offers?relationshipId=${encodeURIComponent(relationshipId)}&offerId=${encodeURIComponent(offer.id)}&revisions=1`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        offer?: OfferRow;
        revisions?: RevisionRow[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.offer) {
        setError(data.error || "Could not open offer.");
        return;
      }
      setEditingId(data.offer.id);
      setExpectedRevision(data.offer.revision);
      setEditor(editorFromOffer(data.offer));
      setLivePreview(data.offer.preview);
      setRevisions(data.revisions || []);
      setShowHistory(true);
      setMode(data.offer.status === "draft" ? "edit" : "preview");
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        relationshipId,
        internalName: editor.internalName,
        internalNotes: editor.internalNotes,
        reason: editor.reason,
        terms: buildTerms(editor),
        ...(editingId
          ? {
              action: "update",
              offerId: editingId,
              expectedRevision,
              changeSummary: "Saved draft",
            }
          : { action: "create" }),
      };
      const res = await fetch("/api/relationships/sales-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        offer?: OfferRow;
        error?: string;
        issues?: Array<{ message: string }>;
        code?: string;
      };
      if (!res.ok || !data.ok || !data.offer) {
        setError(
          data.issues?.map((i) => i.message).join(" ") ||
            data.error ||
            "Save failed",
        );
        return;
      }
      setEditingId(data.offer.id);
      setExpectedRevision(data.offer.revision);
      setEditor(editorFromOffer(data.offer));
      setLivePreview(data.offer.preview);
      setMessage("Draft saved. No Stripe checkout was created.");
      await load();
      const revRes = await fetch(
        `/api/relationships/sales-offers?relationshipId=${encodeURIComponent(relationshipId)}&offerId=${encodeURIComponent(data.offer.id)}&revisions=1`,
      );
      const revData = (await revRes.json()) as { revisions?: RevisionRow[] };
      setRevisions(revData.revisions || []);
      setShowHistory(true);
    } finally {
      setBusy(false);
    }
  }

  async function duplicateOffer(offerId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/relationships/sales-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate",
          relationshipId,
          offerId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        offer?: OfferRow;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.offer) {
        setError(data.error || "Duplicate failed");
        return;
      }
      await load();
      await openOffer(data.offer);
      setMessage("Duplicated into a new draft.");
    } finally {
      setBusy(false);
    }
  }

  async function discardCurrent() {
    if (!editingId) return;
    if (
      !window.confirm(
        "Discard this unused draft? This cannot be undone, but prior revision history is retained.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/relationships/sales-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discard",
          relationshipId,
          offerId: editingId,
          expectedRevision,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Discard failed");
        return;
      }
      setMode("list");
      setEditingId(null);
      setMessage("Draft discarded.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return null;
  }

  return (
    <Panel
      title="Custom offers"
      action={
        mode === "list" ? (
          <button
            type="button"
            className="ws-btn ws-btn-primary"
            onClick={openCreate}
            data-testid="create-custom-offer"
          >
            Create Custom Offer
          </button>
        ) : (
          <button
            type="button"
            className="ws-btn"
            onClick={() => {
              setMode("list");
              setEditingId(null);
            }}
          >
            Back to offers
          </button>
        )
      }
    >
      <p className="mb-4 text-sm text-[var(--htc-muted)]">
        Pre-purchase subscription proposals for{" "}
        <span className="text-[var(--htc-ink)]">{venueName}</span>
        {ownerName || ownerEmail ? (
          <>
            {" "}
            · {ownerName || ownerEmail}
          </>
        ) : null}
        . Drafts do not create Stripe checkouts, subscriptions, or Customer
        Success records.
      </p>

      {error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-3 rounded-md border border-[color-mix(in_srgb,var(--htc-forest)_25%,transparent)] bg-[color-mix(in_srgb,var(--htc-forest)_6%,white)] px-3 py-2 text-sm text-[var(--htc-forest)]">
          {message}
        </p>
      ) : null}

      {mode === "list" ? (
        <div className="space-y-3" data-testid="sales-offers-list">
          {offers.length === 0 ? (
            <p className="text-sm text-[var(--htc-muted)]">
              No custom offers yet. Create a draft to negotiate pricing before
              the venue subscribes.
            </p>
          ) : (
            offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--taupe-medium)_30%,transparent)] pb-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--htc-ink)]">
                      {offer.internalName}
                    </p>
                    <StatusPill tone={statusTone(offer.status)}>
                      {offer.status}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-sm text-[var(--htc-muted)]">
                    {offer.preview?.planDisplayName || offer.planKey} ·{" "}
                    {formatUsdFromCents(
                      offer.preview?.monthlyRecurringCents ??
                        offer.listAmountCents,
                    )}
                    /mo · WG{" "}
                    {formatUsdFromCents(
                      offer.preview?.whiteGloveAmountCents ??
                        offer.whiteGloveAmountCents,
                    )}{" "}
                    · Updated {formatWhen(offer.updatedAt)}
                    {offer.expiresAt
                      ? ` · Expires ${formatWhen(offer.expiresAt)}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="ws-btn"
                    disabled={busy}
                    onClick={() => void openOffer(offer)}
                  >
                    {offer.status === "draft" ? "Edit" : "View"}
                  </button>
                  <button
                    type="button"
                    className="ws-btn"
                    disabled={busy}
                    onClick={() => void duplicateOffer(offer.id)}
                  >
                    Duplicate
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {(mode === "edit" || mode === "preview") && (
        <div className="space-y-6" data-testid="sales-offer-editor">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Internal offer name</span>
              <input
                className="ws-input w-full"
                value={editor.internalName}
                disabled={mode !== "edit"}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, internalName: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Offer expiration</span>
              <input
                type="date"
                className="ws-input w-full"
                value={editor.expiresAt}
                disabled={mode !== "edit"}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, expiresAt: e.target.value }))
                }
              />
              <span className="mt-1 block text-xs text-[var(--htc-muted)]">
                When the offer can no longer be accepted (separate from pricing
                duration).
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Subscription tier</span>
              <select
                className="ws-input w-full"
                value={editor.planKey}
                disabled={mode !== "edit"}
                onChange={(e) =>
                  setEditor((s) => ({
                    ...s,
                    planKey: e.target.value as SaasPlanKey,
                  }))
                }
              >
                <option value="starter">Gather — $199/mo</option>
                <option value="growing">Celebrate — $249/mo</option>
                <option value="professional">Flourish — $349/mo</option>
              </select>
              <span className="mt-1 block text-xs text-[var(--htc-muted)]">
                {listPriceHint}
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Pricing mode</span>
              <select
                className="ws-input w-full"
                value={editor.pricingKind}
                disabled={mode !== "edit"}
                data-testid="pricing-kind"
                onChange={(e) =>
                  setEditor((s) => ({
                    ...s,
                    pricingKind: e.target
                      .value as EditorState["pricingKind"],
                  }))
                }
              >
                <option value="standard">Standard tier price</option>
                <option value="percent_off">Percentage discount</option>
                <option value="amount_off">Fixed-dollar monthly discount</option>
                <option value="fixed_rate">Fixed monthly subscription price</option>
              </select>
            </label>
          </div>

          {editor.pricingKind === "percent_off" ? (
            <div className="grid gap-4 md:grid-cols-2" data-testid="percent-config">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Percent off</span>
                <input
                  className="ws-input w-full"
                  value={editor.percentOff}
                  disabled={mode !== "edit"}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, percentOff: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">On tier upgrade</span>
                <select
                  className="ws-input w-full"
                  value={editor.percentUpgradePolicy}
                  disabled={mode !== "edit"}
                  onChange={(e) =>
                    setEditor((s) => ({
                      ...s,
                      percentUpgradePolicy: e.target
                        .value as EditorState["percentUpgradePolicy"],
                    }))
                  }
                >
                  <option value="follow">Same % follows into the new tier</option>
                  <option value="end">End discount on upgrade</option>
                </select>
              </label>
            </div>
          ) : null}

          {editor.pricingKind === "amount_off" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Monthly discount ($)</span>
                <input
                  className="ws-input w-full"
                  value={editor.amountOffDollars}
                  disabled={mode !== "edit"}
                  onChange={(e) =>
                    setEditor((s) => ({
                      ...s,
                      amountOffDollars: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">On tier upgrade</span>
                <select
                  className="ws-input w-full"
                  value={editor.amountUpgradePolicy}
                  disabled={mode !== "edit"}
                  onChange={(e) =>
                    setEditor((s) => ({
                      ...s,
                      amountUpgradePolicy: e.target
                        .value as EditorState["amountUpgradePolicy"],
                    }))
                  }
                >
                  <option value="follow">Same $ off continues on new list</option>
                  <option value="end">End discount on upgrade</option>
                </select>
              </label>
            </div>
          ) : null}

          {editor.pricingKind === "fixed_rate" ? (
            <div className="space-y-4" data-testid="fixed-rate-config">
              <label className="block text-sm md:w-1/2">
                <span className="mb-1 block font-medium">
                  Fixed monthly price ($)
                </span>
                <input
                  className="ws-input w-full"
                  value={editor.fixedRateDollars}
                  disabled={mode !== "edit"}
                  onChange={(e) =>
                    setEditor((s) => ({
                      ...s,
                      fixedRateDollars: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm md:w-1/2">
                <span className="mb-1 block font-medium">On tier upgrade</span>
                <select
                  className="ws-input w-full"
                  value={editor.fixedUpgradePolicy}
                  disabled={mode !== "edit"}
                  onChange={(e) =>
                    setEditor((s) => ({
                      ...s,
                      fixedUpgradePolicy: e.target
                        .value as EditorState["fixedUpgradePolicy"],
                    }))
                  }
                >
                  <option value="keep">Keep negotiated price</option>
                  <option value="end">End custom price on upgrade</option>
                  <option value="replace">Use agreed replacement prices</option>
                </select>
              </label>
              {editor.fixedUpgradePolicy === "replace" ? (
                <div className="grid gap-4 rounded-md border border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] p-4 md:grid-cols-3">
                  {editor.planKey === "starter" ? (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">
                        Celebrate replacement ($)
                      </span>
                      <input
                        className="ws-input w-full"
                        value={editor.replaceGrowingDollars}
                        disabled={mode !== "edit"}
                        onChange={(e) =>
                          setEditor((s) => ({
                            ...s,
                            replaceGrowingDollars: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  {editor.planKey === "starter" || editor.planKey === "growing" ? (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">
                        Flourish replacement ($)
                      </span>
                      <input
                        className="ws-input w-full"
                        value={editor.replaceFlourishDollars}
                        disabled={mode !== "edit"}
                        onChange={(e) =>
                          setEditor((s) => ({
                            ...s,
                            replaceFlourishDollars: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Fallback if path unset
                    </span>
                    <select
                      className="ws-input w-full"
                      value={editor.fixedUpgradeFallback}
                      disabled={mode !== "edit"}
                      onChange={(e) =>
                        setEditor((s) => ({
                          ...s,
                          fixedUpgradeFallback: e.target
                            .value as EditorState["fixedUpgradeFallback"],
                        }))
                      }
                    >
                      <option value="standard_list">Standard list price</option>
                      <option value="eligible_discount">
                        Eligible standard discount
                      </option>
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Special pricing duration</span>
              <select
                className="ws-input w-full"
                value={editor.durationMode}
                disabled={mode !== "edit"}
                onChange={(e) =>
                  setEditor((s) => ({
                    ...s,
                    durationMode: e.target.value as EditorState["durationMode"],
                  }))
                }
              >
                <option value="ongoing">Ongoing</option>
                <option value="billing_cycles">Fixed number of billing cycles</option>
              </select>
            </label>
            {editor.durationMode === "billing_cycles" ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Billing cycles</span>
                  <input
                    className="ws-input w-full"
                    value={editor.durationBillingCycles}
                    disabled={mode !== "edit"}
                    onChange={(e) =>
                      setEditor((s) => ({
                        ...s,
                        durationBillingCycles: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">
                    After introductory pricing ends
                  </span>
                  <select
                    className="ws-input w-full"
                    value={editor.afterIntroPricing}
                    disabled={mode !== "edit"}
                    onChange={(e) =>
                      setEditor((s) => ({
                        ...s,
                        afterIntroPricing: e.target
                          .value as EditorState["afterIntroPricing"],
                      }))
                    }
                  >
                    <option value="standard_list">
                      Resume then-current tier standard list price
                    </option>
                    <option value="eligible_discount">
                      Resume eligible standard discount if still earned
                    </option>
                  </select>
                </label>
              </>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2" data-testid="white-glove-config">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">White Glove</span>
              <select
                className="ws-input w-full"
                value={editor.whiteGloveMode}
                disabled={mode !== "edit"}
                onChange={(e) =>
                  setEditor((s) => ({
                    ...s,
                    whiteGloveMode: e.target
                      .value as EditorState["whiteGloveMode"],
                  }))
                }
              >
                <option value="none">Not included</option>
                <option value="standard_499">Standard $499</option>
                <option value="weven_399">Former Weven $399</option>
                <option value="custom">Custom amount</option>
                <option value="waived">Waived ($0)</option>
              </select>
            </label>
            {editor.whiteGloveMode === "custom" ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Custom WG amount ($)</span>
                <input
                  className="ws-input w-full"
                  value={editor.whiteGloveCustomDollars}
                  disabled={mode !== "edit"}
                  onChange={(e) =>
                    setEditor((s) => ({
                      ...s,
                      whiteGloveCustomDollars: e.target.value,
                    }))
                  }
                />
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium">
                Internal notes (never customer-visible)
              </span>
              <textarea
                className="ws-input min-h-[88px] w-full"
                value={editor.internalNotes}
                disabled={mode !== "edit"}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, internalNotes: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium">Reason</span>
              <input
                className="ws-input w-full"
                value={editor.reason}
                disabled={mode !== "edit"}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, reason: e.target.value }))
                }
              />
            </label>
          </div>

          <div
            className="rounded-md border border-[color-mix(in_srgb,var(--htc-forest)_20%,transparent)] bg-[color-mix(in_srgb,var(--htc-forest)_4%,white)] p-4"
            data-testid="offer-preview"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-heading text-lg text-[var(--htc-forest)]">
                Offer preview
              </h3>
              <button
                type="button"
                className="ws-btn"
                onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
              >
                {mode === "preview" ? "Back to editor" : "Preview only"}
              </button>
            </div>
            {livePreview ? (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>{venueName}</strong> · {livePreview.planDisplayName} (
                  {livePreview.capacityLabel})
                </p>
                <p>
                  Standard monthly:{" "}
                  {formatUsdFromCents(livePreview.listAmountCents)}
                </p>
                <p>
                  Custom monthly:{" "}
                  <strong>
                    {formatUsdFromCents(livePreview.monthlyRecurringCents)}
                  </strong>
                  {livePreview.monthlySavingsCents > 0
                    ? ` · saves ${formatUsdFromCents(livePreview.monthlySavingsCents)}/mo`
                    : ""}
                </p>
                <p>Duration: {livePreview.durationLabel}</p>
                <p>Tier upgrades: {livePreview.tierUpgradeLabel}</p>
                <p>{livePreview.afterIntroLabel}</p>
                <p>White Glove: {livePreview.whiteGloveLabel}</p>
                <p className="pt-2">
                  <strong>Pays now (before tax):</strong>{" "}
                  {formatUsdFromCents(livePreview.initialPaymentCents)}
                </p>
                <p>
                  <strong>Pays later (recurring):</strong>{" "}
                  {formatUsdFromCents(livePreview.futureMonthlyCents)}/mo during
                  special pricing
                </p>
                {livePreview.expiresAt ? (
                  <p>Offer expires: {formatWhen(livePreview.expiresAt)}</p>
                ) : (
                  <p>Offer expiration: none set</p>
                )}
                <p className="text-[var(--htc-muted)]">{livePreview.promoNote}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--htc-muted)]">
                Adjust fields to generate a validated preview.
              </p>
            )}
          </div>

          {showHistory && revisions.length > 0 ? (
            <div data-testid="offer-revision-history">
              <h3 className="mb-2 font-heading text-lg">Revision history</h3>
              <ul className="space-y-2 text-sm">
                {revisions.map((r) => (
                  <li
                    key={r.id}
                    className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_25%,transparent)] pb-2"
                  >
                    Rev {r.revision} · {r.status} · {formatWhen(r.createdAt)}
                    {r.changedByEmail ? ` · ${r.changedByEmail}` : ""}
                    {r.changeSummary ? ` — ${r.changeSummary}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {mode === "edit" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ws-btn ws-btn-primary"
                disabled={busy}
                onClick={() => void saveDraft()}
                data-testid="save-offer-draft"
              >
                {busy ? "Saving…" : "Save draft"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="ws-btn"
                  disabled={busy}
                  onClick={() => void discardCurrent()}
                >
                  Discard draft
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
