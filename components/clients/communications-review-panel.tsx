import Link from "next/link";

import type { CommunicationsReviewModel } from "@/lib/clients/communications-review";

export function CommunicationsReviewPanel({
  communications,
}: {
  communications: CommunicationsReviewModel;
}) {
  return (
    <div
      id="communications"
      className="rounded-sm border px-6 py-5 text-left"
      style={{ borderColor: "#D8A7AA40", background: "#FDF8F8" }}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "#9ca3af" }}>
        {communications.heading}
      </p>
      <p className="mb-4 text-sm" style={{ color: "#3D2F30" }}>
        {communications.summary}
      </p>
      <p className="mb-4 text-xs text-muted-foreground leading-relaxed">{communications.reviewNote}</p>
      <ul className="space-y-3">
        {communications.rows.map((row) => (
          <li key={row.key} className="flex items-start gap-3 text-sm">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={
                row.onFile
                  ? { background: "#D8A7AA20", color: "#5A3235" }
                  : { background: "transparent", color: "#9ca3af" }
              }
            >
              {row.onFile ? "✓" : "○"}
            </span>
            <div className="min-w-0 flex-1">
              <p style={{ color: row.onFile || row.needsAttention ? "#3D2F30" : "#9ca3af" }}>
                {row.label}
              </p>
              <p className="text-xs text-muted-foreground">{row.detail}</p>
            </div>
            <Link
              href={row.href}
              className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: "#5A3235" }}
            >
              {row.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
