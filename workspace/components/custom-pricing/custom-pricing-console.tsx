"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Panel, StatusPill } from "@/components/shared/ui";

type VenueOption = {
  id: string;
  name: string | null;
  planKey: string | null;
  subscriptionId: string | null;
  status: string | null;
};

type ArrangementRow = {
  id: string;
  kind: string;
  status: string;
  percentOff: number | null;
  amountOffCents: number | null;
  fixedRateCents: number | null;
  frozenListAmountCents: number | null;
  planScope: string;
  survivesTierChange: boolean;
  preventsTierUpgrade: boolean;
  protectsBaseRate: boolean;
  effectiveAt: string;
  expiresAt: string | null;
  durationBillingCycles: number | null;
  reason: string;
  internalNotes: string | null;
  customerFacingLabel: string | null;
  reconciliationStatus: string;
  expectedRecurringAmount: string | null;
  lastReconcileError: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

type VenuePayload = {
  ok: boolean;
  readiness?: { ready: boolean; diagnosticMessage: string; mode: string };
  venue?: {
    id: string;
    name: string;
    planName: string;
    listAmount: string;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
  };
  grants?: Array<{ offerType: string; percentOff: number | null }>;
  groupEligible?: boolean;
  holdActive?: boolean;
  pendingTierUpgrade?: {
    status: string;
    requiredPlan: string;
    effectiveAt: string | null;
  } | null;
  appliedOffer?: { source: string; label: string; amount: string };
  nextInvoicePreview?: string | null;
  nextInvoicePreviewSource?: string | null;
  arrangements?: ArrangementRow[];
  venues?: VenueOption[];
  error?: string;
};

type PreviewPayload = {
  ok: boolean;
  preview?: {
    currentAmount: string;
    proposedAmount: string;
    difference: string;
    differenceSign: number;
    producesFinancialBenefit: boolean;
    ineffectiveBecauseBetterOffer: boolean;
    requiresConfirmation: boolean;
    explanation: string;
    proposedWinnerSource: string;
    calculationSource: string;
    note: string;
  };
  error?: string;
};

const KINDS = [
  { value: "percent_off", label: "Percentage discount" },
  { value: "amount_off", label: "Fixed-dollar discount" },
  { value: "fixed_rate", label: "Fixed recurring rate" },
  { value: "rate_freeze", label: "Rate freeze" },
  { value: "tier_freeze", label: "Tier freeze" },
] as const;

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString("en-US", { timeZone: "UTC" });
}

export function CustomPricingConsole() {
  const [list, setList] = useState<VenueOption[]>([]);
  const [venueId, setVenueId] = useState<string>("");
  const [data, setData] = useState<VenuePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload["preview"] | null>(null);

  const [kind, setKind] = useState<string>("percent_off");
  const [percentOff, setPercentOff] = useState("15");
  const [amountOff, setAmountOff] = useState("40");
  const [fixedRate, setFixedRate] = useState("149");
  const [effectiveAt, setEffectiveAt] = useState(
    () => new Date().toISOString().slice(0, 16),
  );
  const [expiresAt, setExpiresAt] = useState("");
  const [durationCycles, setDurationCycles] = useState("");
  const [planScope, setPlanScope] = useState("all");
  const [survivesTierChange, setSurvivesTierChange] = useState(true);
  const [reason, setReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerLabel, setCustomerLabel] = useState("Special pricing");
  const [confirmLarge, setConfirmLarge] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/relationships/custom-pricing");
    const json = (await res.json()) as VenuePayload;
    if (!res.ok) {
      setError(json.error || "Unable to load venues.");
      return;
    }
    setList(json.venues ?? []);
    setError(null);
  }, []);

  const loadVenue = useCallback(async (id: string) => {
    if (!id) {
      setData(null);
      return;
    }
    const res = await fetch(
      `/api/relationships/custom-pricing?venueId=${encodeURIComponent(id)}`,
    );
    const json = (await res.json()) as VenuePayload;
    if (!res.ok) {
      setError(json.error || "Unable to load venue pricing.");
      setData(null);
      return;
    }
    setData(json);
    setError(null);
    setPreview(null);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (venueId) void loadVenue(venueId);
  }, [venueId, loadVenue]);

  const activeArrangements = useMemo(
    () =>
      (data?.arrangements ?? []).filter((a) =>
        ["active", "scheduled", "failed"].includes(a.status),
      ),
    [data],
  );

  function draftBody(action: string) {
    const effectiveIso = new Date(effectiveAt).toISOString();
    const expiresIso = expiresAt ? new Date(expiresAt).toISOString() : null;
    return {
      action,
      venueId,
      kind,
      percentOff: kind === "percent_off" ? Number(percentOff) : null,
      amountOffCents:
        kind === "amount_off" ? Math.round(Number(amountOff) * 100) : null,
      fixedRateCents:
        kind === "fixed_rate" ? Math.round(Number(fixedRate) * 100) : null,
      frozenListAmountCents: kind === "rate_freeze" ? null : null,
      planScope,
      survivesTierChange,
      preventsTierUpgrade: kind === "tier_freeze",
      protectsBaseRate: kind === "rate_freeze",
      effectiveAt: effectiveIso,
      expiresAt: expiresIso,
      durationBillingCycles: durationCycles
        ? Number(durationCycles)
        : null,
      reason: reason.trim(),
      internalNotes: internalNotes.trim() || null,
      customerFacingLabel: customerLabel.trim() || null,
      confirmLargeDiscount: confirmLarge,
      idempotencyKey: `crm-${venueId}-${kind}-${effectiveIso}-${Date.now()}`,
    };
  }

  async function runPreview() {
    if (!venueId || !reason.trim()) {
      setMessage("Select a venue and enter an internal reason before preview.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/custom-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftBody("preview")),
      });
      const json = (await res.json()) as PreviewPayload;
      if (!res.ok) throw new Error(json.error || "Preview failed");
      setPreview(json.preview ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runCreate() {
    if (!venueId || !reason.trim()) {
      setMessage("Venue and internal reason are required.");
      return;
    }
    if (preview?.requiresConfirmation && !confirmLarge) {
      setMessage(
        "This is a large discount or zero-dollar rate — check the confirmation box.",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/custom-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftBody("create")),
      });
      const json = (await res.json()) as {
        error?: string;
        warning?: string | null;
        stripeApplied?: boolean;
        deferredToSchedule?: boolean;
        arrangement?: { id: string; status: string };
      };
      if (!res.ok) throw new Error(json.error || "Create failed");
      setMessage(
        [
          `Saved ${json.arrangement?.id ?? "arrangement"} (${json.arrangement?.status}).`,
          json.stripeApplied ? "Stripe reconciled." : "Stripe not yet applied.",
          json.deferredToSchedule ? "Deferred to Phase 3 schedule." : "",
          json.warning || "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      setReason("");
      setConfirmLarge(false);
      await loadVenue(venueId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function endArrangement(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/custom-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          venueId,
          arrangementId: id,
          endReason: "Ended prospectively via Founder CRM",
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "End failed");
      setMessage(`Arrangement ${id} ended prospectively.`);
      await loadVenue(venueId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "End failed");
    } finally {
      setBusy(false);
    }
  }

  async function retryReconcile() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/custom-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", venueId }),
      });
      const json = (await res.json()) as {
        error?: string;
        applied?: boolean;
        deferred?: boolean;
        winnerLabel?: string;
      };
      if (!res.ok) throw new Error(json.error || "Retry failed");
      setMessage(
        `Reconcile: applied=${Boolean(json.applied)} deferred=${Boolean(json.deferred)} winner=${json.winnerLabel ?? "—"}`,
      );
      await loadVenue(venueId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data && list.length === 0) {
    return (
      <Panel title="Custom pricing">
        <p className="text-sm text-[var(--deep-terracotta)]">{error}</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-sm border border-[var(--taupe-medium)] bg-[var(--warm-gray)] px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <Panel title="Venue subscription">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="ws-muted">Venue</span>
            <select
              className="mt-1 block min-w-[280px] rounded-sm border border-[var(--taupe-medium)] bg-white px-2 py-1.5"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            >
              <option value="">Select a subscribed venue…</option>
              {list.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name || v.id} · {v.planKey || "—"} · {v.status || "—"}
                </option>
              ))}
            </select>
          </label>
          {venueId ? (
            <button
              type="button"
              className="rounded-sm border border-[var(--taupe-medium)] px-3 py-1.5 text-sm"
              disabled={busy}
              onClick={() => void retryReconcile()}
            >
              Retry Stripe reconcile
            </button>
          ) : null}
        </div>

        {data?.readiness && !data.readiness.ready ? (
          <p className="mt-3 text-sm text-[var(--deep-terracotta)]">
            {data.readiness.diagnosticMessage}
          </p>
        ) : null}

        {data?.venue ? (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="ws-muted">Organization venue</dt>
              <dd className="font-medium">{data.venue.name}</dd>
            </div>
            <div>
              <dt className="ws-muted">Current tier</dt>
              <dd className="font-medium">{data.venue.planName}</dd>
            </div>
            <div>
              <dt className="ws-muted">Catalog price</dt>
              <dd className="font-medium">{data.venue.listAmount}/mo</dd>
            </div>
            <div>
              <dt className="ws-muted">Applied offer</dt>
              <dd className="font-medium">
                {data.appliedOffer?.label} · {data.appliedOffer?.amount}/mo
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Eligibility</dt>
              <dd className="font-medium">
                {(data.grants ?? [])
                  .map((g) => `${g.offerType} ${g.percentOff ?? ""}%`)
                  .join(", ") || "None"}
                {data.groupEligible ? " · Group eligible" : ""}
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Next renewal</dt>
              <dd className="font-medium">
                {formatUtc(data.venue.currentPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Next invoice preview</dt>
              <dd className="font-medium">
                {data.nextInvoicePreview
                  ? `${data.nextInvoicePreview} (${data.nextInvoicePreviewSource})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Pending tier upgrade</dt>
              <dd className="font-medium">
                {data.pendingTierUpgrade
                  ? `${data.pendingTierUpgrade.requiredPlan} · ${data.pendingTierUpgrade.status}`
                  : "None"}
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Founder hold</dt>
              <dd className="font-medium">{data.holdActive ? "Yes" : "No"}</dd>
            </div>
          </dl>
        ) : null}
      </Panel>

      <Panel title="Create custom arrangement">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <label>
            <span className="ws-muted">Type</span>
            <select
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] bg-white px-2 py-1.5"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {kind === "percent_off" ? (
            <label>
              <span className="ws-muted">Percent off</span>
              <input
                className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
              />
            </label>
          ) : null}
          {kind === "amount_off" ? (
            <label>
              <span className="ws-muted">Dollars off / month</span>
              <input
                className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
                value={amountOff}
                onChange={(e) => setAmountOff(e.target.value)}
              />
            </label>
          ) : null}
          {kind === "fixed_rate" ? (
            <label>
              <span className="ws-muted">Fixed monthly rate ($)</span>
              <input
                className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
                value={fixedRate}
                onChange={(e) => setFixedRate(e.target.value)}
              />
            </label>
          ) : null}
          <label>
            <span className="ws-muted">Effective (local → UTC)</span>
            <input
              type="datetime-local"
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
            />
          </label>
          <label>
            <span className="ws-muted">Expires (optional)</span>
            <input
              type="datetime-local"
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <label>
            <span className="ws-muted">Billing cycles (optional)</span>
            <input
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
              placeholder="e.g. 3 paid invoices"
              value={durationCycles}
              onChange={(e) => setDurationCycles(e.target.value)}
            />
          </label>
          <label>
            <span className="ws-muted">Tier scope</span>
            <select
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] bg-white px-2 py-1.5"
              value={planScope}
              onChange={(e) => setPlanScope(e.target.value)}
            >
              <option value="all">All tiers</option>
              <option value="current">Current tier only</option>
              <option value="starter">Gather only</option>
              <option value="growing">Celebrate only</option>
              <option value="professional">Flourish only</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={survivesTierChange}
              onChange={(e) => setSurvivesTierChange(e.target.checked)}
            />
            Survives tier changes
          </label>
          <label className="sm:col-span-2">
            <span className="ws-muted">Internal reason (required)</span>
            <input
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="ws-muted">Internal notes</span>
            <input
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
            />
          </label>
          <label>
            <span className="ws-muted">Customer-facing label</span>
            <input
              className="mt-1 block w-full rounded-sm border border-[var(--taupe-medium)] px-2 py-1.5"
              value={customerLabel}
              onChange={(e) => setCustomerLabel(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={confirmLarge}
              onChange={(e) => setConfirmLarge(e.target.checked)}
            />
            Confirm large / zero-dollar discount
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-sm border border-[var(--taupe-medium)] px-3 py-1.5 text-sm"
            disabled={busy || !venueId}
            onClick={() => void runPreview()}
          >
            Preview impact
          </button>
          <button
            type="button"
            className="rounded-sm bg-[var(--heritage-sage)] px-3 py-1.5 text-sm text-white"
            disabled={busy || !venueId}
            onClick={() => void runCreate()}
          >
            Confirm and save
          </button>
        </div>

        {preview ? (
          <div className="mt-4 rounded-sm border border-[var(--taupe-medium)] bg-[var(--warm-gray)] p-3 text-sm space-y-1">
            <p>
              Current {preview.currentAmount}/mo → proposed{" "}
              {preview.proposedAmount}/mo (Δ {preview.difference})
            </p>
            <p>{preview.explanation}</p>
            <p className="ws-muted">{preview.note}</p>
            {preview.ineffectiveBecauseBetterOffer ? (
              <p className="text-[var(--deep-terracotta)]">
                An existing offer remains financially better — saving will not
                change the customer bill unless this arrangement wins later.
              </p>
            ) : null}
            {preview.requiresConfirmation ? (
              <p className="text-[var(--deep-terracotta)]">
                Large discount confirmation required before save.
              </p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title="Arrangements">
        {activeArrangements.length === 0 ? (
          <p className="ws-muted text-sm">No active or scheduled arrangements.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--taupe-medium)]">
                  <th className="py-2 pr-2">Kind</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Terms</th>
                  <th className="py-2 pr-2">Window</th>
                  <th className="py-2 pr-2">Reconcile</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeArrangements.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--taupe-medium)]/50"
                  >
                    <td className="py-2 pr-2">{a.kind}</td>
                    <td className="py-2 pr-2">
                      <StatusPill
                        tone={
                          a.status === "active"
                            ? "good"
                            : a.status === "failed"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {a.status}
                      </StatusPill>
                    </td>
                    <td className="py-2 pr-2">
                      {a.percentOff != null ? `${a.percentOff}%` : null}
                      {a.amountOffCents != null
                        ? `$${(a.amountOffCents / 100).toFixed(0)} off`
                        : null}
                      {a.fixedRateCents != null
                        ? `$${(a.fixedRateCents / 100).toFixed(2)} fixed`
                        : null}
                      {a.kind === "tier_freeze" ? "Hold upgrades" : null}
                      {a.kind === "rate_freeze" ? "Freeze base" : null}
                      <div className="ws-muted text-xs">{a.reason}</div>
                    </td>
                    <td className="py-2 pr-2">
                      {formatUtc(a.effectiveAt)}
                      {a.expiresAt ? ` → ${formatUtc(a.expiresAt)}` : " → indefinite"}
                    </td>
                    <td className="py-2 pr-2">
                      {a.reconciliationStatus}
                      {a.expectedRecurringAmount
                        ? ` · ${a.expectedRecurringAmount}`
                        : ""}
                      {a.lastReconcileError ? (
                        <div className="text-[var(--deep-terracotta)] text-xs">
                          {a.lastReconcileError}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {["active", "scheduled"].includes(a.status) ? (
                        <button
                          type="button"
                          className="text-sm underline"
                          disabled={busy}
                          onClick={() => void endArrangement(a.id)}
                        >
                          End prospectively
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(data?.arrangements ?? []).filter((a) =>
          ["ended", "expired", "superseded"].includes(a.status),
        ).length > 0 ? (
          <div className="mt-4">
            <p className="ws-eyebrow mb-2">History</p>
            <ul className="space-y-1 text-sm ws-muted">
              {(data?.arrangements ?? [])
                .filter((a) =>
                  ["ended", "expired", "superseded"].includes(a.status),
                )
                .slice(0, 12)
                .map((a) => (
                  <li key={a.id}>
                    {a.kind} · {a.status} · {formatUtc(a.createdAt)} · {a.reason}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
