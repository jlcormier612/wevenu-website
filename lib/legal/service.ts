/**
 * Versioned legal documents + acceptance recording. Server-only.
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import type { AuthSessionScope } from "@/lib/auth/session-scope";
import { isSupabaseConfigured } from "@/lib/env";
import { requireLegalAdminUser } from "@/lib/legal/admin-service";
import {
  canDeactivateLegalVersion,
  pickCurrentLegalVersion,
} from "@/lib/legal/admin-helpers";
import {
  deactivateActiveLegalDocumentsOfType,
  getActiveLegalDocumentByType,
  getLatestLegalAcceptanceForDocumentType,
  getLegalDocumentById,
  getLegalDocumentsByIds,
  insertLegalAcceptance,
  insertLegalDocumentVersion,
  listAllLegalDocuments,
  listLegalAcceptancesForUser,
  listLegalDocumentsByType,
  setLegalDocumentActive,
} from "@/lib/legal/repository";
import { publicPathForLegalDocumentType } from "@/lib/legal/public-routes";
import {
  getRequiredDocumentTypes,
  isLegalAcceptanceUserType,
  LEGAL_ACCEPTANCE_USER_TYPES,
  LEGAL_ACCEPTANCE_USER_TYPE_LABELS,
  REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE,
} from "@/lib/legal/required-documents";
import {
  DEFAULT_LEGAL_ACCEPTANCE_METHOD,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_TYPE_TITLES,
  type AuthenticatedLegalPortal,
  type CouplePortalLegalDocumentLink,
  type CouplePortalLegalGateStatus,
  type CreateLegalDocumentVersionInput,
  type LegalAcceptance,
  type LegalAcceptanceHistoryItem,
  type LegalAcceptanceMethod,
  type LegalComplianceRow,
  type LegalComplianceStatus,
  type LegalComplianceSubject,
  type LegalComplianceSummary,
  type LegalDocument,
  type LegalDocumentType,
  type LegalDocumentTypeSummary,
  type LegalGateDocumentLink,
  type LegalGateStatus,
} from "@/lib/legal/types";

export type {
  AuthenticatedLegalPortal,
  CouplePortalLegalGateStatus,
  LegalAcceptanceHistoryItem,
  LegalComplianceRow,
  LegalComplianceStatus,
  LegalComplianceSubject,
  LegalComplianceSummary,
  LegalGateDocumentLink,
  LegalGateStatus,
} from "@/lib/legal/types";

/** WP2 acceptance engine — SoT for future workflows (existing gates unchanged). */
export {
  LegalAcceptanceService,
  createLegalAcceptanceService,
  legalAcceptanceService,
  isAcceptanceCurrentForActive,
} from "@/lib/legal/acceptance-engine";
export type {
  AcceptedDocumentSnapshot,
  LegalAcceptanceEngineDeps,
  LegalAcceptanceUser,
  OutstandingDocument,
  RecordAcceptanceInput,
  RecordAcceptanceResult,
  RequiresAcceptanceResult,
} from "@/lib/legal/acceptance-engine";
export {
  getRequiredDocumentTypes,
  isLegalAcceptanceUserType,
  LEGAL_ACCEPTANCE_USER_TYPES,
  LEGAL_ACCEPTANCE_USER_TYPE_LABELS,
  REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE,
};
export type { LegalAcceptanceUserType } from "@/lib/legal/required-documents";
export {
  clearLegalEventListeners,
  publishLegalEvent,
  subscribeLegalEvents,
} from "@/lib/legal/events";
export type {
  LegalDocumentAcceptedEvent,
  LegalDomainEvent,
  LegalRequirementsSatisfiedEvent,
} from "@/lib/legal/events";

/** Venue staff app + subscription/activate: Venue ToS + Privacy. */
export const VENUE_SUBSCRIPTION_LEGAL_TYPES = [
  "venue_terms_of_service",
  "privacy_policy",
] as const satisfies readonly LegalDocumentType[];

export type VenueSubscriptionLegalType =
  (typeof VENUE_SUBSCRIPTION_LEGAL_TYPES)[number];

/** Alias — same required set for authenticated venue workspace sessions. */
export const VENUE_APP_LEGAL_TYPES = VENUE_SUBSCRIPTION_LEGAL_TYPES;

/** Couple portal Welcome gate: End User Terms + Privacy Policy. */
export const COUPLE_PORTAL_LEGAL_TYPES = [
  "couple_end_user_terms",
  "privacy_policy",
] as const satisfies readonly LegalDocumentType[];

export type CouplePortalLegalType =
  (typeof COUPLE_PORTAL_LEGAL_TYPES)[number];

/** Vendor authenticated portal: Vendor End User Terms + Privacy. */
export const VENDOR_PORTAL_LEGAL_TYPES = [
  "vendor_end_user_terms",
  "privacy_policy",
] as const satisfies readonly LegalDocumentType[];

export type VendorPortalLegalType =
  (typeof VENDOR_PORTAL_LEGAL_TYPES)[number];

/**
 * Document types shown on a Relationship Workspace compliance summary.
 * Venue uses WP2 venue_owner required set (VSA + Privacy + Cookie + AUP),
 * not the narrower activate/session gate set (VENUE_SUBSCRIPTION_LEGAL_TYPES).
 */
export const LEGAL_COMPLIANCE_TYPES_BY_SUBJECT: Record<
  LegalComplianceSubject,
  readonly LegalDocumentType[]
> = {
  venue: REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE.venue_owner,
  couple: REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE.couple,
  vendor: REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE.vendor,
};

/** Short operational labels for RW / CRM Legal summary. */
export const LEGAL_COMPLIANCE_TITLES: Partial<
  Record<LegalDocumentType, string>
> = {
  terms_of_service: "Venue Subscription Agreement",
  privacy_policy: "Privacy",
  cookie_policy: "Cookie",
  acceptable_use_policy: "Acceptable Use",
  couple_end_user_terms: "End User Terms",
  vendor_end_user_terms: "Vendor Terms",
};

export function legalTypesForPortal(
  portal: AuthenticatedLegalPortal,
): readonly LegalDocumentType[] {
  return portal === "vendor"
    ? VENDOR_PORTAL_LEGAL_TYPES
    : VENUE_APP_LEGAL_TYPES;
}

export function isLegalComplianceSubject(
  value: string,
): value is LegalComplianceSubject {
  return value === "venue" || value === "couple" || value === "vendor";
}

function complianceTitle(documentType: LegalDocumentType): string {
  return (
    LEGAL_COMPLIANCE_TITLES[documentType] ??
    LEGAL_DOCUMENT_TYPE_TITLES[documentType]
  );
}

function resolveComplianceStatus(
  acceptance: LegalAcceptance | null,
  active: LegalDocument | null,
): LegalComplianceStatus {
  if (!acceptance) return "not_accepted";
  if (!active) return "outdated";
  return hasCurrentVersionAcceptance(acceptance, active)
    ? "current"
    : "outdated";
}

/**
 * Read-only compliance rows for a subject identity.
 * Looks up acceptances by userId and/or relationshipId (same OR match as gates).
 * When only email is provided, resolves auth.users id without creating a user.
 */
export async function getLegalComplianceSummary(input: {
  subject: LegalComplianceSubject;
  relationshipId?: string | null;
  email?: string | null;
  userId?: string | null;
}): Promise<LegalComplianceSummary> {
  const documentTypes = LEGAL_COMPLIANCE_TYPES_BY_SUBJECT[input.subject];
  if (!isSupabaseConfigured || documentTypes.length === 0) {
    return { subject: input.subject, rows: [] };
  }

  const admin = createAdminClient();
  let userId = input.userId?.trim() || null;
  const relationshipId = input.relationshipId?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  if (!userId && email) {
    userId = await findAuthUserIdByEmail(admin, email);
  }

  const rows: LegalComplianceRow[] = await Promise.all(
    documentTypes.map(async (documentType) => {
      const active = await getActiveLegalDocumentByType(admin, documentType);
      const acceptance =
        userId || relationshipId
          ? await getLatestLegalAcceptanceForDocumentType(admin, {
              documentType,
              userId,
              relationshipId,
            })
          : null;

      return {
        documentType,
        title: complianceTitle(documentType),
        activeVersion: active?.version ?? null,
        acceptedVersion: acceptance?.acceptedVersion ?? null,
        acceptedAt: acceptance?.acceptedAt ?? null,
        status: resolveComplianceStatus(acceptance, active),
      };
    }),
  );

  return { subject: input.subject, rows };
}

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return value in LEGAL_DOCUMENT_TYPE_TITLES;
}

function documentTitleForHistory(
  doc: LegalDocument | undefined,
): { documentType: LegalDocumentType | null; documentTitle: string } {
  if (doc) {
    return {
      documentType: doc.documentType,
      documentTitle:
        LEGAL_DOCUMENT_TYPE_TITLES[doc.documentType] ?? doc.title,
    };
  }
  return { documentType: null, documentTitle: "Legal document" };
}

/**
 * Read-only Legal History for the signed-in user (newest first).
 * Acceptances load under the user session (RLS). Document labels for
 * inactive historical versions resolve via service role (active-only SELECT
 * policy would otherwise hide titles). Never mutates.
 */
export async function listLegalAcceptancesForCurrentUser(
  scope: AuthSessionScope = "venue",
): Promise<
  LegalAcceptanceHistoryItem[]
> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient(scope);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const acceptances = await listLegalAcceptancesForUser(supabase, user.id);
  if (acceptances.length === 0) return [];

  const admin = createAdminClient();
  const docs = await getLegalDocumentsByIds(
    admin,
    acceptances.map((a) => a.legalDocumentId),
  );
  const byId = new Map(docs.map((d) => [d.id, d]));

  return acceptances.map((a) => {
    const { documentType, documentTitle } = documentTitleForHistory(
      byId.get(a.legalDocumentId),
    );
    return {
      id: a.id,
      documentType,
      documentTitle,
      acceptedVersion: a.acceptedVersion,
      acceptedAt: a.acceptedAt,
      acceptanceMethod: a.acceptanceMethod || DEFAULT_LEGAL_ACCEPTANCE_METHOD,
    };
  });
}

export async function getActiveLegalDocument(
  documentType: LegalDocumentType,
): Promise<LegalDocument | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  return getActiveLegalDocumentByType(supabase, documentType);
}

export async function getActiveLegalDocuments(
  types: readonly LegalDocumentType[],
): Promise<LegalDocument[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const results = await Promise.all(
    types.map((type) => getActiveLegalDocumentByType(supabase, type)),
  );
  return results.filter((doc): doc is LegalDocument => Boolean(doc));
}

export type RecordLegalAcceptanceInput = {
  userId: string;
  legalDocumentId: string;
  acceptedVersion: string;
  /** Required for new writes; column is NOT NULL with DB default for backfill. */
  acceptanceMethod: LegalAcceptanceMethod;
  relationshipId?: string | null;
  acceptedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Append-only acceptance writes (service role). Call after validating the
 * caller already accepted the active documents in the UI.
 * Never updates or deletes prior acceptance rows.
 */
export async function recordLegalAcceptances(
  inputs: RecordLegalAcceptanceInput[],
): Promise<LegalAcceptance[]> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  if (inputs.length === 0) return [];

  const admin = createAdminClient();
  const recorded: LegalAcceptance[] = [];
  for (const input of inputs) {
    recorded.push(await insertLegalAcceptance(admin, input));
  }
  return recorded;
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();

  // Prefer a direct Auth schema read (service role) over paginating listUsers.
  const { data, error } = await admin
    .schema("auth")
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (!error && data && typeof (data as { id?: string }).id === "string") {
    return (data as { id: string }).id;
  }
  if (error) {
    console.error("[legal] auth.users email lookup failed; falling back to listUsers", {
      message: error.message,
      code: (error as { code?: string }).code,
    });
  }

  // PostgREST may not expose auth.users — page Admin API (bounded) as fallback.
  for (let page = 1; page <= 10; page += 1) {
    const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) {
      console.error("[legal] listUsers fallback failed", listErr);
      return null;
    }
    const match = (listed.users ?? []).find(
      (u) => (u.email ?? "").trim().toLowerCase() === normalized,
    );
    if (match?.id) return match.id;
    if ((listed.users?.length ?? 0) < 200) break;
  }

  return null;
}

/**
 * Resolve auth.users id for an email (create confirmed shell user if missing).
 * Used when recording venue-subscription acceptances before/without a password.
 */
export async function resolveUserIdForEmail(email: string): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("A valid email is required to record legal acceptances.");
  }

  const admin = createAdminClient();
  const existingId = await findAuthUserIdByEmail(admin, normalized);
  if (existingId) return existingId;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
  });
  if (createErr) {
    if (createErr.message.toLowerCase().includes("already")) {
      const again = await findAuthUserIdByEmail(admin, normalized);
      if (again) return again;
    }
    throw createErr;
  }
  if (!created.user?.id) {
    throw new Error("Could not create auth user for legal acceptance.");
  }
  return created.user.id;
}

/**
 * Record Venue ToS + Privacy Policy acceptances for a subscriber email.
 * Loads currently active document rows (ids + versions) at write time.
 */
export async function recordVenueSubscriptionLegalAcceptances(input: {
  email: string;
  relationshipId?: string | null;
  acceptedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  acceptanceMethod?: LegalAcceptanceMethod;
}): Promise<LegalAcceptance[]> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const userId = await resolveUserIdForEmail(input.email);

  return recordActiveLegalAcceptancesForTypes({
    userId,
    documentTypes: VENUE_SUBSCRIPTION_LEGAL_TYPES,
    relationshipId: input.relationshipId,
    acceptedAt: input.acceptedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    acceptanceMethod: input.acceptanceMethod ?? "Venue Signup",
  });
}

export function clientRequestMeta(headersList: Headers): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwardedFor = headersList.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? forwardedFor.split(",")[0]?.trim() || null
    : headersList.get("x-real-ip")?.trim() || null;
  const userAgent = headersList.get("user-agent");
  return { ipAddress, userAgent: userAgent?.trim() || null };
}

export type CouplePortalLegalIdentity = {
  userId?: string | null;
  /** venue_customer_relationships.id when known, else clients.id. */
  relationshipId?: string | null;
  /** Used to resolve/create auth.users when userId is missing. */
  email?: string | null;
};

function toGateDocumentLink(doc: LegalDocument): LegalGateDocumentLink {
  return {
    id: doc.id,
    documentType: doc.documentType,
    title: doc.title,
    version: doc.version,
    path: publicPathForLegalDocumentType(doc.documentType),
  };
}

/**
 * Exact-version match: caller's latest accepted_version for this document_type
 * must equal the active document's version string.
 */
function hasCurrentVersionAcceptance(
  acceptance: LegalAcceptance | null,
  active: LegalDocument,
): boolean {
  if (!acceptance) return false;
  return acceptance.acceptedVersion === active.version;
}

/**
 * Compare required active document versions against the caller's latest
 * acceptances (append-only history). Exact string match on version.
 *
 * Missing active docs for a required type → needsAcceptance (cannot proceed).
 * No identity (userId / relationshipId) → needsAcceptance.
 */
export async function getLegalGateStatus(
  userId: string | null | undefined,
  documentTypes: readonly LegalDocumentType[],
  options?: { relationshipId?: string | null },
): Promise<LegalGateStatus> {
  if (!isSupabaseConfigured) {
    return { needsAcceptance: false, documents: [] };
  }
  if (documentTypes.length === 0) {
    return { needsAcceptance: false, documents: [] };
  }

  const admin = createAdminClient();
  const relationshipId = options?.relationshipId?.trim() || null;
  const uid = userId?.trim() || null;

  const activeDocs = await Promise.all(
    documentTypes.map((type) => getActiveLegalDocumentByType(admin, type)),
  );

  const documents: LegalGateDocumentLink[] = [];
  const acceptanceChecks = await Promise.all(
    documentTypes.map(async (type, i) => {
      const active = activeDocs[i];
      if (!active) return { active: null as LegalDocument | null, current: false };
      if (!uid && !relationshipId) {
        return { active, current: false };
      }
      const acceptance = await getLatestLegalAcceptanceForDocumentType(admin, {
        documentType: type,
        userId: uid,
        relationshipId,
      });
      return {
        active,
        current: hasCurrentVersionAcceptance(acceptance, active),
      };
    }),
  );

  let allCurrent = true;
  for (const check of acceptanceChecks) {
    if (!check.active) {
      allCurrent = false;
      continue;
    }
    documents.push(toGateDocumentLink(check.active));
    if (!check.current) allCurrent = false;
  }

  // Required docs missing entirely → still block (documents may be partial).
  if (documents.length !== documentTypes.length) {
    allCurrent = false;
  }

  return {
    needsAcceptance: !allCurrent,
    documents,
  };
}

/**
 * Append-only acceptances for the currently active versions of the given types.
 * Inserts only — never updates or deletes prior acceptance rows.
 * Defaults acceptanceMethod to Version Update when callers omit it (e.g. gate
 * re-accept after a new active version) so existing routes need no UX changes.
 */
export async function recordActiveLegalAcceptancesForTypes(input: {
  userId: string;
  documentTypes: readonly LegalDocumentType[];
  relationshipId?: string | null;
  acceptedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  acceptanceMethod?: LegalAcceptanceMethod;
}): Promise<LegalAcceptance[]> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  if (input.documentTypes.length === 0) return [];

  const acceptanceMethod =
    input.acceptanceMethod ?? DEFAULT_LEGAL_ACCEPTANCE_METHOD;

  const admin = createAdminClient();
  const activeDocs = await Promise.all(
    input.documentTypes.map((type) =>
      getActiveLegalDocumentByType(admin, type),
    ),
  );

  const missing = input.documentTypes.filter((_, i) => !activeDocs[i]);
  if (missing.length > 0) {
    throw new Error(
      `Active legal documents are required for: ${missing.join(", ")}.`,
    );
  }

  return recordLegalAcceptances(
    activeDocs.map((doc) => ({
      userId: input.userId,
      legalDocumentId: doc!.id,
      acceptedVersion: doc!.version,
      acceptanceMethod,
      relationshipId: input.relationshipId,
      acceptedAt: input.acceptedAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })),
  );
}

/**
 * True when the portal identity already accepted the currently active couple
 * terms + privacy versions. Missing active docs → treat as needing acceptance.
 */
export async function getCouplePortalLegalGateStatus(
  identity: CouplePortalLegalIdentity,
): Promise<CouplePortalLegalGateStatus> {
  if (!isSupabaseConfigured) {
    return { needsAcceptance: false, documents: [] };
  }

  const admin = createAdminClient();
  let userId = identity.userId?.trim() || null;
  const relationshipId = identity.relationshipId?.trim() || null;
  const email = identity.email?.trim().toLowerCase() || null;

  if (!userId && email) {
    userId = await findAuthUserIdByEmail(admin, email);
  }

  const status = await getLegalGateStatus(userId, COUPLE_PORTAL_LEGAL_TYPES, {
    relationshipId,
  });

  const documents = status.documents.filter(
    (d): d is CouplePortalLegalDocumentLink =>
      d.documentType === "couple_end_user_terms" ||
      d.documentType === "privacy_policy",
  );

  // Missing active versions → empty documents. Do not soft-block Welcome with
  // a Continue that cannot record anything (WP3/WP4 couple portal).
  return {
    needsAcceptance: status.needsAcceptance && documents.length > 0,
    documents,
  };
}

/**
 * Record Couple End User Terms + Privacy for a portal identity (service role).
 * Resolves/creates auth.users from email when userId is not provided.
 */
export async function recordCouplePortalLegalAcceptances(input: {
  userId?: string | null;
  email?: string | null;
  relationshipId?: string | null;
  acceptedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  acceptanceMethod?: LegalAcceptanceMethod;
}): Promise<LegalAcceptance[]> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  let userId = input.userId?.trim() || null;
  if (!userId) {
    const email = input.email?.trim().toLowerCase() || "";
    if (!email) {
      throw new Error(
        "A signed-in user or email is required to record legal acceptances.",
      );
    }
    userId = await resolveUserIdForEmail(email);
  }

  return recordActiveLegalAcceptancesForTypes({
    userId,
    documentTypes: COUPLE_PORTAL_LEGAL_TYPES,
    relationshipId: input.relationshipId,
    acceptedAt: input.acceptedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    acceptanceMethod: input.acceptanceMethod ?? "Couple Invitation",
  });
}

/**
 * Resolve couple portal legal identity from a portal access token.
 * relationship_id prefers clients.relationship_id, else clients.id.
 */
export async function resolveCouplePortalLegalIdentity(
  token: string,
): Promise<CouplePortalLegalIdentity | null> {
  if (!isSupabaseConfigured || !token.trim()) return null;

  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("client_portal_sessions")
    .select("client_id, client_user_id, participant_id, contact_id")
    .eq("access_token", token)
    .maybeSingle<{
      client_id: string;
      client_user_id: string | null;
      participant_id: string | null;
      contact_id: string | null;
    }>();

  if (sessionError) throw sessionError;
  if (!session) return null;

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, email, partner_email, relationship_id")
    .eq("id", session.client_id)
    .maybeSingle<{
      id: string;
      email: string | null;
      partner_email: string | null;
      relationship_id: string | null;
    }>();

  if (clientError) throw clientError;
  if (!client) return null;

  let email = client.email?.trim().toLowerCase() || null;
  let userId = session.client_user_id?.trim() || null;

  // Prefer signed-in auth user when available.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      userId = user.id;
      if (user.email) email = user.email.trim().toLowerCase();
    }
  } catch {
    // Portal tokens work without a browser auth session.
  }

  if (!email && session.participant_id) {
    const { data: participant } = await admin
      .from("couple_portal_participants")
      .select("email")
      .eq("id", session.participant_id)
      .maybeSingle<{ email: string | null }>();
    email = participant?.email?.trim().toLowerCase() || null;
  }

  if (!email && session.contact_id) {
    const { data: contact } = await admin
      .from("client_contacts")
      .select("email")
      .eq("id", session.contact_id)
      .maybeSingle<{ email: string | null }>();
    email = contact?.email?.trim().toLowerCase() || null;
  }

  if (!email) {
    email = client.partner_email?.trim().toLowerCase() || null;
  }

  return {
    userId,
    email,
    relationshipId: client.relationship_id ?? client.id,
  };
}

// ---- HQ authoring (owner / super_admin via requireLegalAdminUser) ----------

export type LegalAdminActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/** One summary row per document type for the HQ Legal table. */
export async function getLegalDocumentTypeSummariesForAdmin(): Promise<
  LegalDocumentTypeSummary[]
> {
  const actor = await requireLegalAdminUser();
  if (!actor || !isSupabaseConfigured) return [];

  const supabase = await createClient();
  const all = await listAllLegalDocuments(supabase);
  const byType = new Map<LegalDocumentType, LegalDocument[]>();
  for (const doc of all) {
    const list = byType.get(doc.documentType) ?? [];
    list.push(doc);
    byType.set(doc.documentType, list);
  }

  return LEGAL_DOCUMENT_TYPES.map((documentType) => {
    const versions = byType.get(documentType) ?? [];
    return {
      documentType,
      title: LEGAL_DOCUMENT_TYPE_TITLES[documentType],
      current: pickCurrentLegalVersion(versions),
      activeCount: versions.filter((v) => v.isActive).length,
      versionCount: versions.length,
    };
  });
}

export async function getLegalDocumentsForTypeForAdmin(
  documentType: LegalDocumentType,
): Promise<LegalDocument[]> {
  const actor = await requireLegalAdminUser();
  if (!actor || !isSupabaseConfigured) return [];
  const supabase = await createClient();
  return listLegalDocumentsByType(supabase, documentType);
}

export async function getLegalDocumentForAdmin(
  id: string,
): Promise<LegalDocument | null> {
  const actor = await requireLegalAdminUser();
  if (!actor || !isSupabaseConfigured) return null;
  const supabase = await createClient();
  return getLegalDocumentById(supabase, id);
}

/**
 * Append a new inactive version. Never updates an existing row's content.
 */
export async function createLegalDocumentVersion(
  input: CreateLegalDocumentVersionInput,
): Promise<LegalAdminActionResult> {
  const actor = await requireLegalAdminUser();
  if (!actor) {
    return {
      ok: false,
      message: "Not signed in as an HQ Legal admin (Owner / Super Admin).",
    };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const documentType = input.documentType;
  if (!isLegalDocumentType(documentType)) {
    return { ok: false, message: "Invalid document type." };
  }

  const title =
    input.title.trim() || LEGAL_DOCUMENT_TYPE_TITLES[documentType];
  const version = input.version.trim();
  const effectiveDate = input.effectiveDate.trim();
  const content = input.content.trim();

  if (!version) return { ok: false, message: "Version is required." };
  if (!effectiveDate) {
    return { ok: false, message: "Effective date is required." };
  }
  if (!content) return { ok: false, message: "Content is required." };

  try {
    const supabase = await createClient();
    const created = await insertLegalDocumentVersion(supabase, {
      documentType,
      title,
      version,
      effectiveDate,
      content,
    });
    return { ok: true, id: created.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create legal version.";
    return { ok: false, message };
  }
}

/**
 * Activate a version: deactivate any other active row of the same type,
 * then set this row active. Content is never modified.
 * Sets published_by / published_at on first publish.
 */
export async function activateLegalDocumentVersion(
  id: string,
): Promise<LegalAdminActionResult> {
  const actor = await requireLegalAdminUser();
  if (!actor) {
    return {
      ok: false,
      message: "Not signed in as an HQ Legal admin (Owner / Super Admin).",
    };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Supabase is not configured." };
  }

  try {
    const supabase = await createClient();
    const doc = await getLegalDocumentById(supabase, id);
    if (!doc) return { ok: false, message: "Document version not found." };
    if (doc.isActive) return { ok: true, id };

    await deactivateActiveLegalDocumentsOfType(supabase, doc.documentType);
    await setLegalDocumentActive(supabase, id, true, {
      publishedBy: actor.userId,
    });
    return { ok: true, id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not activate version.";
    return { ok: false, message };
  }
}

/**
 * Mark a version inactive (no content change).
 * Refuses when this is the last/only active version for the type.
 */
export async function deactivateLegalDocumentVersion(
  id: string,
): Promise<LegalAdminActionResult> {
  const actor = await requireLegalAdminUser();
  if (!actor) {
    return {
      ok: false,
      message: "Not signed in as an HQ Legal admin (Owner / Super Admin).",
    };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Supabase is not configured." };
  }

  try {
    const supabase = await createClient();
    const doc = await getLegalDocumentById(supabase, id);
    if (!doc) return { ok: false, message: "Document version not found." };
    if (!doc.isActive) return { ok: true, id };

    const siblings = await listLegalDocumentsByType(supabase, doc.documentType);
    const activeCount = siblings.filter((v) => v.isActive).length;
    if (
      !canDeactivateLegalVersion({
        isActive: true,
        activeCountForType: activeCount,
      })
    ) {
      return {
        ok: false,
        message:
          "Cannot deactivate the only active version. Activate another version first.",
      };
    }

    await setLegalDocumentActive(supabase, id, false);
    return { ok: true, id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not deactivate version.";
    return { ok: false, message };
  }
}
