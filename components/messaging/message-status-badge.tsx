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
    <span className={`inline-flex max-w-full flex-col items-start gap-0.5 ${failed ? "font-semibold" : ""}`}>
      <span className="inline-flex max-w-full items-start gap-1 whitespace-normal text-left">
        <span aria-hidden className="shrink-0">{display.emoji}</span>
        <span className="min-w-0 break-words">{display.label}</span>
      </span>
      {failed && display.reason && (
        <span className="max-w-full whitespace-normal break-words text-left text-[10px] font-normal leading-snug opacity-90">
          {display.reason}
        </span>
      )}
      {failed && providerDetail && (
        <details className="max-w-full text-[10px] font-normal opacity-80">
          <summary className="cursor-pointer">More details</summary>
          <span className="block max-w-full whitespace-normal break-words pt-0.5 text-left">{providerDetail}</span>
        </details>
      )}
    </span>
  );
}
