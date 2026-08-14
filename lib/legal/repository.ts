/**
 * legal_documents / legal_acceptances data access. Server-only.
 */

import type { createAdminClient } from "@/integrations/supabase/admin";
import type { createClient } from "@/integrations/supabase/server";
import type {
  LegalAcceptance,
  LegalAcceptanceMethod,
  LegalDocument,
  LegalDocumentType,
} from "@/lib/legal/types";

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
  is_published: boolean;
  is_active: boolean;
  published_by: string | null;
  published_at: string | null;
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
  acceptance_method: string;
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
    isPublished: r.is_published,
    isActive: r.is_active,
    publishedBy: r.published_by ?? null,
    publishedAt: r.published_at ?? null,
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
    acceptanceMethod: r.acceptance_method,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  };
}

const LEGAL_DOCUMENT_SELECT =
  "id, document_type, title, version, effective_date, content, is_published, is_active, published_by, published_at, created_at, updated_at";

const LEGAL_ACCEPTANCE_SELECT =
  "id, relationship_id, user_id, legal_document_id, accepted_version, accepted_at, acceptance_method, ip_address, user_agent, created_at";

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
 * Insert a new version row. Always created inactive + unpublished —
 * activation publishes and flips is_active (content is immutable after insert).
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
      is_published: false,
      is_active: false,
    })
    .select(LEGAL_DOCUMENT_SELECT)
    .single();

  if (error) throw error;
  return mapLegalDocument(data as LegalDocumentRow);
}

/**
 * Flip is_active (and publish when activating). Never mutates content fields.
 * Activating a version also sets is_published so the enforced version is readable.
 * Optionally stamps published_by / published_at the first time the row is published.
 */
export async function setLegalDocumentActive(
  supabase: DbClient,
  id: string,
  isActive: boolean,
  opts?: { publishedBy?: string | null },
): Promise<void> {
  if (!isActive) {
    const { error } = await supabase
      .from("legal_documents")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw error;
    return;
  }

  const existing = await getLegalDocumentById(supabase, id);
  const patch: Record<string, unknown> = {
    is_active: true,
    is_published: true,
  };
  // First publish only — do not overwrite historical attribution.
  if (existing && !existing.publishedAt) {
    patch.published_at = new Date().toISOString();
    if (opts?.publishedBy) {
      patch.published_by = opts.publishedBy;
    }
  }

  const { error } = await supabase
    .from("legal_documents")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

/** Count acceptances per legal_document id (service-role / HQ). */
export async function countAcceptancesByDocumentIds(
  supabase: DbClient,
  documentIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))];
  const counts = new Map<string, number>();
  for (const id of unique) counts.set(id, 0);
  if (unique.length === 0) return counts;

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("legal_document_id")
    .in("legal_document_id", unique);

  if (error) throw error;
  for (const row of data ?? []) {
    const id = (row as { legal_document_id?: string }).legal_document_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** All acceptance rows newest first (paginated). */
export async function listLegalAcceptancesPage(
  supabase: DbClient,
  opts?: { limit?: number; offset?: number },
): Promise<LegalAcceptance[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 1000);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select(LEGAL_ACCEPTANCE_SELECT)
    .order("accepted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return ((data ?? []) as LegalAcceptanceRow[]).map(mapLegalAcceptance);
}

/**
 * Deactivate every active version of a type. Call before activating another
 * so the partial unique index `legal_documents_one_active_per_type` is satisfied.
 * Does not unpublish historical versions.
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
    acceptanceMethod: LegalAcceptanceMethod;
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
    acceptance_method: input.acceptanceMethod,
    relationship_id: input.relationshipId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    ...(input.acceptedAt ? { accepted_at: input.acceptedAt } : {}),
  };

  const { data, error } = await admin
    .from("legal_acceptances")
    .insert(row)
    .select(LEGAL_ACCEPTANCE_SELECT)
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
    .select(LEGAL_ACCEPTANCE_SELECT)
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
    .select(LEGAL_ACCEPTANCE_SELECT)
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
