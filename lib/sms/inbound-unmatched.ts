/**
 * Persist unmatched / ambiguous inbound Text without creating a relationship.
 */
export type InboundSmsUnmatchedReason = "none" | "ambiguous" | "invalid_phone" | "rpc_error";

export function unmatchedReasonFromCount(count: number | null | undefined): InboundSmsUnmatchedReason {
  if (count == null || count < 0) return "rpc_error";
  if (count > 1) return "ambiguous";
  return "none";
}

export function inboundFromDigits(from: string): string {
  return from.replace(/\D/g, "").slice(-10);
}

export async function persistInboundSmsUnmatched(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  input: {
    venueId: string;
    from: string;
    matchCount: number;
    reason?: InboundSmsUnmatchedReason;
    messageSid: string | null;
  },
): Promise<void> {
  const { error } = await client.from("inbound_sms_unmatched").insert({
    venue_id: input.venueId,
    from_digits: inboundFromDigits(input.from),
    match_count: input.matchCount,
    reason: input.reason ?? unmatchedReasonFromCount(input.matchCount),
    message_sid: input.messageSid,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("inbound_sms_unmatched persist failed:", error.message);
  }
}
