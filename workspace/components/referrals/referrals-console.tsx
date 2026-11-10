"use client";

import { useCallback, useEffect, useState } from "react";

type Referral = {
  id: string;
  referringVenueId: string;
  referredVenueName: string;
  referredCity: string;
  referredState: string;
  referredWebsite: string;
  referredContactEmail: string;
  referredContactName: string;
  referredContactRole: string | null;
  notes: string | null;
  status: string;
  assignedOwnerEmail: string | null;
  linkedVenueId: string | null;
  isSelfReferral: boolean;
  isSameOrganization: boolean;
  isExistingPayingCustomer: boolean;
  isDuplicateClaim: boolean;
  blockedReason: string | null;
  createdAt: string;
};

type Reward = {
  id: string;
  status: string;
  rewardAmountCents: number;
  currency: string;
  valuationSource: string | null;
  stripeInvoiceItemId: string | null;
  appliedInvoiceId: string | null;
  lastError: string | null;
};

type Detail = {
  referral: Referral;
  attributions: Array<Record<string, unknown>>;
  reward: Reward | null;
  activity: Array<{ id: string; kind: string; body: string; actorEmail: string; createdAt: string }>;
};

const STATUSES = [
  "submitted",
  "under_review",
  "contacted",
  "interested",
  "converted",
  "qualification_pending",
  "reward_eligible",
  "reward_issued",
  "closed_not_eligible",
  "closed_duplicate",
  "closed_declined",
];

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ReferralsConsole() {
  const [rows, setRows] = useState<Referral[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [linkVenueId, setLinkVenueId] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<string>("");

  const loadList = useCallback(async () => {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (status) qs.set("status", status);
    const res = await fetch(`/api/relationships/referrals?${qs.toString()}`);
    const json = (await res.json()) as {
      referrals?: Referral[];
      readiness?: { diagnosticMessage?: string };
      error?: string;
    };
    if (!res.ok) {
      setMessage(json.error || "Failed to load referrals");
      return;
    }
    setRows(json.referrals ?? []);
    setReadiness(json.readiness?.diagnosticMessage ?? "");
  }, [search, status]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(
      `/api/relationships/referrals?referralId=${encodeURIComponent(id)}`,
    );
    const json = (await res.json()) as Detail & { error?: string };
    if (!res.ok) {
      setMessage(json.error || "Failed to load referral");
      return;
    }
    setDetail(json);
    setOwnerEmail(json.referral.assignedOwnerEmail ?? "");
    setLinkVenueId(json.referral.linkedVenueId ?? "");
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || json.ok === false) {
        setMessage(json.error || "Action failed");
        return;
      }
      setMessage("Saved.");
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch {
      setMessage("Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review Refer a Venue submissions, attribute conversions, and manage
          thank-you credits. Prospect contact is never auto-emailed.
        </p>
        {readiness ? (
          <p className="mt-2 text-xs text-muted-foreground">{readiness}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="h-9 min-w-[220px] flex-1 rounded-md border px-3 text-sm"
          placeholder="Search venue, email, domain…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-9 rounded-md border px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="h-9 rounded-md border px-3 text-sm"
          onClick={() => void loadList()}
        >
          Refresh
        </button>
      </div>

      {message ? <p className="text-sm text-amber-800">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Referred</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-t hover:bg-muted/30 ${
                    selectedId === row.id ? "bg-muted/40" : ""
                  }`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.referredVenueName}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.referredCity}, {row.referredState}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {[
                      row.isSelfReferral ? "self" : null,
                      row.isSameOrganization ? "same-org" : null,
                      row.isDuplicateClaim ? "dup" : null,
                      row.isExistingPayingCustomer ? "existing" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={3}>
                    No referrals match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          {!detail ? (
            <p className="text-sm text-muted-foreground">
              Select a referral to review details and take action.
            </p>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-medium">
                  {detail.referral.referredVenueName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {detail.referral.referredContactName}
                  {detail.referral.referredContactRole
                    ? ` · ${detail.referral.referredContactRole}`
                    : ""}
                </p>
                <p className="text-sm">{detail.referral.referredContactEmail}</p>
                <p className="text-sm">
                  <a
                    className="text-primary underline"
                    href={detail.referral.referredWebsite}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {detail.referral.referredWebsite}
                  </a>
                </p>
                {detail.referral.notes ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Notes: {detail.referral.notes}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Referring venue: {detail.referral.referringVenueId}
                </p>
                {detail.referral.blockedReason ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Blocked: {detail.referral.blockedReason}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Workflow status
                </label>
                <select
                  className="h-9 rounded-md border px-2 text-sm"
                  value={detail.referral.status}
                  disabled={busy}
                  onChange={(e) =>
                    void post("update", {
                      referralId: detail.referral.id,
                      status: e.target.value,
                    })
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Owner email
                </label>
                <div className="flex gap-2">
                  <input
                    className="h-9 flex-1 rounded-md border px-3 text-sm"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    className="h-9 rounded-md border px-3 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void post("update", {
                        referralId: detail.referral.id,
                        assignedOwnerEmail: ownerEmail || null,
                      })
                    }
                  >
                    Assign
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Link referred venue ID
                </label>
                <div className="flex gap-2">
                  <input
                    className="h-9 flex-1 rounded-md border px-3 text-sm"
                    value={linkVenueId}
                    onChange={(e) => setLinkVenueId(e.target.value)}
                    placeholder="uuid"
                  />
                  <button
                    type="button"
                    className="h-9 rounded-md border px-3 text-sm"
                    disabled={busy || !linkVenueId.trim()}
                    onClick={() =>
                      void post("attribute", {
                        referralId: detail.referral.id,
                        referredVenueId: linkVenueId.trim(),
                        matchMethod: "founder_confirmed",
                      })
                    }
                  >
                    Attribute
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Internal note
                </label>
                <textarea
                  className="min-h-[80px] rounded-md border px-3 py-2 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="button"
                  className="h-9 w-fit rounded-md border px-3 text-sm"
                  disabled={busy || !note.trim()}
                  onClick={() => {
                    void post("update", {
                      referralId: detail.referral.id,
                      note,
                    }).then(() => setNote(""));
                  }}
                >
                  Add note
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-9 rounded-md border px-3 text-sm"
                  disabled={busy}
                  onClick={() =>
                    void post("update", {
                      referralId: detail.referral.id,
                      markExistingPayingCustomer: true,
                    })
                  }
                >
                  Mark existing customer
                </button>
                {detail.attributions[0] ? (
                  <button
                    type="button"
                    className="h-9 rounded-md border px-3 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void post("evaluate_qualification", {
                        attributionId: detail.attributions[0]!.id,
                        forceNow: true,
                      })
                    }
                  >
                    Force qualify (test)
                  </button>
                ) : null}
                {detail.reward?.status === "eligible" ||
                detail.reward?.status === "failed" ? (
                  <button
                    type="button"
                    className="h-9 rounded-md border px-3 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void post("approve_reward", {
                        rewardId: detail.reward!.id,
                      })
                    }
                  >
                    Approve reward
                  </button>
                ) : null}
                {detail.reward &&
                (detail.reward.status === "approved" ||
                  detail.reward.status === "failed") ? (
                  <button
                    type="button"
                    className="h-9 rounded-md border px-3 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void post("issue_reward", {
                        rewardId: detail.reward!.id,
                      })
                    }
                  >
                    Issue Stripe credit
                  </button>
                ) : null}
              </div>

              {detail.reward ? (
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Reward</p>
                  <p>
                    {money(detail.reward.rewardAmountCents)} ·{" "}
                    {detail.reward.status}
                    {detail.reward.valuationSource
                      ? ` · ${detail.reward.valuationSource}`
                      : ""}
                  </p>
                  {detail.reward.stripeInvoiceItemId ? (
                    <p className="text-xs text-muted-foreground">
                      Invoice item: {detail.reward.stripeInvoiceItemId}
                    </p>
                  ) : null}
                  {detail.reward.appliedInvoiceId ? (
                    <p className="text-xs text-muted-foreground">
                      Applied invoice: {detail.reward.appliedInvoiceId}
                    </p>
                  ) : null}
                  {detail.reward.lastError ? (
                    <p className="text-xs text-destructive">
                      {detail.reward.lastError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Activity
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {detail.activity.map((a) => (
                    <div key={a.id} className="border-b border-border/50 pb-2">
                      <p>{a.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.kind} · {a.actorEmail} ·{" "}
                        {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {detail.activity.length === 0 ? (
                    <p className="text-muted-foreground">No activity yet.</p>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
