/**
 * MessageStatusBadge — Communication Trust Experience.
 * Human-readable status first; optional technical detail behind disclosure.
 */
import { isDeliveryFailureStatus } from "@/lib/communication/status-labels";
import { resolveDeliveryDisplay } from "@/lib/conversations/delivery-display";

export function MessageStatusBadge({
  status, failureReason, isOutbound, providerDetail, channel,
}: {
  status: string | null | undefined;
  failureReason?: string | null;
  isOutbound: boolean;
  /** Optional technical/provider detail — progressive disclosure only. */
  providerDetail?: string | null;
  /** Channel — required to suppress unsupported Read states (e.g. SMS). */
  channel?: string | null;
}) {
  const display = resolveDeliveryDisplay({
    status,
    channel,
    failureReason,
    isOutbound,
  });
  if (!display) return null;

  const failed = isDeliveryFailureStatus(display.status);
  return (
    <span className={`inline-flex flex-col items-start gap-0.5 ${failed ? "font-semibold" : ""}`}>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>{display.emoji}</span> {display.label}
      </span>
      {failed && display.reason && (
        <span className="text-[10px] font-normal opacity-90">{display.reason}</span>
      )}
      {failed && providerDetail && (
        <details className="text-[10px] font-normal opacity-80">
          <summary className="cursor-pointer">More details</summary>
          <span className="block pt-0.5">{providerDetail}</span>
        </details>
      )}
    </span>
  );
}
