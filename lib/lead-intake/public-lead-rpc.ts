/**
 * Shape returned by create_public_lead after a successful ingest_lead call.
 * Older deployments only returned lead_id; relationship fields were added so
 * the public inquire route does not need a post-create SELECT on leads
 * (anon RLS hides the row).
 */
export type PublicLeadRpcSuccess = {
  leadId: string;
  relationshipId: string;
  isReturningRelationship: boolean;
};

export function parsePublicLeadRpcSuccess(
  data: Record<string, unknown> | null | undefined,
): PublicLeadRpcSuccess | null {
  if (!data || data.ok !== true) return null;
  const leadId = String(data.lead_id ?? data.leadId ?? "").trim();
  const relationshipId = String(data.relationshipId ?? data.relationship_id ?? "").trim();
  if (!leadId || !relationshipId) return null;
  return {
    leadId,
    relationshipId,
    isReturningRelationship: data.isReturningRelationship === true,
  };
}
