/**
 * HQ Legal Administration service (WP5). Server-only.
 * Uses requireLegalAdminUser (owner / super_admin) + service-role reads.
 * Does not modify the Legal Acceptance Engine core.
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  canAccessHqLegalAdmin,
  isHqLegalAdminRole,
} from "@/lib/hq/legal-access";
import { getHqAdmin } from "@/lib/hq/service";
import {
  buildOutstandingRowsForUser,
  computeLegalAdminDashboardSummary,
  documentTitleForType,
  filterHistoryRows,
  filterOutstandingRows,
  pickCurrentLegalVersion,
  type LegalAdminDashboardSummary,
  type LegalAdminHistoryRow,
  type LegalAdminListFilters,
  type LegalAdminOutstandingRow,
  type LegalAdminVersionHistoryRow,
} from "@/lib/legal/admin-helpers";
import { mapStaffRoleToLegalUserType } from "@/lib/legal/welcome-integration";
import {
  countAcceptancesByDocumentIds,
  getLegalDocumentById,
  listAllLegalDocuments,
  listLegalAcceptancesPage,
  listLegalDocumentsByType,
} from "@/lib/legal/repository";
import {
  LEGAL_ACCEPTANCE_USER_TYPE_LABELS,
  getRequiredDocumentTypes,
  type LegalAcceptanceUserType,
} from "@/lib/legal/required-documents";
import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_TYPE_TITLES,
  type LegalDocument,
  type LegalDocumentType,
  type LegalDocumentTypeSummary,
} from "@/lib/legal/types";

function isLegalDocumentType(value: string): value is LegalDocumentType {
  return (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export type { LegalAdminDashboardSummary, LegalAdminHistoryRow, LegalAdminOutstandingRow, LegalAdminVersionHistoryRow };

/** HQ owner (or super_admin) for Legal Administration, or null. */
export async function requireLegalAdminUser(): Promise<{
  userId: string;
  name: string;
  role: string;
} | null> {
  if (!isSupabaseConfigured) return null;
  const admin = await getHqAdmin();
  if (!canAccessHqLegalAdmin(admin)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    userId: user.id,
    name: user.email ?? "Hello to Cheers team",
    role: admin!.role,
  };
}

export { canAccessHqLegalAdmin, isHqLegalAdminRole };

function emptyDashboard(): LegalAdminDashboardSummary {
  return {
    currentLegalDocuments: 0,
    totalDocumentVersions: 0,
    outstandingAcceptances: 0,
    acceptanceRatePercent: null,
  };
}

async function loadActiveByType(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Partial<Record<LegalDocumentType, LegalDocument>>> {
  const all = await listAllLegalDocuments(admin);
  const map: Partial<Record<LegalDocumentType, LegalDocument>> = {};
  for (const doc of all) {
    if (doc.isActive) map[doc.documentType] = doc;
  }
  return map;
}

type ProfileHint = {
  userId: string;
  userLabel: string;
  role: LegalAcceptanceUserType;
  venueId: string | null;
  venueLabel: string;
  relationshipId: string | null;
  relationshipLabel: string;
};

async function loadProfileHints(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, ProfileHint>> {
  const hints = new Map<string, ProfileHint>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return hints;

  const { data: staffRows } = await admin
    .from("venue_staff")
    .select("user_id, full_name, email, role, venue_id, is_active")
    .in("user_id", unique)
    .eq("is_active", true);

  const venueIds = new Set<string>();
  for (const row of staffRows ?? []) {
    const r = row as {
      user_id: string | null;
      full_name: string | null;
      email: string | null;
      role: string | null;
      venue_id: string | null;
    };
    if (!r.user_id) continue;
    if (r.venue_id) venueIds.add(r.venue_id);
    const role = mapStaffRoleToLegalUserType(r.role);
    hints.set(r.user_id, {
      userId: r.user_id,
      userLabel: r.full_name?.trim() || r.email?.trim() || r.user_id,
      role,
      venueId: r.venue_id,
      venueLabel: "—",
      relationshipId: null,
      relationshipLabel: "—",
    });
  }

  const { data: vendorUsers } = await admin
    .from("vendor_users")
    .select("user_id, vendor_id, is_active")
    .in("user_id", unique)
    .eq("is_active", true);

  const vendorIds = [
    ...new Set(
      (vendorUsers ?? [])
        .map((r) => (r as { vendor_id?: string }).vendor_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const vendorNameById = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vendors } = await admin
      .from("vendors")
      .select("id, business_name, name")
      .in("id", vendorIds);
    for (const v of vendors ?? []) {
      const row = v as {
        id: string;
        business_name?: string | null;
        name?: string | null;
      };
      vendorNameById.set(
        row.id,
        row.business_name?.trim() || row.name?.trim() || row.id,
      );
    }
  }

  for (const row of vendorUsers ?? []) {
    const r = row as { user_id: string; vendor_id: string };
    if (hints.has(r.user_id)) continue;
    const label = vendorNameById.get(r.vendor_id) ?? r.user_id;
    hints.set(r.user_id, {
      userId: r.user_id,
      userLabel: label,
      role: "vendor",
      venueId: null,
      venueLabel: "—",
      relationshipId: null,
      relationshipLabel: label,
    });
  }

  if (venueIds.size > 0) {
    const { data: venues } = await admin
      .from("venues")
      .select("id, name")
      .in("id", [...venueIds]);
    const nameById = new Map(
      (venues ?? []).map((v) => {
        const row = v as { id: string; name: string | null };
        return [row.id, row.name?.trim() || row.id] as const;
      }),
    );
    for (const hint of hints.values()) {
      if (hint.venueId && nameById.has(hint.venueId)) {
        hint.venueLabel = nameById.get(hint.venueId)!;
      }
    }
  }

  return hints;
}

async function resolveRelationshipLabels(
  admin: ReturnType<typeof createAdminClient>,
  relationshipIds: string[],
): Promise<Map<string, { label: string; venueId: string | null; venueLabel: string }>> {
  const map = new Map<
    string,
    { label: string; venueId: string | null; venueLabel: string }
  >();
  const unique = [...new Set(relationshipIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: clients } = await admin
    .from("clients")
    .select(
      "id, relationship_id, venue_id, first_name, last_name, partner_first_name, partner_last_name",
    )
    .in("relationship_id", unique);

  const venueIds = new Set<string>();
  for (const c of clients ?? []) {
    const row = c as {
      relationship_id: string | null;
      venue_id: string | null;
      first_name: string | null;
      last_name: string | null;
      partner_first_name: string | null;
      partner_last_name: string | null;
    };
    if (!row.relationship_id) continue;
    if (row.venue_id) venueIds.add(row.venue_id);
    const a = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    const b = [row.partner_first_name, row.partner_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const label = [a, b].filter(Boolean).join(" & ") || row.relationship_id;
    map.set(row.relationship_id, {
      label,
      venueId: row.venue_id,
      venueLabel: "—",
    });
  }

  if (venueIds.size > 0) {
    const { data: venues } = await admin
      .from("venues")
      .select("id, name")
      .in("id", [...venueIds]);
    const nameById = new Map(
      (venues ?? []).map((v) => {
        const row = v as { id: string; name: string | null };
        return [row.id, row.name?.trim() || row.id] as const;
      }),
    );
    for (const entry of map.values()) {
      if (entry.venueId && nameById.has(entry.venueId)) {
        entry.venueLabel = nameById.get(entry.venueId)!;
      }
    }
  }

  return map;
}

function inferRoleFromMethod(
  method: string | null | undefined,
  fallback: LegalAcceptanceUserType,
): LegalAcceptanceUserType {
  const m = (method ?? "").toLowerCase();
  if (m.includes("couple")) return "couple";
  if (m.includes("vendor")) return "vendor";
  if (m.includes("venue")) return "venue_owner";
  return fallback;
}

async function buildOutstandingRaw(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{
  outstanding: LegalAdminOutstandingRow[];
  currentCount: number;
  trackedCount: number;
}> {
  const activeByType = await loadActiveByType(admin);
  const activeVersionByType: Partial<
    Record<LegalDocumentType, { version: string }>
  > = {};
  for (const [type, doc] of Object.entries(activeByType) as [
    LegalDocumentType,
    LegalDocument,
  ][]) {
    activeVersionByType[type] = { version: doc.version };
  }

  // MVP: scan recent acceptances + known profile tables.
  const acceptances = await listLegalAcceptancesPage(admin, {
    limit: 1000,
    offset: 0,
  });

  const { data: staffAll } = await admin
    .from("venue_staff")
    .select("user_id")
    .eq("is_active", true)
    .not("user_id", "is", null)
    .limit(500);
  const { data: vendorAll } = await admin
    .from("vendor_users")
    .select("user_id")
    .eq("is_active", true)
    .limit(500);

  const candidateIds = new Set<string>();
  for (const a of acceptances) candidateIds.add(a.userId);
  for (const s of staffAll ?? []) {
    const id = (s as { user_id?: string | null }).user_id;
    if (id) candidateIds.add(id);
  }
  for (const v of vendorAll ?? []) {
    const id = (v as { user_id?: string }).user_id;
    if (id) candidateIds.add(id);
  }

  const hints = await loadProfileHints(admin, [...candidateIds]);

  // Latest accepted version per user + document type
  const latestByUserType = new Map<string, string>();
  const latestMethodByUser = new Map<string, string>();
  const latestRelByUser = new Map<string, string | null>();
  const docTypeById = new Map<string, LegalDocumentType>();

  const docIds = [...new Set(acceptances.map((a) => a.legalDocumentId))];
  if (docIds.length > 0) {
    const { data: docs } = await admin
      .from("legal_documents")
      .select("id, document_type")
      .in("id", docIds);
    for (const d of docs ?? []) {
      const row = d as { id: string; document_type: string };
      if (isLegalDocumentType(row.document_type)) {
        docTypeById.set(row.id, row.document_type);
      }
    }
  }

  // acceptances are newest-first
  for (const a of acceptances) {
    const docType = docTypeById.get(a.legalDocumentId);
    if (!docType) continue;
    const key = `${a.userId}::${docType}`;
    if (!latestByUserType.has(key)) {
      latestByUserType.set(key, a.acceptedVersion);
    }
    if (!latestMethodByUser.has(a.userId)) {
      latestMethodByUser.set(a.userId, a.acceptanceMethod);
      latestRelByUser.set(a.userId, a.relationshipId);
    }
  }

  const relIds = [
    ...new Set(
      [...latestRelByUser.values()].filter((id): id is string => Boolean(id)),
    ),
  ];
  const relMap = await resolveRelationshipLabels(admin, relIds);

  // Last login — best-effort sample for candidates we already track.
  const lastLogin = new Map<string, string | null>();
  const sample = [...candidateIds].slice(0, 80);
  await Promise.all(
    sample.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        lastLogin.set(
          userId,
          data.user?.last_sign_in_at ?? data.user?.created_at ?? null,
        );
      } catch {
        lastLogin.set(userId, null);
      }
    }),
  );

  const outstanding: LegalAdminOutstandingRow[] = [];
  let currentCount = 0;
  let trackedCount = 0;

  for (const userId of candidateIds) {
    const hint = hints.get(userId);
    const method = latestMethodByUser.get(userId);
    const role =
      hint?.role ??
      inferRoleFromMethod(method, "venue_owner");
    const relId = hint?.relationshipId ?? latestRelByUser.get(userId) ?? null;
    const relInfo = relId ? relMap.get(relId) : undefined;

    const acceptedByType: Partial<Record<LegalDocumentType, string>> = {};
    for (const [key, version] of latestByUserType) {
      if (!key.startsWith(`${userId}::`)) continue;
      const type = key.slice(userId.length + 2) as LegalDocumentType;
      acceptedByType[type] = version;
    }

    const rows = buildOutstandingRowsForUser({
      userId,
      userLabel: hint?.userLabel ?? userId,
      role,
      relationshipId: relId,
      relationshipLabel:
        hint?.relationshipLabel !== "—"
          ? hint?.relationshipLabel
          : relInfo?.label ?? "—",
      venueId: hint?.venueId ?? relInfo?.venueId ?? null,
      venueLabel:
        hint?.venueLabel !== "—"
          ? hint?.venueLabel ?? "—"
          : relInfo?.venueLabel ?? "—",
      lastLoginAt: lastLogin.get(userId) ?? null,
      activeByType: activeVersionByType,
      acceptedByType,
    });

    // Tracked = required docs for this user (for acceptance rate).
    const required = getRequiredDocumentTypes(role).length;
    trackedCount += required;
    currentCount += required - rows.length;
    outstanding.push(...rows);
  }

  return { outstanding, currentCount, trackedCount };
}

export async function getLegalAdminDashboard(): Promise<{
  summary: LegalAdminDashboardSummary;
  documents: LegalDocumentTypeSummary[];
}> {
  const actor = await requireLegalAdminUser();
  if (!actor || !isSupabaseConfigured) {
    return { summary: emptyDashboard(), documents: [] };
  }

  try {
    const admin = createAdminClient();
    const all = await listAllLegalDocuments(admin);
    const byType = new Map<LegalDocumentType, LegalDocument[]>();
    for (const doc of all) {
      const list = byType.get(doc.documentType) ?? [];
      list.push(doc);
      byType.set(doc.documentType, list);
    }

    const documents: LegalDocumentTypeSummary[] = LEGAL_DOCUMENT_TYPES.map(
      (documentType) => {
        const versions = byType.get(documentType) ?? [];
        return {
          documentType,
          title: LEGAL_DOCUMENT_TYPE_TITLES[documentType],
          current: pickCurrentLegalVersion(versions),
          activeCount: versions.filter((v) => v.isActive).length,
          versionCount: versions.length,
        };
      },
    );

    const { outstanding, currentCount, trackedCount } =
      await buildOutstandingRaw(admin);

    const summary = computeLegalAdminDashboardSummary({
      documentTypesWithActive: documents.filter((d) => d.activeCount > 0)
        .length,
      totalVersions: all.length,
      outstandingCount: outstanding.length,
      currentAcceptances: Math.max(currentCount, 0),
      totalTrackedAcceptances: trackedCount,
    });

    return { summary, documents };
  } catch {
    return { summary: emptyDashboard(), documents: [] };
  }
}

export async function getLegalDocumentTypeSummariesForLegalAdmin(): Promise<
  LegalDocumentTypeSummary[]
> {
  const { documents } = await getLegalAdminDashboard();
  return documents;
}

export async function getLegalVersionHistoryForAdmin(
  documentType: LegalDocumentType,
): Promise<LegalAdminVersionHistoryRow[]> {
  const actor = await requireLegalAdminUser();
  if (!actor || !isSupabaseConfigured) return [];

  try {
    const admin = createAdminClient();
    const versions = await listLegalDocumentsByType(admin, documentType);
    const counts = await countAcceptancesByDocumentIds(
      admin,
      versions.map((v) => v.id),
    );

    const publisherIds = [
      ...new Set(
        versions
          .map((v) => v.publishedBy)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const publisherLabels = new Map<string, string>();
    await Promise.all(
      publisherIds.map(async (id) => {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          publisherLabels.set(
            id,
            data.user?.email ?? data.user?.id ?? id,
          );
        } catch {
          publisherLabels.set(id, id);
        }
      }),
    );

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      effectiveDate: v.effectiveDate,
      publishedByLabel: v.publishedBy
        ? publisherLabels.get(v.publishedBy) ?? v.publishedBy
        : null,
      publishedAt: v.publishedAt,
      isActive: v.isActive,
      isPublished: v.isPublished,
      acceptanceCount: counts.get(v.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getLegalOutstandingAcceptancesForAdmin(
  filters: LegalAdminListFilters = {},
): Promise<LegalAdminOutstandingRow[]> {
  const actor = await requireLegalAdminUser();
  if (!actor || !isSupabaseConfigured) return [];

  try {
    const admin = createAdminClient();
    const { outstanding } = await buildOutstandingRaw(admin);
    return filterOutstandingRows(outstanding, filters);
  } catch {
    return [];
  }
}

export async function getLegalAcceptanceHistoryForAdmin(
  filters: LegalAdminListFilters = {},
): Promise<LegalAdminHistoryRow[]> {
  const actor = await requireLegalAdminUser();
  if (!actor || !isSupabaseConfigured) return [];

  try {
    const admin = createAdminClient();
    const acceptances = await listLegalAcceptancesPage(admin, {
      limit: 500,
      offset: 0,
    });

    const userIds = [...new Set(acceptances.map((a) => a.userId))];
    const hints = await loadProfileHints(admin, userIds);
    const relMap = await resolveRelationshipLabels(
      admin,
      acceptances
        .map((a) => a.relationshipId)
        .filter((id): id is string => Boolean(id)),
    );

    const docIds = [...new Set(acceptances.map((a) => a.legalDocumentId))];
    const docs =
      docIds.length > 0
        ? await Promise.all(
            docIds.map((id) => getLegalDocumentById(admin, id)),
          )
        : [];
    const docById = new Map(
      docs
        .filter((d): d is LegalDocument => Boolean(d))
        .map((d) => [d.id, d] as const),
    );

    const rows: LegalAdminHistoryRow[] = acceptances.map((a) => {
      const doc = docById.get(a.legalDocumentId) ?? null;
      const hint = hints.get(a.userId);
      const role =
        hint?.role ??
        inferRoleFromMethod(a.acceptanceMethod, "venue_owner");
      const rel = a.relationshipId
        ? relMap.get(a.relationshipId)
        : undefined;
      return {
        id: a.id,
        acceptedAt: a.acceptedAt,
        userId: a.userId,
        userLabel: hint?.userLabel ?? a.userId,
        roleLabel: LEGAL_ACCEPTANCE_USER_TYPE_LABELS[role],
        relationshipId: a.relationshipId,
        relationshipLabel: rel?.label ?? hint?.relationshipLabel ?? "—",
        documentType: doc?.documentType ?? null,
        documentTitle: documentTitleForType(doc?.documentType, doc?.title),
        acceptedVersion: a.acceptedVersion,
        acceptanceMethod: a.acceptanceMethod,
        ipAddress: a.ipAddress,
      };
    });

    return filterHistoryRows(rows, filters);
  } catch {
    return [];
  }
}
