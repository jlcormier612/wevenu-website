/** Holds owned by the lead being checked do not block that lead. Null lead_id still blocks. */
export function foreignHoldCount(
  rows: { lead_id: string | null }[],
  excludeLeadId?: string | null,
): number {
  const owner = excludeLeadId?.trim() || null;
  if (!owner) return rows.length;
  return rows.filter((row) => row.lead_id !== owner).length;
}
