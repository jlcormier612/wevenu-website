"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  eventOrderPortalAdditionalReferenceTotal,
  eventOrderPortalLineMoneyLabel,
} from "@/lib/client-portal/event-order-portal-display";

export type PortalEventOrderLineView = {
  id: string;
  description: string;
  quantity: number;
  amount: number;
  sectionId: string | null;
  sectionName: string | null;
  isIncluded: boolean | null;
  unit: string | null;
  unitPrice: number | null;
  notes: string | null;
};

export type PortalEventOrderViewModel = {
  id: string;
  status: string;
  revision: number;
  sharedAt: string | null;
  clientAgreedAt?: string | null;
  clientAgreedName?: string | null;
  clientAgreedRevision?: number | null;
  lines: PortalEventOrderLineView[];
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Couple-facing Event Order presentation (shared snapshot shape).
 * Used by the portal section and staff client-portal preview.
 * Accept is optional — preview mode omits token.
 */
export function EventOrderPortalView({
  data,
  paymentsHref,
  staffPreviewLabel,
  token,
  onAccepted,
}: {
  data: PortalEventOrderViewModel | null;
  /** When set, show payments deep-link. Preview mode passes null (inert). */
  paymentsHref?: string | null;
  /** Staff-only label when showing unreleased draft with portal chrome. */
  staffPreviewLabel?: string | null;
  /** Portal token — enables Accept. Omit in staff preview. */
  token?: string | null;
  onAccepted?: (next: PortalEventOrderViewModel) => void;
}) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [local, setLocal] = React.useState(data);
  React.useEffect(() => {
    setLocal(data);
  }, [data]);

  if (!local) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="event-order-portal-empty">
        <p className="text-sm font-medium text-heading">Not shared yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your venue has not shared an Event Order for this event. This is not your invoice or contract.
        </p>
      </div>
    );
  }

  const additionalReferenceTotal = eventOrderPortalAdditionalReferenceTotal(local.lines);
  const sectionKeys = [...new Set(local.lines.map((l) => l.sectionId))];
  const agreed = Boolean(local.clientAgreedAt);
  const canAccept = Boolean(token) && !agreed && !staffPreviewLabel;

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/event-order/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, agreedName: name }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        clientAgreedAt?: string | null;
        clientAgreedRevision?: number | null;
      };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "Could not accept.");
        return;
      }
      const next: PortalEventOrderViewModel = {
        ...local!,
        clientAgreedAt: body.clientAgreedAt ?? new Date().toISOString(),
        clientAgreedName: name.trim(),
        clientAgreedRevision: body.clientAgreedRevision ?? local!.revision,
      };
      setLocal(next);
      onAccepted?.(next);
    } catch {
      setError("Could not accept. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6" data-testid="event-order-portal-view">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-heading">What you&apos;re receiving</h2>
          {staffPreviewLabel ? (
            <Badge variant="secondary">{staffPreviewLabel}</Badge>
          ) : agreed ? (
            <Badge variant="success" data-testid="event-order-agreed-badge">Agreed</Badge>
          ) : (
            <Badge variant="success">Shared</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Your Event Order — the delivery list for your event. Not your invoice or contract.
          {canAccept
            ? " Review the details below, then accept to confirm agreement with your venue."
            : null}
        </p>
        {local.sharedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(local.sharedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
        {agreed && local.clientAgreedAt ? (
          <p className="text-xs text-muted-foreground" data-testid="event-order-agreed-meta">
            Accepted
            {local.clientAgreedName ? ` by ${local.clientAgreedName}` : ""}
            {" · "}
            {new Date(local.clientAgreedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>

      {local.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No delivery items on this shared Event Order.</p>
      ) : (
        sectionKeys.map((sectionId) => {
          const lines = local.lines.filter((l) => l.sectionId === sectionId);
          const sectionName = lines[0]?.sectionName;
          return (
            <div key={sectionId ?? "general"} className="space-y-2">
              {sectionName && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sectionName}</p>}
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {lines.map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{l.description}</p>
                      <p className="text-xs text-muted-foreground">
                        ×{l.quantity}{l.unit ? ` ${l.unit}` : ""}
                        {" · "}
                        {l.isIncluded === false ? "Additional" : "Included"}
                      </p>
                      {l.notes && <p className="mt-1 text-xs text-muted-foreground">{l.notes}</p>}
                    </div>
                    <p className="shrink-0 text-sm font-medium text-foreground">
                      {eventOrderPortalLineMoneyLabel(l, formatMoney)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {additionalReferenceTotal > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Additional total (for reference)</span>
            <span className="font-medium">{formatMoney(additionalReferenceTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Included items are part of your arrangement, not extra charges. Amount due is on Payments.
          </p>
          {paymentsHref ? (
            <Link href={paymentsHref} className="inline-block text-sm font-medium text-primary hover:underline">
              View what you owe
            </Link>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">View what you owe (Payments)</p>
          )}
        </div>
      )}

      {canAccept ? (
        <div
          className="rounded-xl border border-border bg-card px-4 py-4 space-y-3"
          data-testid="event-order-accept-panel"
        >
          <div>
            <h3 className="text-sm font-medium text-heading">Accept this Event Order</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Sharing means your venue sent this for review. Accepting records your agreement.
              It does not create an invoice by itself.
            </p>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-heading">Your name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              data-testid="event-order-accept-name"
              disabled={busy}
            />
          </label>
          {error ? (
            <p className="text-xs text-destructive" data-testid="event-order-accept-error">{error}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy || name.trim().length < 2}
            onClick={() => void accept()}
            data-testid="event-order-accept-submit"
          >
            {busy ? "Accepting…" : "Accept Event Order"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
