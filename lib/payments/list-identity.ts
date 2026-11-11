/**
 * Payments list presentation identity — client/couple name primary,
 * payment-plan title secondary. Does not change schedule semantics.
 */

export function paymentPlanDisplayName(title: string): string {
  const t = title.trim();
  return t.replace(/\s+payments$/i, "") || t;
}

export function paymentScheduleListPrimaryTitle(s: {
  clientName: string | null | undefined;
  title: string;
}): string {
  const name = s.clientName?.trim();
  if (name) return name;
  return s.title;
}

export function paymentScheduleListSecondaryLine(s: {
  title: string;
  overdueCount?: number;
}): string {
  const plan = paymentPlanDisplayName(s.title);
  const overdue = s.overdueCount ?? 0;
  if (overdue > 0) {
    return `${plan} · ${overdue} overdue payment${overdue === 1 ? "" : "s"}`;
  }
  return plan;
}
