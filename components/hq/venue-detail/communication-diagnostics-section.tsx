import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CommunicationDiagnostics } from "@/lib/hq/communication-diagnostics-service";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Administrator-only — raw provider/webhook detail Communication Health
 * deliberately hides from the coordinator experience (see
 * lib/communication/health.ts). For support and troubleshooting a
 * specific venue, not everyday operation.
 */
export function CommunicationDiagnosticsSection({ diagnostics }: { diagnostics: CommunicationDiagnostics }) {
  const { authStatus, queue, events } = diagnostics;
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-sm font-semibold text-heading">Communication Diagnostics</h2>
        <p className="text-xs text-muted-foreground">Raw provider and webhook detail — not shown to the venue.</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Email auth</p>
            <p className={authStatus.emailConfigured ? "text-success" : "text-destructive"}>
              {authStatus.emailConfigured ? "Configured" : "Not configured"}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">SMS auth</p>
            <p className={authStatus.smsConfigured ? "text-success" : "text-destructive"}>
              {authStatus.smsConfigured ? "Configured" : "Not configured"}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Queue pending</p>
            <p className="text-heading">{queue.pending}</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Queue overdue</p>
            <p className={queue.overdue > 0 ? "text-destructive" : "text-heading"}>{queue.overdue}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Retry history isn&apos;t tracked as a separate log — a retry is just a new send, visible as another entry below or in Message History.
        </p>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Webhook &amp; Provider Event History ({events.length})
          </p>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No webhook events recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {events.map((e) => (
                <li key={`${e.source}-${e.id}`} className="px-3 py-2">
                  <details>
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-heading">{e.eventType}</span>
                      <span className="text-muted-foreground">{e.source} · {fmt(e.occurredAt)}</span>
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-2 text-[10px] text-muted-foreground">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
