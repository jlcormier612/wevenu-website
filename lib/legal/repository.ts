/**
 * legal_documents / legal_acceptances data access. Server-only.
 */

import type { createAdminClient } from "@/integrations/supabase/admin";
import type { createClient } from "@/integrations/supabase/server";
import type { LegalAcceptance, LegalDocument, LegalDocumentType } from "@/lib/legal/types";

type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof createAdminClient>;

type LegalDocumentRow = {
  id: string;
  document_type: string;
  title: string;
  version: string;
  effective_date: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LegalAcceptanceRow = {
  id: string;
  relationship_id: string | null;
  user_id: string;
  legal_document_id: string;
  accepted_version: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export function mapLegalDocument(r: LegalDocumentRow): LegalDocument {
  return {
    id: r.id,
    documentType: r.document_type as LegalDocumentType,
    title: r.title,
    version: r.version,
    effectiveDate: r.effective_date,
    content: r.content,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapLegalAcceptance(r: LegalAcceptanceRow): LegalAcceptance {
  return {
    id: r.id,
    relationshipId: r.relationship_id,
    userId: r.user_id,
    legalDocumentId: r.legal_document_id,
    acceptedVersion: r.accepted_version,
    acceptedAt: r.accepted_at,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  };
}

const LEGAL_DOCUMENT_SELECT =
  "id, document_type, title, version, effective_date, content, is_active, created_at, updated_at";

export async function getActiveLegalDocumentByType(
  supabase: DbClient,
  documentType: LegalDocumentType,
): Promise<LegalDocument | null> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT)
    .eq("document_type", documentType)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapLegalDocument(data as LegalDocumentRow);
}

export async function listAllLegalDocuments(
  supabase: DbClient,
): Promise<LegalDocument[]> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT)
    .order("document_type")
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as LegalDocumentRow[]).map(mapLegalDocument);
}

export async function listLegalDocumentsByType(
  supabase: DbClient,
  documentType: LegalDocumentType,
): Promise<LegalDocument[]> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT)
    .eq("document_type", documentType)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as LegalDocumentRow[]).map(mapLegalDocument);
}

export async function getLegalDocumentById(
  supabase: DbClient,
  id: string,
): Promise<LegalDocument | null> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapLegalDocument(data as LegalDocumentRow);
}

/**
 * Insert a new version row. Always created inactive — activation is a
 * separate flip of is_active (content is immutable after insert).
 */
export async function insertLegalDocumentVersion(
  supabase: DbClient,
  input: {
    documentType: LegalDocumentType;
    title: string;
    version: string;
    effectiveDate: string;
    content: string;
  },
): Promise<LegalDocument> {
  const { data, error } = await supabase
    .from("legal_documents")
    .insert({
      document_type: input.documentType,
      title: input.title,
      version: input.version,
      effective_date: input.effectiveDate,
      content: input.content,
      is_active: false,
    })
    .select(LEGAL_DOCUMENT_SELECT)
    .single();

  if (error) throw error;
  return mapLegalDocument(data as LegalDocumentRow);
}

/** Flip is_active only — never mutates content fields. */
export async function setLegalDocumentActive(
  supabase: DbClient,
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("legal_documents")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Deactivate every active version of a type. Call before activating another
 * so the partial unique index `legal_documents_one_active_per_type` is satisfied.
 */
export async function deactivateActiveLegalDocumentsOfType(
  supabase: DbClient,
  documentType: LegalDocumentType,
): Promise<void> {
  const { error } = await supabase
    .from("legal_documents")
    .update({ is_active: false })
    .eq("document_type", documentType)
    .eq("is_active", true);

  if (error) throw error;
}

export async function insertLegalAcceptance(
  // Service-role only — no authenticated insert policy.
  admin: ReturnType<typeof createAdminClient>,
  input: {
    userId: string;
    legalDocumentId: string;
    acceptedVersion: string;
    relationshipId?: string | null;
    acceptedAt?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<LegalAcceptance> {
  const row = {
    user_id: input.userId,
    legal_document_id: input.legalDocumentId,
    accepted_version: input.acceptedVersion,
    relationship_id: input.relationshipId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    ...(input.acceptedAt ? { accepted_at: input.acceptedAt } : {}),
  };

  const { data, error } = await admin
    .from("legal_acceptances")
    .insert(row)
    .select(
      "id, relationship_id, user_id, legal_document_id, accepted_version, accepted_at, ip_address, user_agent, created_at",
    )
    .single();

  if (error) throw error;
  return mapLegalAcceptance(data as LegalAcceptanceRow);
}

/**
 * Latest acceptance for an active document id, matching identity by user_id
 * and/or relationship_id (client / venue_customer_relationship context).
 */
export async function getLatestLegalAcceptanceForIdentity(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    legalDocumentId: string;
    userId?: string | null;
    relationshipId?: string | null;
  },
): Promise<LegalAcceptance | null> {
  const userId = input.userId?.trim() || null;
  const relationshipId = input.relationshipId?.trim() || null;
  if (!userId && !relationshipId) return null;

  let query = admin
    .from("legal_acceptances")
    .select(
      "id, relationship_id, user_id, legal_document_id, accepted_version, accepted_at, ip_address, user_agent, created_at",
    )
    .eq("legal_document_id", input.legalDocumentId)
    .order("accepted_at", { ascending: false })
    .limit(1);

  if (userId && relationshipId) {
    query = query.or(
      `user_id.eq.${userId},relationship_id.eq.${relationshipId}`,
    );
  } else if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("relationship_id", relationshipId!);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapLegalAcceptance(data as LegalAcceptanceRow);
}

const LEGAL_ACCEPTANCE_SELECT =
  "id, relationship_id, user_id, legal_document_id, accepted_version, accepted_at, ip_address, user_agent, created_at";

/**
 * Every acceptance for a user, newest first.
 * Prefer the caller's authenticated client so RLS (user_id = auth.uid()) applies;
 * admin is allowed when the service has already verified the session user id.
 */
export async function listLegalAcceptancesForUser(
  supabase: DbClient,
  userId: string,
): Promise<LegalAcceptance[]> {
  const uid = userId.trim();
  if (!uid) return [];

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select(LEGAL_ACCEPTANCE_SELECT)
    .eq("user_id", uid)
    .order("accepted_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as LegalAcceptanceRow[]).map(mapLegalAcceptance);
}

/** Resolve document rows by id (service-role / HQ — includes inactive versions). */
export async function getLegalDocumentsByIds(
  supabase: DbClient,
  ids: string[],
): Promise<LegalDocument[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const { data, error } = await supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT)
    .in("id", unique);

  if (error) throw error;
  return ((data ?? []) as LegalDocumentRow[]).map(mapLegalDocument);
}

/**
 * Latest acceptance for a document_type across any version of that type,
 * matching identity by user_id and/or relationship_id.
 * Used to compare `accepted_version` against the currently active version.
 */
export async function getLatestLegalAcceptanceForDocumentType(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    documentType: LegalDocumentType;
    userId?: string | null;
    relationshipId?: string | null;
  },
): Promise<LegalAcceptance | null> {
  const userId = input.userId?.trim() || null;
  const relationshipId = input.relationshipId?.trim() || null;
  if (!userId && !relationshipId) return null;

  // Resolve document ids for this type (historical + active), then pick the
  // newest acceptance among them. Avoids PostgREST embed filters on append-only history.
  const { data: docs, error: docsError } = await admin
    .from("legal_documents")
    .select("id")
    .eq("document_type", input.documentType);

  if (docsError) throw docsError;
  const documentIds = (docs ?? [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => Boolean(id));
  if (documentIds.length === 0) return null;

  let query = admin
    .from("legal_acceptances")
    .select(
      "id, relationship_id, user_id, legal_document_id, accepted_version, accepted_at, ip_address, user_agent, created_at",
    )
    .in("legal_document_id", documentIds)
    .order("accepted_at", { ascending: false })
    .limit(1);

  if (userId && relationshipId) {
    query = query.or(
      `user_id.eq.${userId},relationship_id.eq.${relationshipId}`,
    );
  } else if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("relationship_id", relationshipId!);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapLegalAcceptance(data as LegalAcceptanceRow);
}
