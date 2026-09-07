/**
 * MessageStatusBadge — Communication Trust Experience.
 * Human-readable status first; optional technical detail behind disclosure.
 */
import { MESSAGE_STATUS_META } from "@/lib/communication/status-labels";

export function MessageStatusBadge({
  status, failureReason, isOutbound, providerDetail,
}: {
  status: string | null | undefined;
  failureReason?: string | null;
  isOutbound: boolean;
  /** Optional technical/provider detail — progressive disclosure only. */
  providerDetail?: string | null;
}) {
  if (!isOutbound || !status) return null;
  const meta = MESSAGE_STATUS_META[status];
  if (!meta) return null;
  const title = status === "failed" && failureReason ? failureReason : undefined;
  return (
    <span className={`inline-flex flex-col items-start gap-0.5 ${status === "failed" ? "font-semibold" : ""}`} title={title}>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>{meta.emoji}</span> {meta.label}
      </span>
      {status === "failed" && failureReason && (
        <span className="text-[10px] font-normal opacity-90">{failureReason}</span>
      )}
      {status === "failed" && providerDetail && (
        <details className="text-[10px] font-normal opacity-80">
          <summary className="cursor-pointer">Technical details</summary>
          <span className="block pt-0.5">{providerDetail}</span>
        </details>
      )}
    </span>
  );
}
