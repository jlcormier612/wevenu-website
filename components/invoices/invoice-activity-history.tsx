import { formatCurrency } from "@/lib/invoices/constants";
import {
  activityEffectLabel,
  activityIsCollectedCash,
  activityKindLabel,
  type InvoiceActivity,
} from "@/lib/invoices/activity-history";

function formatActivityDate(value: string | null): string {
  if (!value) return "Date unknown";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Read-only. Venue staff see the imported transactions. Clients do not. */
export function InvoiceActivityHistory({ activity }: { activity: InvoiceActivity[] }) {
  if (activity.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card" data-testid="invoice-activity-history">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-heading">Activity History</h2>
        <p className="text-xs text-muted-foreground">
          Historical payments, refunds, reallocations, credits, adjustments, and write-offs. This list does not change the records.
        </p>
      </div>
      <ol className="divide-y divide-border">
        {activity.map((item) => (
          <li key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_1fr_auto]">
            <p className="text-sm text-heading">{formatActivityDate(item.occurredOn)}</p>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-heading">{activityKindLabel(item.kind)}</p>
              <p className="text-xs text-muted-foreground">{activityEffectLabel(item.effect)}</p>
              {item.method || item.reference ? (
                <p className="text-xs text-muted-foreground">
                  {[item.method, item.reference].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {item.counterInvoiceNumber ? (
                <p className="text-xs text-muted-foreground">Related invoice {item.counterInvoiceNumber}</p>
              ) : null}
              {item.relatedReference ? (
                <p className="text-xs text-muted-foreground">Related reference {item.relatedReference}</p>
              ) : null}
              {item.installmentLabel ? (
                <p className="text-xs text-muted-foreground">Installment: {item.installmentLabel}</p>
              ) : null}
              {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
              {item.sourceId ? <p className="text-xs text-muted-foreground">Source {item.sourceId}</p> : null}
              {!activityIsCollectedCash(item.kind) ? (
                <p className="text-xs text-muted-foreground">Not money collected.</p>
              ) : null}
            </div>
            <p className="text-sm font-semibold text-heading sm:text-right">{formatCurrency(item.amount)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
