"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatUsdFromCents,
  listAmountCents,
} from "@shared/pricing/catalog";
import {
  defaultEligibilityFromCrmHints,
  normalizeStandardDiscountEvidence,
  projectEligibleDiscount,
} from "@shared/pricing/sales-offer-compute";
import type {
  SalesOfferStandardDiscountEligibility,
  SalesOfferStandardDiscountEvidence,
} from "@shared/pricing/sales-offer-types";
import type { SaasPlanKey } from "@shared/pricing/types";
import { Panel, StatusPill } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

type EligibleProjection = {
  known: boolean;
  conditional?: boolean;
  amountCents: number | null;
  label: string;
  customerCopy?: string;
  explanation: string;
};

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
  afterIntroStandardEstimateCents: number;
  afterIntroEligibleProjection: EligibleProjection;
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
  standardDiscountEligibility: SalesOfferStandardDiscountEligibility;
  standardDiscountEvidence: SalesOfferStandardDiscountEvidence;
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
  foundingMember?: boolean;
  welcomeBackRequested?: boolean;
  welcomeBackVerified?: string;
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
  durationPreset: "ongoing" | "3" | "6" | "12" | "custom";
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
  showTierUpgrade: boolean;
  standardDiscountEligibility: SalesOfferStandardDiscountEligibility;
  standardDiscountEvidence: SalesOfferStandardDiscountEvidence;
};

const ELIGIBILITY_OPTIONS: Array<{
  value: SalesOfferStandardDiscountEligibility;
  label: string;
}> = [
  { value: "not_established", label: "Not established yet" },
  { value: "former_weven", label: "Former Weven customer — 20%" },
  {
    value: "founding",
    label: "Founding Member — 10% (subject to availability)",
  },
  { value: "additional_venue", label: "Additional venue — 10%" },
  { value: "none", label: "No standard discount applies" },
];

const PLANS: Array<{
  key: SaasPlanKey;
  name: string;
  price: string;
  range: string;
}> = [
  { key: "starter", name: "Gather", price: "$199/month", range: "0–25 events / year" },
  { key: "growing", name: "Celebrate", price: "$249/month", range: "26–75 events / year" },
  {
    key: "professional",
    name: "Flourish",
    price: "$349/month",
    range: "76+ events / year",
  },
];

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

function durationFromOffer(
  mode: string,
  cycles: number | null,
): Pick<EditorState, "durationPreset" | "durationBillingCycles"> {
  if (mode !== "billing_cycles" || !cycles) {
    return { durationPreset: "ongoing", durationBillingCycles: "3" };
  }
  if (cycles === 3 || cycles === 6 || cycles === 12) {
    return {
      durationPreset: String(cycles) as "3" | "6" | "12",
      durationBillingCycles: String(cycles),
    };
  }
  return { durationPreset: "custom", durationBillingCycles: String(cycles) };
}

function defaultEditor(
  planId: string,
  venueName: string,
  crmHints: {
    foundingMember?: boolean;
    wevenHint?: boolean;
  } = {},
): EditorState {
  const eligibility = defaultEligibilityFromCrmHints({
    foundingEligible: Boolean(crmHints.foundingMember),
    wevenEligible: Boolean(crmHints.wevenHint),
  });
  return {
    internalName: `${venueName} custom offer`,
    internalNotes: "",
    reason: "",
    planKey: planFromCrm(planId),
    pricingKind: "standard",
    percentOff: "15",
    amountOffDollars: "50",
    fixedRateDollars: "199",
    durationPreset: "ongoing",
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
    showTierUpgrade: false,
    standardDiscountEligibility: eligibility.standardDiscountEligibility,
    standardDiscountEvidence: eligibility.standardDiscountEvidence,
  };
}

function editorFromOffer(offer: OfferRow): EditorState {
  const dur = durationFromOffer(offer.durationMode, offer.durationBillingCycles);
  return {
    internalName: offer.internalName,
    internalNotes: offer.internalNotes ?? "",
    reason: offer.reason ?? "",
    planKey: offer.planKey,
    pricingKind: offer.pricingKind as EditorState["pricingKind"],
    percentOff: String(offer.percentOff ?? 15),
    amountOffDollars: centsToDollarsInput(offer.amountOffCents),
    fixedRateDollars: centsToDollarsInput(offer.fixedRateCents),
    ...dur,
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
    showTierUpgrade: offer.pricingKind !== "standard",
    standardDiscountEligibility:
      offer.standardDiscountEligibility ?? "not_established",
    standardDiscountEvidence:
      offer.standardDiscountEvidence ?? "not_established",
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

  const isSpecial = editor.pricingKind !== "standard";
  let durationMode: "ongoing" | "billing_cycles" = "ongoing";
  let durationBillingCycles: number | null = null;
  if (isSpecial) {
    if (editor.durationPreset === "ongoing") {
      durationMode = "ongoing";
    } else if (editor.durationPreset === "custom") {
      durationMode = "billing_cycles";
      durationBillingCycles = Number.parseInt(editor.durationBillingCycles, 10);
    } else {
      durationMode = "billing_cycles";
      durationBillingCycles = Number.parseInt(editor.durationPreset, 10);
    }
  }

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
    durationMode,
    durationBillingCycles,
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
    standardDiscountEligibility: editor.standardDiscountEligibility,
    standardDiscountEvidence: normalizeStandardDiscountEvidence(
      editor.standardDiscountEligibility,
      editor.standardDiscountEvidence,
    ),
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

function Section({
  title,
  copy,
  children,
  className,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[color-mix(in_srgb,var(--htc-border)_80%,transparent)] bg-[var(--htc-warm-white)] p-5 shadow-[0_1px_0_rgba(41,45,41,0.04)]",
        className,
      )}
    >
      <h3 className="font-heading text-xl text-[var(--htc-forest)]">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--htc-muted)]">
        {copy}
      </p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ChoiceCard({
  selected,
  title,
  detail,
  onClick,
  disabled,
}: {
  selected: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-3 text-left transition",
        selected
          ? "border-[var(--htc-primary)] bg-[color-mix(in_srgb,var(--htc-primary)_8%,white)] ring-1 ring-[var(--htc-primary)]"
          : "border-[var(--htc-border)] bg-white hover:border-[color-mix(in_srgb,var(--htc-forest)_40%,var(--htc-border))]",
        disabled && "opacity-50",
      )}
    >
      <span className="block text-sm font-medium text-[var(--htc-text)]">
        {title}
      </span>
      {detail ? (
        <span className="mt-0.5 block text-xs text-[var(--htc-muted)]">
          {detail}
        </span>
      ) : null}
    </button>
  );
}

type PanelProps = Props & {
  /** Stage 1E dedicated builder page — skip inline list shell */
  dedicatedPage?: boolean;
  /** Open existing offer on mount */
  initialOfferId?: string | null;
  /** Start a new draft editor on mount */
  startNew?: boolean;
  returnHref?: string;
  /** Relationship-level eligibility (Stage 1E) — preferred over CRM flag hints */
  relationshipStandardDiscountEligibility?: SalesOfferStandardDiscountEligibility;
};

export function SalesOffersPanel({
  relationshipId,
  venueName,
  ownerName,
  ownerEmail,
  planId,
  canManage,
  foundingMember = false,
  welcomeBackRequested = false,
  welcomeBackVerified = "none",
  dedicatedPage = false,
  initialOfferId = null,
  startNew = false,
  returnHref,
  relationshipStandardDiscountEligibility,
}: PanelProps) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [relationshipMissing, setRelationshipMissing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"list" | "edit">(
    dedicatedPage && (startNew || initialOfferId) ? "edit" : "list",
  );
  const [editingId, setEditingId] = useState<string | null>(
    dedicatedPage && initialOfferId ? initialOfferId : null,
  );
  const [expectedRevision, setExpectedRevision] = useState(1);
  const wevenHint =
    relationshipStandardDiscountEligibility === "former_weven" ||
    (welcomeBackRequested &&
      welcomeBackVerified !== "rejected" &&
      welcomeBackVerified !== "expired");
  const foundingHint =
    relationshipStandardDiscountEligibility === "founding" || foundingMember;

  const [editor, setEditor] = useState<EditorState>(() => {
    if (relationshipStandardDiscountEligibility) {
      const base = defaultEditor(planId, venueName, {});
      return {
        ...base,
        standardDiscountEligibility: relationshipStandardDiscountEligibility,
        standardDiscountEvidence:
          relationshipStandardDiscountEligibility === "not_established"
            ? "not_established"
            : relationshipStandardDiscountEligibility === "none"
              ? "explicitly_none"
              : "founder_recorded",
      };
    }
    return defaultEditor(planId, venueName, {
      foundingMember: foundingHint,
      wevenHint,
    });
  });
  const [livePreview, setLivePreview] = useState<Preview | null>(null);
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);

  const patchEditor = useCallback((patch: Partial<EditorState>) => {
    setEditor((s) => ({ ...s, ...patch }));
    setDirty(true);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setRelationshipMissing(false);
    const res = await fetch(
      `/api/relationships/sales-offers?relationshipId=${encodeURIComponent(relationshipId)}`,
    );
    const data = (await res.json()) as {
      ok?: boolean;
      offers?: OfferRow[];
      error?: string;
      code?: string;
    };
    if (res.status === 404 && data.code === "relationship_not_found") {
      setRelationshipMissing(true);
      setOffers([]);
      setError(data.error || "This relationship is no longer available.");
      return;
    }
    if (!res.ok || !data.ok) {
      setError(data.error || "Could not load offers.");
      return;
    }
    setOffers((data.offers || []).filter((o) => o.status !== "discarded"));
  }, [relationshipId]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  useEffect(() => {
    if (!dedicatedPage || !canManage || !initialOfferId) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `/api/relationships/sales-offers?relationshipId=${encodeURIComponent(relationshipId)}&offerId=${encodeURIComponent(initialOfferId)}&revisions=1`,
        );
        const data = (await res.json()) as {
          ok?: boolean;
          offer?: OfferRow;
          revisions?: RevisionRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.offer) {
          setError(data.error || "Could not open offer.");
          return;
        }
        setEditingId(data.offer.id);
        setExpectedRevision(data.offer.revision);
        setEditor(editorFromOffer(data.offer));
        setLivePreview(data.offer.preview);
        setRevisions(data.revisions || []);
        setDirty(false);
        setMode("edit");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dedicatedPage, canManage, initialOfferId, relationshipId]);

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
      code?: string;
    };
    if (res.status === 404 && data.code === "relationship_not_found") {
      setRelationshipMissing(true);
      setLivePreview(null);
      setError(data.error || "This relationship is no longer available.");
      return;
    }
    if (!res.ok || !data.ok || !data.preview) {
      setLivePreview(null);
      if (data.issues?.length) {
        setError(data.issues.map((i) => i.message).join(" "));
      }
      return;
    }
    setError(null);
    setLivePreview(data.preview);
  }

  useEffect(() => {
    if (mode !== "edit" || relationshipMissing) return;
    const t = setTimeout(() => {
      void refreshPreview();
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, mode, relationshipMissing]);

  const liveCalc = useMemo(() => {
    const list = listAmountCents(editor.planKey);
    let monthly = list;
    if (editor.pricingKind === "percent_off") {
      const pct = Number.parseInt(editor.percentOff, 10);
      if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
        monthly = Math.round(list * (1 - pct / 100));
      }
    } else if (editor.pricingKind === "amount_off") {
      const off = dollarsToCents(editor.amountOffDollars);
      if (off != null) monthly = Math.max(0, list - off);
    } else if (editor.pricingKind === "fixed_rate") {
      const rate = dollarsToCents(editor.fixedRateDollars);
      if (rate != null) monthly = rate;
    }
    return {
      list,
      monthly,
      savings: Math.max(0, list - monthly),
      planName: PLANS.find((p) => p.key === editor.planKey)?.name || "Gather",
    };
  }, [editor]);

  function openCreate() {
    if (relationshipMissing) return;
    setEditingId(null);
    setExpectedRevision(1);
    if (relationshipStandardDiscountEligibility) {
      const base = defaultEditor(planId, venueName, {});
      setEditor({
        ...base,
        standardDiscountEligibility: relationshipStandardDiscountEligibility,
        standardDiscountEvidence:
          relationshipStandardDiscountEligibility === "not_established"
            ? "not_established"
            : relationshipStandardDiscountEligibility === "none"
              ? "explicitly_none"
              : "founder_recorded",
      });
    } else {
      setEditor(
        defaultEditor(planId, venueName, {
          foundingMember: foundingHint,
          wevenHint,
        }),
      );
    }
    setRevisions([]);
    setMessage(null);
    setDirty(false);
    setMode("edit");
  }

  function setEligibility(next: SalesOfferStandardDiscountEligibility) {
    const prior = editor.standardDiscountEligibility;
    const priorEvidence = editor.standardDiscountEvidence;
    let evidence: SalesOfferStandardDiscountEvidence;
    if (next === "not_established") evidence = "not_established";
    else if (next === "none") evidence = "explicitly_none";
    else if (
      next === prior &&
      priorEvidence === "application_confirmed"
    ) {
      evidence = "application_confirmed";
    } else {
      evidence = "founder_recorded";
    }
    patchEditor({
      standardDiscountEligibility: next,
      standardDiscountEvidence: evidence,
    });
  }

  async function openOffer(offer: OfferRow) {
    if (relationshipMissing) return;
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
        code?: string;
      };
      if (res.status === 404 && data.code === "relationship_not_found") {
        setRelationshipMissing(true);
        setError(data.error || "This relationship is no longer available.");
        return;
      }
      if (!res.ok || !data.ok || !data.offer) {
        setError(data.error || "Could not open offer.");
        return;
      }
      setEditingId(data.offer.id);
      setExpectedRevision(data.offer.revision);
      setEditor(editorFromOffer(data.offer));
      setLivePreview(data.offer.preview);
      setRevisions(data.revisions || []);
      setDirty(false);
      setMode("edit");
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (relationshipMissing) return;
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
      if (res.status === 404 && data.code === "relationship_not_found") {
        setRelationshipMissing(true);
        setError(data.error || "This relationship is no longer available.");
        return;
      }
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
      setDirty(false);
      setMessage("Draft saved. No checkout link was created.");
      await load();
      const revRes = await fetch(
        `/api/relationships/sales-offers?relationshipId=${encodeURIComponent(relationshipId)}&offerId=${encodeURIComponent(data.offer.id)}&revisions=1`,
      );
      const revData = (await revRes.json()) as { revisions?: RevisionRow[] };
      setRevisions(revData.revisions || []);
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
        code?: string;
      };
      if (res.status === 404 && data.code === "relationship_not_found") {
        setRelationshipMissing(true);
        setError(data.error || "This relationship is no longer available.");
        return;
      }
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
        "Discard this unused draft? Prior revision history is retained.",
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
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };
      if (res.status === 404 && data.code === "relationship_not_found") {
        setRelationshipMissing(true);
        setError(data.error || "This relationship is no longer available.");
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error || "Discard failed");
        return;
      }
      setMode("list");
      setEditingId(null);
      setDirty(false);
      setMessage("Draft discarded.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  function backToList() {
    if (
      dirty &&
      !window.confirm("You have unsaved changes. Leave without saving?")
    ) {
      return;
    }
    if (dedicatedPage && returnHref) {
      window.location.href = returnHref;
      return;
    }
    setMode("list");
    setEditingId(null);
    setDirty(false);
  }

  if (!canManage) return null;

  if (relationshipMissing) {
    return (
      <Panel title="Custom offers">
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--htc-dusty)_35%,var(--htc-border))] bg-[color-mix(in_srgb,var(--htc-dusty)_8%,white)] p-5">
          <h3 className="font-heading text-lg text-[var(--htc-forest)]">
            This relationship is no longer available
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--htc-muted)]">
            {error ||
              "The Sales record for this offer may have been removed after a prior review. Custom offers cannot be edited against a missing relationship."}
          </p>
          <Link href="/sales" className="ws-btn ws-btn-primary mt-4 inline-flex">
            Back to Sales
          </Link>
        </div>
      </Panel>
    );
  }

  const isSpecial = editor.pricingKind !== "standard";
  const showAfterIntro =
    isSpecial && editor.durationPreset !== "ongoing";
  const showEligibilitySelector =
    (showAfterIntro && editor.afterIntroPricing === "eligible_discount") ||
    (isSpecial &&
      editor.pricingKind === "fixed_rate" &&
      editor.fixedUpgradePolicy === "replace" &&
      editor.fixedUpgradeFallback === "eligible_discount" &&
      editor.showTierUpgrade);
  const eligibilityProjection = projectEligibleDiscount(
    editor.planKey,
    editor.standardDiscountEligibility,
  );

  return (
    <Panel
      title={dedicatedPage ? "Custom offer builder" : "Custom offers"}
      action={
        dedicatedPage || mode === "edit" ? (
          <button
            type="button"
            className="ws-btn"
            onClick={backToList}
            data-testid="back-to-relationship"
          >
            {returnHref ? "Back to Relationship" : "Back to Offers"}
          </button>
        ) : (
          <button
            type="button"
            className="ws-btn ws-btn-primary"
            onClick={openCreate}
            data-testid="create-custom-offer"
          >
            Create Custom Offer
          </button>
        )
      }
    >
      <p className="mb-4 text-sm text-[var(--htc-muted)]">
        Build a special subscription proposal for{" "}
        <span className="text-[var(--htc-text)]">{venueName}</span>
        {ownerName || ownerEmail ? <> · {ownerName || ownerEmail}</> : null}.
        Drafts do not create checkout links or activate subscriptions.
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

      {mode === "list" && !dedicatedPage ? (
        <div className="space-y-3" data-testid="sales-offers-list">
          {offers.length === 0 ? (
            <p className="text-sm text-[var(--htc-muted)]">
              No custom offers yet. Create a draft to negotiate pricing before
              the venue subscribes — separate from Send Subscription Link.
            </p>
          ) : (
            offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--htc-border)_70%,transparent)] pb-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--htc-text)]">
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

      {mode === "edit" ? (
        <div
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
          data-testid="sales-offer-editor"
        >
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--htc-text)]">
                Internal offer name
              </span>
              <input
                className="ws-input w-full"
                value={editor.internalName}
                onChange={(e) => patchEditor({ internalName: e.target.value })}
              />
            </label>

            {/* 1. Subscription & Price */}
            <Section
              title="Subscription & Price"
              copy="Choose the subscription plan and the special monthly price you'd like to offer."
            >
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--htc-text)]">
                  Plan
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PLANS.map((p) => (
                    <ChoiceCard
                      key={p.key}
                      selected={editor.planKey === p.key}
                      title={`${p.name} — ${p.price}`}
                      detail={p.range}
                      onClick={() => patchEditor({ planKey: p.key })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-[var(--htc-text)]">
                  How would you like to price this offer?
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceCard
                    selected={editor.pricingKind === "standard"}
                    title="Regular subscription price"
                    onClick={() => patchEditor({ pricingKind: "standard" })}
                  />
                  <ChoiceCard
                    selected={editor.pricingKind === "percent_off"}
                    title="Percentage off"
                    onClick={() =>
                      patchEditor({
                        pricingKind: "percent_off",
                        showTierUpgrade: true,
                      })
                    }
                  />
                  <ChoiceCard
                    selected={editor.pricingKind === "amount_off"}
                    title="Dollar amount off each month"
                    onClick={() =>
                      patchEditor({
                        pricingKind: "amount_off",
                        showTierUpgrade: true,
                      })
                    }
                  />
                  <ChoiceCard
                    selected={editor.pricingKind === "fixed_rate"}
                    title="Set a specific monthly price"
                    onClick={() =>
                      patchEditor({
                        pricingKind: "fixed_rate",
                        showTierUpgrade: true,
                      })
                    }
                  />
                </div>
              </div>

              {editor.pricingKind === "percent_off" ? (
                <label className="block text-sm" data-testid="percent-config">
                  <span className="mb-1 block font-medium">Percent off</span>
                  <div className="flex max-w-[160px] items-center gap-2">
                    <input
                      className="ws-input w-full"
                      value={editor.percentOff}
                      onChange={(e) =>
                        patchEditor({ percentOff: e.target.value })
                      }
                    />
                    <span className="text-[var(--htc-muted)]">%</span>
                  </div>
                </label>
              ) : null}

              {editor.pricingKind === "amount_off" ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    Dollar amount off each month
                  </span>
                  <div className="flex max-w-[180px] items-center gap-2">
                    <span className="text-[var(--htc-muted)]">$</span>
                    <input
                      className="ws-input w-full"
                      value={editor.amountOffDollars}
                      onChange={(e) =>
                        patchEditor({ amountOffDollars: e.target.value })
                      }
                    />
                  </div>
                </label>
              ) : null}

              {editor.pricingKind === "fixed_rate" ? (
                <label className="block text-sm" data-testid="fixed-rate-config">
                  <span className="mb-1 block font-medium">
                    Specific monthly price
                  </span>
                  <div className="flex max-w-[180px] items-center gap-2">
                    <span className="text-[var(--htc-muted)]">$</span>
                    <input
                      className="ws-input w-full"
                      value={editor.fixedRateDollars}
                      onChange={(e) =>
                        patchEditor({ fixedRateDollars: e.target.value })
                      }
                    />
                  </div>
                </label>
              ) : null}

              <div
                className="rounded-md bg-[color-mix(in_srgb,var(--htc-soft-sage)_55%,white)] px-4 py-3"
                data-testid="live-price-calc"
              >
                <p className="text-sm text-[var(--htc-muted)]">
                  Regular {liveCalc.planName} price:{" "}
                  {formatUsdFromCents(liveCalc.list)}/month
                </p>
                <p className="mt-1 text-lg font-medium text-[var(--htc-forest)]">
                  Your offer:{" "}
                  <strong>{formatUsdFromCents(liveCalc.monthly)}/month</strong>
                </p>
                {liveCalc.savings > 0 ? (
                  <p className="mt-1 text-sm text-[var(--htc-text)]">
                    Customer saves:{" "}
                    <strong>
                      {formatUsdFromCents(liveCalc.savings)}/month
                    </strong>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[var(--htc-muted)]">
                    Same as the regular subscription price.
                  </p>
                )}
              </div>
            </Section>

            {/* 2. Special Offer Terms */}
            <Section
              title="Special Offer Terms"
              copy="Decide how long the special price lasts and how long the customer has to accept your offer."
            >
              {isSpecial ? (
                <>
                  <div>
                    <p className="mb-2 text-sm font-medium">
                      How long should this special price last?
                    </p>
                    <p className="mb-2 text-xs text-[var(--htc-muted)]">
                      Limited-duration pricing begins when the customer
                      subscribes (billing cycles), not when you create this
                      draft.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          ["ongoing", "Ongoing"],
                          ["3", "3 months"],
                          ["6", "6 months"],
                          ["12", "12 months"],
                          ["custom", "Custom number of months"],
                        ] as const
                      ).map(([value, label]) => (
                        <ChoiceCard
                          key={value}
                          selected={editor.durationPreset === value}
                          title={label}
                          onClick={() =>
                            patchEditor({
                              durationPreset: value,
                              durationBillingCycles:
                                value === "custom"
                                  ? editor.durationBillingCycles
                                  : value === "ongoing"
                                    ? editor.durationBillingCycles
                                    : value,
                            })
                          }
                        />
                      ))}
                    </div>
                    {editor.durationPreset === "custom" ? (
                      <label className="mt-3 block max-w-[180px] text-sm">
                        <span className="mb-1 block font-medium">Months</span>
                        <input
                          className="ws-input w-full"
                          value={editor.durationBillingCycles}
                          onChange={(e) =>
                            patchEditor({
                              durationBillingCycles: e.target.value,
                            })
                          }
                        />
                      </label>
                    ) : null}
                  </div>

                  {showAfterIntro ? (
                    <div data-testid="after-intro-choices">
                      <p className="mb-2 text-sm font-medium">
                        When the special pricing ends, what should the customer
                        pay?
                      </p>
                      <div className="grid gap-2">
                        <ChoiceCard
                          selected={editor.afterIntroPricing === "standard_list"}
                          title="Regular subscription price"
                          detail={`Estimate at today’s prices: ${formatUsdFromCents(listAmountCents(editor.planKey))}/month.`}
                          onClick={() =>
                            patchEditor({ afterIntroPricing: "standard_list" })
                          }
                        />
                        <ChoiceCard
                          selected={
                            editor.afterIntroPricing === "eligible_discount"
                          }
                          title="Their eligible discounted price"
                          detail="Apply their qualifying standard discount after the promo ends."
                          onClick={() =>
                            patchEditor({
                              afterIntroPricing: "eligible_discount",
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {showEligibilitySelector ? (
                    <div
                      className="max-w-md"
                      data-testid="standard-discount-eligibility"
                    >
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">
                          Existing Customer Discounts
                        </span>
                        <span className="mb-1.5 block text-xs text-[var(--htc-muted)]">
                          Does this prospect qualify for one of our standard
                          discounts?
                        </span>
                        <select
                          className="ws-input w-full"
                          value={editor.standardDiscountEligibility}
                          onChange={(e) =>
                            setEligibility(
                              e.target
                                .value as SalesOfferStandardDiscountEligibility,
                            )
                          }
                        >
                          {ELIGIBILITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-2 text-xs text-[var(--htc-muted)]">
                        {eligibilityProjection.amountCents != null
                          ? `${eligibilityProjection.conditional ? "Conditional estimate" : "Estimate"} at today’s prices: ${formatUsdFromCents(eligibilityProjection.amountCents)}/month.`
                          : eligibilityProjection.explanation}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <button
                      type="button"
                      className="text-sm font-medium text-[var(--htc-primary)] underline-offset-2 hover:underline"
                      onClick={() =>
                        patchEditor({
                          showTierUpgrade: !editor.showTierUpgrade,
                        })
                      }
                    >
                      {editor.showTierUpgrade ? "Hide" : "Show"}: What happens
                      if this venue moves to a higher plan?
                    </button>
                    {editor.showTierUpgrade ? (
                      <div className="mt-3 space-y-3 rounded-md border border-[var(--htc-border)] bg-[var(--htc-linen)]/40 p-4">
                        {editor.pricingKind === "percent_off" ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <ChoiceCard
                              selected={editor.percentUpgradePolicy === "follow"}
                              title="Same % follows into the new tier"
                              detail="Default. Example: 15% off Celebrate becomes 15% off Flourish list."
                              onClick={() =>
                                patchEditor({ percentUpgradePolicy: "follow" })
                              }
                            />
                            <ChoiceCard
                              selected={editor.percentUpgradePolicy === "end"}
                              title="End the discount on upgrade"
                              onClick={() =>
                                patchEditor({ percentUpgradePolicy: "end" })
                              }
                            />
                          </div>
                        ) : null}
                        {editor.pricingKind === "amount_off" ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <ChoiceCard
                              selected={editor.amountUpgradePolicy === "follow"}
                              title="Same $ off continues on the new list"
                              onClick={() =>
                                patchEditor({ amountUpgradePolicy: "follow" })
                              }
                            />
                            <ChoiceCard
                              selected={editor.amountUpgradePolicy === "end"}
                              title="End the discount on upgrade"
                              onClick={() =>
                                patchEditor({ amountUpgradePolicy: "end" })
                              }
                            />
                          </div>
                        ) : null}
                        {editor.pricingKind === "fixed_rate" ? (
                          <div className="space-y-3">
                            <div className="grid gap-2">
                              <ChoiceCard
                                selected={editor.fixedUpgradePolicy === "keep"}
                                title="Keep negotiated price"
                                detail="The same monthly amount continues after an upgrade."
                                onClick={() =>
                                  patchEditor({ fixedUpgradePolicy: "keep" })
                                }
                              />
                              <ChoiceCard
                                selected={editor.fixedUpgradePolicy === "end"}
                                title="End negotiated price on upgrade"
                                onClick={() =>
                                  patchEditor({ fixedUpgradePolicy: "end" })
                                }
                              />
                              <ChoiceCard
                                selected={
                                  editor.fixedUpgradePolicy === "replace"
                                }
                                title="Use an agreed replacement price"
                                onClick={() =>
                                  patchEditor({
                                    fixedUpgradePolicy: "replace",
                                  })
                                }
                              />
                            </div>
                            {editor.fixedUpgradePolicy === "replace" ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {editor.planKey === "starter" ? (
                                  <label className="block text-sm">
                                    <span className="mb-1 block font-medium">
                                      Celebrate replacement ($)
                                    </span>
                                    <input
                                      className="ws-input w-full"
                                      value={editor.replaceGrowingDollars}
                                      onChange={(e) =>
                                        patchEditor({
                                          replaceGrowingDollars: e.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                ) : null}
                                {editor.planKey !== "professional" ? (
                                  <label className="block text-sm">
                                    <span className="mb-1 block font-medium">
                                      Flourish replacement ($)
                                    </span>
                                    <input
                                      className="ws-input w-full"
                                      value={editor.replaceFlourishDollars}
                                      onChange={(e) =>
                                        patchEditor({
                                          replaceFlourishDollars:
                                            e.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                ) : null}
                                <label className="block text-sm sm:col-span-2">
                                  <span className="mb-1 block font-medium">
                                    If a path has no agreed price
                                  </span>
                                  <select
                                    className="ws-input w-full"
                                    value={editor.fixedUpgradeFallback}
                                    onChange={(e) =>
                                      patchEditor({
                                        fixedUpgradeFallback: e.target
                                          .value as EditorState["fixedUpgradeFallback"],
                                      })
                                    }
                                  >
                                    <option value="standard_list">
                                      Regular subscription price
                                    </option>
                                    <option value="eligible_discount">
                                      Eligible discounted price
                                    </option>
                                  </select>
                                </label>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--htc-muted)]">
                  You selected the regular subscription price, so there is no
                  temporary special pricing period. You can still set how long
                  the customer has to accept this offer below.
                </p>
              )}

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Offer valid until</span>
                <input
                  type="date"
                  className="ws-input max-w-[220px]"
                  value={editor.expiresAt}
                  onChange={(e) => patchEditor({ expiresAt: e.target.value })}
                />
                <span className="mt-1 block text-xs text-[var(--htc-muted)]">
                  The customer must accept this offer by this date. This does
                  not control how long special subscription pricing lasts after
                  they subscribe.
                </span>
              </label>
            </Section>

            {/* 3. White Glove */}
            <Section
              title="White Glove Onboarding"
              copy="Choose whether to include personalized onboarding and what to charge."
            >
              <div
                className="grid gap-2 sm:grid-cols-2"
                data-testid="white-glove-config"
              >
                <ChoiceCard
                  selected={editor.whiteGloveMode === "none"}
                  title="Not included"
                  onClick={() => patchEditor({ whiteGloveMode: "none" })}
                />
                <ChoiceCard
                  selected={editor.whiteGloveMode === "standard_499"}
                  title="Standard onboarding — $499"
                  onClick={() =>
                    patchEditor({ whiteGloveMode: "standard_499" })
                  }
                />
                <ChoiceCard
                  selected={editor.whiteGloveMode === "weven_399"}
                  title="Former Weven onboarding — $399"
                  onClick={() => patchEditor({ whiteGloveMode: "weven_399" })}
                />
                <ChoiceCard
                  selected={editor.whiteGloveMode === "custom"}
                  title="Custom price"
                  onClick={() => patchEditor({ whiteGloveMode: "custom" })}
                />
                <ChoiceCard
                  selected={editor.whiteGloveMode === "waived"}
                  title="Complimentary — $0"
                  onClick={() => patchEditor({ whiteGloveMode: "waived" })}
                />
              </div>
              {editor.whiteGloveMode === "custom" ? (
                <label className="block max-w-[200px] text-sm">
                  <span className="mb-1 block font-medium">
                    Custom White Glove amount ($)
                  </span>
                  <input
                    className="ws-input w-full"
                    value={editor.whiteGloveCustomDollars}
                    onChange={(e) =>
                      patchEditor({ whiteGloveCustomDollars: e.target.value })
                    }
                  />
                </label>
              ) : null}
              {editor.whiteGloveMode === "waived" ? (
                <p className="text-sm text-[var(--htc-forest)]">
                  White Glove onboarding will be included at no charge.
                </p>
              ) : null}
              <p className="text-xs text-[var(--htc-muted)]">
                One-time White Glove charges stay separate from the monthly
                subscription price.
              </p>
            </Section>

            {/* 4. Review */}
            <Section
              title="Review Your Offer"
              copy="Review exactly what you're proposing before saving."
              className="border-[color-mix(in_srgb,var(--htc-primary)_25%,var(--htc-border))] bg-[color-mix(in_srgb,var(--htc-soft-sage)_35%,white)]"
            >
              <div
                className="rounded-lg border border-[color-mix(in_srgb,var(--htc-forest)_18%,transparent)] bg-white p-5"
                data-testid="offer-preview"
              >
                {livePreview ? (
                  <div className="space-y-3 text-sm leading-relaxed text-[var(--htc-text)]">
                    <p className="ws-eyebrow">Your Special Offer</p>
                    <h4 className="font-heading text-2xl text-[var(--htc-forest)]">
                      {livePreview.planDisplayName}
                    </h4>
                    <p className="text-3xl font-medium tracking-tight text-[var(--htc-forest)]">
                      {formatUsdFromCents(livePreview.monthlyRecurringCents)}
                      /month
                    </p>
                    <p>
                      Regularly{" "}
                      {formatUsdFromCents(livePreview.listAmountCents)}
                      /month
                      {livePreview.monthlySavingsCents > 0
                        ? ` — Save ${formatUsdFromCents(livePreview.monthlySavingsCents)}/month`
                        : ""}
                    </p>
                    <p>{livePreview.durationLabel}.</p>
                    {isSpecial && editor.durationPreset !== "ongoing" ? (
                      <p>{livePreview.afterIntroLabel}</p>
                    ) : null}
                    {isSpecial ? <p>{livePreview.tierUpgradeLabel}</p> : null}
                    <p>
                      White Glove onboarding:{" "}
                      {editor.whiteGloveMode === "none"
                        ? "Not included"
                        : editor.whiteGloveMode === "waived"
                          ? "Included complimentary ($0)"
                          : `${formatUsdFromCents(livePreview.whiteGloveAmountCents)} one-time`}
                      .
                    </p>
                    <div className="border-t border-[var(--htc-border)] pt-3">
                      <p>
                        <strong>Estimated initial payment</strong> (before
                        applicable taxes):{" "}
                        {formatUsdFromCents(livePreview.initialPaymentCents)}
                      </p>
                      <p className="mt-1">
                        <strong>Then</strong>{" "}
                        {formatUsdFromCents(livePreview.futureMonthlyCents)}
                        /month during special pricing.
                      </p>
                      <p className="mt-1">
                        Offer valid until:{" "}
                        {livePreview.expiresAt
                          ? formatWhen(livePreview.expiresAt)
                          : "No acceptance deadline set"}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--htc-muted)]">
                      {livePreview.promoNote}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--htc-muted)]">
                    Adjust the offer to generate a validated preview.
                  </p>
                )}
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Internal notes (never customer-visible)
                </span>
                <textarea
                  className="ws-input min-h-[72px] w-full"
                  value={editor.internalNotes}
                  onChange={(e) =>
                    patchEditor({ internalNotes: e.target.value })
                  }
                />
              </label>

              {revisions.length > 0 ? (
                <div data-testid="offer-revision-history">
                  <h4 className="mb-2 text-sm font-medium">Revision history</h4>
                  <ul className="space-y-1.5 text-xs text-[var(--htc-muted)]">
                    {revisions.map((r) => (
                      <li key={r.id}>
                        Rev {r.revision} · {formatWhen(r.createdAt)}
                        {r.changedByEmail ? ` · ${r.changedByEmail}` : ""}
                        {r.changeSummary ? ` — ${r.changeSummary}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="ws-btn ws-btn-primary"
                  disabled={busy}
                  onClick={() => void saveDraft()}
                  data-testid="save-offer-draft"
                >
                  {busy ? "Saving…" : "Save Draft"}
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  disabled={busy}
                  onClick={() => {
                    document
                      .querySelector("[data-testid='offer-preview']")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  Preview Offer
                </button>
                {editingId ? (
                  <>
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={busy}
                      onClick={() => void duplicateOffer(editingId)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={busy}
                      onClick={() => void discardCurrent()}
                    >
                      Discard Draft
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="ws-btn"
                  disabled={busy}
                  onClick={backToList}
                >
                  Back to Offers
                </button>
              </div>
              <p className="text-xs text-[var(--htc-muted)]">
                Sending to the customer is coming in a later stage. Standard
                Send Subscription Link remains available above for ordinary
                checkout.
              </p>
            </Section>
          </div>

          {/* Sticky summary */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-lg border border-[var(--htc-border)] bg-[var(--htc-warm-white)] p-4 shadow-[0_1px_0_rgba(41,45,41,0.04)]">
              <p className="ws-eyebrow">Live summary</p>
              <p className="mt-2 font-heading text-xl text-[var(--htc-forest)]">
                {liveCalc.planName}
              </p>
              <p className="mt-1 text-2xl font-medium text-[var(--htc-forest)]">
                {formatUsdFromCents(liveCalc.monthly)}
                <span className="text-base font-normal text-[var(--htc-muted)]">
                  /mo
                </span>
              </p>
              {liveCalc.savings > 0 ? (
                <p className="mt-1 text-sm text-[var(--htc-text)]">
                  Saves {formatUsdFromCents(liveCalc.savings)}/mo vs regular
                </p>
              ) : null}
              <dl className="mt-4 space-y-2 text-xs text-[var(--htc-muted)]">
                <div className="flex justify-between gap-2">
                  <dt>Duration</dt>
                  <dd className="text-right text-[var(--htc-text)]">
                    {!isSpecial
                      ? "Regular price"
                      : editor.durationPreset === "ongoing"
                        ? "Ongoing"
                        : editor.durationPreset === "custom"
                          ? `${editor.durationBillingCycles} months`
                          : `${editor.durationPreset} months`}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>White Glove</dt>
                  <dd className="text-right text-[var(--htc-text)]">
                    {livePreview
                      ? formatUsdFromCents(livePreview.whiteGloveAmountCents)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Valid until</dt>
                  <dd className="text-right text-[var(--htc-text)]">
                    {editor.expiresAt || "Not set"}
                  </dd>
                </div>
              </dl>
              {dirty ? (
                <p className="mt-3 text-xs text-[var(--htc-dusty)]">
                  Unsaved changes
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </Panel>
  );
}
