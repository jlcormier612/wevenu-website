"use client";

import type { TourCustomerSendPreview } from "@/lib/tours/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="htc-tour-send-preview-row">
      <p className="htc-tour-send-preview-label">{label}</p>
      <p className="htc-tour-send-preview-value">{value}</p>
    </div>
  );
}

/** Shows the message the existing tour email builder will actually send. */
export function TourSendPreview({ preview }: { preview: TourCustomerSendPreview }) {
  return (
    <div className="htc-tour-send-preview" data-testid="tour-send-preview">
      <p className="htc-tour-send-preview-kicker">Client email review</p>
      <div className="htc-tour-send-preview-meta">
        <Row label="Who" value={preview.who ?? "No email address on file"} />
        <Row label="Channel" value={preview.channel} />
      </div>
      <div className="htc-tour-send-preview-message">
        <p className="htc-tour-send-preview-label">What</p>
        <p className="htc-tour-send-preview-subject">{preview.subject}</p>
        <pre className="htc-tour-send-preview-body">{preview.body}</pre>
      </div>
      <Row label="Why" value={preview.why} />
      <Row label="What the client can do" value={preview.recipientAction} />
      <Row label="What happens in Hello to Cheers" value={preview.htcAfterward} />
      {!preview.who && (
        <p className="htc-tour-send-preview-warn">
          No email will be sent, because there is no email address on file.
        </p>
      )}
    </div>
  );
}
