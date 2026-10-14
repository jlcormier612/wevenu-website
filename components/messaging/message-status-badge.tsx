/**
 * MessageStatusBadge — Communication Trust Experience.
 * Compact venue-facing status label by default. Failure explanation /
 * next-action live in MessageTimelinePopover (on demand).
 */
import { isDeliveryFailureStatus } from "@/lib/communication/status-labels";
import { resolveDeliveryDisplay } from "@/lib/conversations/delivery-display";

export function MessageStatusBadge({
  status, failureReason, isOutbound, channel,
}: {
  status: string | null | undefined;
  failureReason?: string | null;
  isOutbound: boolean;
  /** @deprecated Kept for call-site compatibility; detail is no longer inline. */
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
    <span
      className={`inline-flex max-w-full items-start gap-1 whitespace-normal text-left ${failed ? "font-semibold" : ""}`}
      data-testid="message-status-badge"
      data-status-label={display.label}
      data-retry-appropriate={failed ? String(display.retryAppropriate) : undefined}
    >
      <span aria-hidden className="shrink-0">{display.emoji}</span>
      <span className="min-w-0 break-words">{display.label}</span>
    </span>
  );
}
