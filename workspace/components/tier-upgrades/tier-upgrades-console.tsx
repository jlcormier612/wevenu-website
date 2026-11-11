"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Panel, StatusPill } from "@/components/shared/ui";

type AuditEntry = {
  at: string;
  by?: string;
  action: string;
  note?: string;
};

type UpgradeRow = {
  id: string;
  venueId: string;
  venueName?: string | null;
  subscriptionId: string;
  status: string;
  currentPlan: string;
  requiredPlan: string;
  peakCount: number;
  peakYear: number | null;
  effectiveAt: string | null;
  noticeSentAt: string | null;
  noticeDeliveryStatus: string | null;
  noticeProviderMessageId: string | null;
  stripeScheduleId: string | null;
  currentAmount: string;
  expectedAmount: string;
  discountPercent: number | null;
  appliedInvoiceId: string | null;
  holdActive?: boolean;
  holdId?: string | null;
  audit: AuditEntry[];
};

type HoldRow = {
  id: string;
  venueId: string;
  stripeSubscriptionId: string | null;
  reason: string;
  placedBy: string;
  placedAt: string;
  active: boolean;
};

type Payload = {
  ok: boolean;
  upgrades: UpgradeRow[];
  holds?: HoldRow[];
  error?: string;
};

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString("en-US", { timeZone: "UTC" });
}

function statusTone(
  status: string,
): "neutral" | "good" | "warn" | "muted" {
  if (status === "applied") return "good";
  if (status.startsWith("blocked") || status === "failed") return "warn";
  if (status === "cancelled" || status === "superseded") return "muted";
  return "neutral";
}

export function TierUpgradesConsole() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/relationships/tier-upgrades");
    const json = (await res.json()) as Payload;
    if (!res.ok) {
      setError(json.error || "Unable to load tier upgrades.");
      setData(null);
      return;
    }
    setData(json);
    if (!selectedId && json.upgrades[0]) setSelectedId(json.upgrades[0].id);
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => data?.upgrades.find((u) => u.id === selectedId) ?? null,
    [data, selectedId],
  );

  async function placeHold(upgrade: UpgradeRow) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/tier-upgrades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "place_hold",
          venueId: upgrade.venueId,
          stripeSubscriptionId: upgrade.subscriptionId,
          reason: "Founder CRM acceptance hold",
          actorEmail: "jennifer@hellotocheers.com",
        }),
      });
      const json = (await res.json()) as { error?: string; hold?: HoldRow };
      if (!res.ok) throw new Error(json.error || "Hold failed");
      setMessage(`Hold placed (${json.hold?.id ?? "ok"}). Billing unchanged.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Hold failed");
    } finally {
      setBusy(false);
    }
  }

  async function releaseHold(holdId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/tier-upgrades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release_hold",
          holdId,
          releaseReason: "Founder CRM acceptance release",
          actorEmail: "jennifer@hellotocheers.com",
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Release failed");
      setMessage(`Hold ${holdId} released. Billing unchanged.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Release failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Panel title="Tier upgrades">
        <p className="text-sm text-[var(--deep-terracotta)]">{error}</p>
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel title="Tier upgrades">
        <p className="ws-muted text-sm">Loading…</p>
      </Panel>
    );
  }

  const activeHolds = (data.holds ?? []).filter((h) => h.active);

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-sm border border-[var(--taupe-medium)] bg-[var(--warm-gray)] px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <Panel title="Upgrade records">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--taupe-medium)]/40 text-xs uppercase tracking-wide ws-muted">
                <th className="py-2 pr-3">Venue</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Volume</th>
                <th className="py-2 pr-3">Effective</th>
                <th className="py-2">Invoice / notice</th>
              </tr>
            </thead>
            <tbody>
              {data.upgrades.map((u) => (
                <tr
                  key={u.id}
                  className={`cursor-pointer border-b border-[var(--taupe-medium)]/25 ${
                    selectedId === u.id ? "bg-[color-mix(in_srgb,var(--soft-sage)_28%,transparent)]" : ""
                  }`}
                  onClick={() => setSelectedId(u.id)}
                >
                  <td className="py-3 pr-3 align-top">
                    <div className="font-medium">{u.venueName || u.venueId.slice(0, 8)}</div>
                    <div className="text-xs ws-muted">{u.subscriptionId}</div>
                  </td>
                  <td className="py-3 pr-3 align-top">
                    <StatusPill tone={statusTone(u.status)}>
                      {u.status.replace(/_/g, " ")}
                    </StatusPill>
                    {u.holdActive ? (
                      <div className="mt-1 text-xs text-[var(--deep-terracotta)]">Hold active</div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 align-top">
                    <div>
                      {u.currentPlan} → {u.requiredPlan}
                    </div>
                    <div className="text-xs ws-muted">
                      {u.currentAmount}/mo → {u.expectedAmount}/mo
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-top">
                    {u.peakCount}
                    {u.peakYear ? ` (${u.peakYear})` : ""}
                  </td>
                  <td className="py-3 pr-3 align-top">{formatUtc(u.effectiveAt)}</td>
                  <td className="py-3 align-top text-xs">
                    <div>{u.appliedInvoiceId || "—"}</div>
                    <div className="ws-muted">
                      {u.noticeDeliveryStatus || "notice n/a"}
                      {u.noticeProviderMessageId
                        ? ` · ${u.noticeProviderMessageId.slice(0, 8)}…`
                        : ""}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected ? (
        <Panel
          title="Upgrade detail"
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-sm border border-[var(--taupe-medium)] px-3 py-1.5 text-sm disabled:opacity-50"
                onClick={() => void placeHold(selected)}
              >
                Place hold
              </button>
              {selected.holdId ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)] disabled:opacity-50"
                  onClick={() => void releaseHold(selected.holdId!)}
                >
                  Release hold
                </button>
              ) : null}
            </div>
          }
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="ws-muted">Venue</dt>
              <dd className="font-medium">
                {selected.venueName || selected.venueId}
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Subscription</dt>
              <dd className="font-medium">{selected.subscriptionId}</dd>
            </div>
            <div>
              <dt className="ws-muted">Current vs completed/required</dt>
              <dd className="font-medium">
                {selected.status === "applied"
                  ? `Completed ${selected.currentPlan} → ${selected.requiredPlan}`
                  : `Pending/blocked path ${selected.currentPlan} → ${selected.requiredPlan}`}
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Schedule</dt>
              <dd className="font-medium">{selected.stripeScheduleId || "—"}</dd>
            </div>
            <div>
              <dt className="ws-muted">Notice</dt>
              <dd className="font-medium">
                {selected.noticeDeliveryStatus || "—"} ·{" "}
                {formatUtc(selected.noticeSentAt)}
              </dd>
            </div>
            <div>
              <dt className="ws-muted">Invoice</dt>
              <dd className="font-medium">{selected.appliedInvoiceId || "—"}</dd>
            </div>
          </dl>

          <div className="mt-5">
            <p className="ws-eyebrow mb-2">Audit evidence</p>
            <ul className="space-y-2 text-sm">
              {selected.audit.length === 0 ? (
                <li className="ws-muted">No audit entries.</li>
              ) : (
                selected.audit.map((a, idx) => (
                  <li
                    key={`${a.at}-${idx}`}
                    className="rounded-sm border border-[var(--taupe-medium)]/40 px-3 py-2"
                  >
                    <div className="font-medium">
                      {a.action.replace(/_/g, " ")} · {formatUtc(a.at)}
                    </div>
                    <div className="ws-muted">{a.note || a.by || "—"}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Panel>
      ) : null}

      <Panel title="Active founder holds">
        {activeHolds.length === 0 ? (
          <p className="text-sm ws-muted">No active holds.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {activeHolds.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--taupe-medium)]/40 px-3 py-2"
              >
                <div>
                  <div className="font-medium">{h.venueId}</div>
                  <div className="ws-muted">
                    {h.reason} · {h.placedBy} · {formatUtc(h.placedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-sm border border-[var(--taupe-medium)] px-3 py-1.5 text-sm disabled:opacity-50"
                  onClick={() => void releaseHold(h.id)}
                >
                  Release
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
