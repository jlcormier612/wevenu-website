/**
 * Stable Today's Focus dismissal identities.
 *
 * Keys fingerprint the recommendation condition, not rendered copy and not
 * a volatile list index. The same unresolved condition keeps the same key.
 * A materially new condition (new overdue installment, new follow-up date,
 * new contract id) produces a new key.
 *
 * Dismiss ≠ complete. These keys never become domain evidence.
 */

export type PaymentConditionLine = {
  id: string;
  status: string;
  dueDate: string | null;
};

export type ContractConditionRow = {
  id: string;
  status: string;
};

export type RequestConditionRow = {
  id: string;
  status: string;
  dueDate: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function joinParts(parts: string[]): string {
  return [...parts].sort().join("|");
}

export function leadOverdueFollowUpDismissalKey(leadId: string, followUpDate: string): string {
  return `v1:lead-overdue-followup:${leadId}:${followUpDate}`;
}

export function leadNewInquiryDismissalKey(leadId: string, createdAtIso: string): string {
  const createdDate = (createdAtIso || "").slice(0, 10) || "unknown";
  return `v1:lead-new-inquiry:${leadId}:${createdDate}`;
}

export function leadFollowUpTodayDismissalKey(leadId: string, followUpDate: string): string {
  return `v1:lead-followup-today:${leadId}:${followUpDate}`;
}

export function leadAttentionDismissalKey(lead: {
  id: string;
  followUpDate?: string | null;
  createdAt: string;
}, today: string): string {
  if (lead.followUpDate && lead.followUpDate < today) {
    return leadOverdueFollowUpDismissalKey(lead.id, lead.followUpDate);
  }
  return leadNewInquiryDismissalKey(lead.id, lead.createdAt);
}

export function leadTaskDismissalKey(taskId: string, dueDate: string | null): string {
  return `v1:lead-task:${taskId}:${dueDate ?? "none"}`;
}

export function tourTodayDismissalKey(leadId: string, tourDate: string): string {
  return `v1:tour-today:${leadId}:${tourDate}`;
}

export function eventTodayDismissalKey(eventId: string, eventDate: string): string {
  return `v1:event-today:${eventId}:${eventDate}`;
}

export function paymentDueTodayDismissalKey(paymentId: string, dueDate: string): string {
  return `v1:payment-due:${paymentId}:${dueDate}`;
}

export function paymentsAttentionDismissalKey(
  eventId: string,
  lines: PaymentConditionLine[],
): string {
  const today = todayIso();
  const overdue = lines.filter((l) =>
    l.status === "overdue" || (l.dueDate != null && l.dueDate < today && (l.status === "pending" || l.status === "overdue" || l.status === "processing")),
  );
  const parts = overdue.map((l) => `${l.id}:${l.status}:${l.dueDate ?? ""}`);
  return `v1:payments:${eventId}:${joinParts(parts) || "none"}`;
}

export function contractsAttentionDismissalKey(
  eventId: string,
  contracts: ContractConditionRow[],
): string {
  const parts = contracts.map((c) => `${c.id}:${c.status}`);
  return `v1:contracts:${eventId}:${joinParts(parts) || "none"}`;
}

export function requestsAttentionDismissalKey(
  eventId: string,
  requests: RequestConditionRow[],
): string {
  const today = todayIso();
  const noisy = requests.filter((r) => {
    if (r.status === "submitted" || r.status === "reviewed") return true;
    if (r.dueDate != null && r.dueDate < today && r.status !== "completed" && r.status !== "cancelled") {
      return true;
    }
    return false;
  });
  const parts = noisy.map((r) => `${r.id}:${r.status}:${r.dueDate ?? ""}`);
  return `v1:requests:${eventId}:${joinParts(parts) || "none"}`;
}

export function filterDismissedFocusItems<T extends { dismissalKey?: string | null }>(
  items: readonly T[],
  dismissedKeys: ReadonlySet<string>,
): T[] {
  if (dismissedKeys.size === 0) return [...items];
  return items.filter((item) => !item.dismissalKey || !dismissedKeys.has(item.dismissalKey));
}
