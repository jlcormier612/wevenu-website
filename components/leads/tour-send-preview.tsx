"use client";

import type { TourCustomerSendPreview } from "@/lib/tours/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

/** Shows the message the existing tour email builder will actually send. */
export function TourSendPreview({ preview }: { preview: TourCustomerSendPreview }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      <Row label="Who" value={preview.who ?? "No email address on file"} />
      <Row label="Channel" value={preview.channel} />
      <div>
        <p className="text-xs font-medium text-muted-foreground">What</p>
        <p className="text-sm font-medium text-heading">{preview.subject}</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-foreground">{preview.body}</pre>
      </div>
      <Row label="Why" value={preview.why} />
      <Row label="What the client can do" value={preview.recipientAction} />
      <Row label="What happens in Hello to Cheers" value={preview.htcAfterward} />
      {!preview.who && (
        <p className="text-sm text-destructive">No email will be sent, because there is no email address on file.</p>
      )}
    </div>
  );
}
