/**
 * Venue-controlled Vendor import matching.
 *
 * Email, business name, phone, and website are signals — not proof. The
 * only automatic skip is a proven retry on this venue's relationship:
 * matching source Vendor ID with an identical fingerprint.
 *
 * Does not expose another venue's private relationship notes or preference.
 */
import type { PersonMatchAction, PersonMatchKind } from "@/lib/import/match-policy";
import type { ImportFieldDifference, VenueControlledMatch } from "@/lib/import/venue-controlled-match";
import { resolveImportMatchAction, venueMatchSkipMessage } from "@/lib/import/venue-controlled-match";

function norm(value: string | number | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function host(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "");
  }
}

function show(value: string | number | null | undefined): string {
  const t = String(value ?? "").trim();
  return t || "—";
}

export type VendorMatchRecord = {
  vendorId: string;
  relationshipId: string | null;
  connectedToThisVenue: boolean;
  businessName: string;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  contactName: string | null;
  isClaimed: boolean;
  sourceVendorId: string | null;
  importFingerprint: string | null;
  fileRow?: number | null;
};

export type IncomingVendor = {
  businessName: string;
  email?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  contactName?: string | null;
  category?: string | null;
  notes?: string | null;
  sourceVendorId?: string | null;
};

export type VendorMatch = VenueControlledMatch & {
  matchedVendorId: string | null;
  connectedToThisVenue: boolean;
  isClaimed: boolean;
  ambiguous: boolean;
};

export function vendorImportFingerprint(input: IncomingVendor): string {
  return [
    `vid:${norm(input.sourceVendorId)}`,
    `n:${norm(input.businessName)}|${norm(input.email)}|${norm(input.phone)}`,
    `w:${host(input.websiteUrl)}|${norm(input.contactName)}|${norm(input.category)}`,
  ].join("::");
}

export function vendorSourceData(input: IncomingVendor): Record<string, unknown> {
  const data: Record<string, unknown> = { import_fingerprint: vendorImportFingerprint(input) };
  if (input.sourceVendorId?.trim()) data.source_vendor_id = input.sourceVendorId.trim();
  return data;
}

export function sourceVendorIdFromData(sourceData: Record<string, unknown> | null | undefined): string | null {
  const value = sourceData?.source_vendor_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function importFingerprintFromData(sourceData: Record<string, unknown> | null | undefined): string | null {
  const value = sourceData?.import_fingerprint;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function differences(incoming: IncomingVendor, matched: VendorMatchRecord): ImportFieldDifference[] {
  const rows: Array<[string, string | null | undefined, string | null | undefined]> = [
    ["Business name", incoming.businessName, matched.businessName],
    ["Email", incoming.email, matched.email],
    ["Phone", incoming.phone, matched.phone],
    ["Website", incoming.websiteUrl, matched.websiteUrl],
    ["Contact", incoming.contactName, matched.contactName],
  ];
  return rows
    .filter(([, incomingValue, existing]) => show(incomingValue) !== show(existing))
    .map(([label, incomingValue, existing]) => ({
      label,
      incoming: show(incomingValue),
      existing: show(existing),
    }));
}

function result(partial: Omit<VendorMatch, "matchedPhone" | "matchedSalesStage" | "matchedEventDate" | "fileMatchRow" | "inquiryNotes" | "relationshipId"> & {
  inquiryNotes?: string[];
  fileMatchRow?: number | null;
  relationshipId?: string | null;
}): VendorMatch {
  return {
    matchedPhone: null,
    matchedSalesStage: null,
    matchedEventDate: null,
    fileMatchRow: partial.fileMatchRow ?? null,
    inquiryNotes: partial.inquiryNotes ?? [],
    relationshipId: partial.relationshipId ?? null,
    ...partial,
  };
}

function score(incoming: IncomingVendor, row: VendorMatchRecord): number {
  let n = 0;
  if (norm(incoming.email) && norm(incoming.email) === norm(row.email)) n += 4;
  if (norm(incoming.businessName) && norm(incoming.businessName) === norm(row.businessName)) n += 3;
  if (norm(incoming.phone) && norm(incoming.phone) === norm(row.phone)) n += 2;
  if (host(incoming.websiteUrl) && host(incoming.websiteUrl) === host(row.websiteUrl)) n += 2;
  if (norm(incoming.contactName) && norm(incoming.contactName) === norm(row.contactName)) n += 1;
  return n;
}

export function classifyVendorMatch(
  incoming: IncomingVendor,
  existing: readonly VendorMatchRecord[],
  priorInFile: readonly VendorMatchRecord[] = [],
): VendorMatch {
  const sourceVendorId = incoming.sourceVendorId?.trim() || null;
  const fingerprint = vendorImportFingerprint(incoming);
  const all = [...existing, ...priorInFile];

  const proven = all.find((row) => {
    if (!row.connectedToThisVenue && !row.fileRow) return false;
    if (sourceVendorId && row.sourceVendorId && sourceVendorId === row.sourceVendorId) return true;
    return Boolean(row.importFingerprint && row.importFingerprint === fingerprint);
  });
  if (proven && proven.importFingerprint === fingerprint) {
    return result({
      kind: "exact",
      reason: "This vendor relationship is already in Hello to Cheers. We will skip it so nothing is duplicated or overwritten.",
      defaultAction: "skip",
      needsReview: false,
      alreadyImported: true,
      changedSinceImport: false,
      matchedId: proven.vendorId,
      matchedVendorId: proven.vendorId,
      matchedName: proven.businessName,
      matchedEmail: proven.email,
      connectedToThisVenue: proven.connectedToThisVenue,
      isClaimed: proven.isClaimed,
      ambiguous: false,
      signals: ["inquiry_text"],
      differences: [],
      inquiryNotes: ["Already imported"],
      fileMatchRow: proven.fileRow ?? null,
      relationshipId: proven.relationshipId,
    });
  }
  if (proven && sourceVendorId && proven.sourceVendorId === sourceVendorId) {
    return result({
      kind: "exact",
      reason: "This looks like a vendor you already brought in, with updated details. Same Vendor keeps the existing relationship.",
      defaultAction: "use_existing",
      needsReview: true,
      alreadyImported: false,
      changedSinceImport: true,
      matchedId: proven.vendorId,
      matchedVendorId: proven.vendorId,
      matchedName: proven.businessName,
      matchedEmail: proven.email,
      connectedToThisVenue: proven.connectedToThisVenue,
      isClaimed: proven.isClaimed,
      ambiguous: false,
      signals: ["inquiry_text"],
      differences: differences(incoming, proven),
      inquiryNotes: ["Matching source Vendor ID", "Details have changed"],
      fileMatchRow: proven.fileRow ?? null,
      relationshipId: proven.relationshipId,
    });
  }

  const scored = all
    .map((row) => ({ row, score: score(incoming, row) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.row.connectedToThisVenue) - Number(a.row.connectedToThisVenue));

  if (scored.length === 0) {
    return result({
      kind: "new",
      reason: "No matching vendor in Hello to Cheers.",
      defaultAction: "create_new",
      needsReview: false,
      alreadyImported: false,
      changedSinceImport: false,
      matchedId: null,
      matchedVendorId: null,
      matchedName: null,
      matchedEmail: null,
      connectedToThisVenue: false,
      isClaimed: false,
      ambiguous: false,
      signals: [],
      differences: [],
    });
  }

  const top = scored[0]!;
  const tied = scored.filter((item) => item.score === top.score && item.row.vendorId !== top.row.vendorId);
  const ambiguous = tied.length > 0;
  const match = top.row;
  const kind: PersonMatchKind = top.score >= 7 ? "exact" : "likely";
  const notes: string[] = [];
  if (norm(incoming.email) && norm(incoming.email) === norm(match.email)) {
    notes.push("Matching email — email alone does not prove this is the same vendor");
  }
  if (norm(incoming.businessName) && norm(incoming.businessName) === norm(match.businessName)) {
    notes.push("Matching business name — a name alone does not prove this is the same vendor");
  }
  if (host(incoming.websiteUrl) && host(incoming.websiteUrl) === host(match.websiteUrl)) {
    notes.push("Matching website");
  }
  if (match.connectedToThisVenue) notes.push("Already connected to this venue");
  else notes.push("Known in Hello to Cheers, not yet connected to this venue");
  if (ambiguous) notes.push("More than one possible match — Hello to Cheers will not guess");
  if (match.isClaimed) notes.push("This vendor has claimed their profile. Import will not change their business details.");

  return result({
    kind,
    reason: ambiguous
      ? "Several possible vendor matches. Choose Different Vendor only if this is truly a new business, or Don't import until you can confirm."
      : "Possible vendor match. Choose whether this is the same vendor, a different vendor, or something to leave out.",
    defaultAction: "skip",
    needsReview: true,
    alreadyImported: false,
    changedSinceImport: false,
    matchedId: ambiguous ? null : match.vendorId,
    matchedVendorId: ambiguous ? null : match.vendorId,
    matchedName: ambiguous ? null : match.businessName,
    matchedEmail: ambiguous ? null : match.email,
    connectedToThisVenue: ambiguous ? false : match.connectedToThisVenue,
    isClaimed: match.isClaimed,
    ambiguous,
    signals: top.score >= 4 ? ["email"] : ["name_pair"],
    differences: ambiguous ? [] : differences(incoming, match),
    inquiryNotes: notes,
    fileMatchRow: match.fileRow ?? null,
    relationshipId: ambiguous ? null : match.relationshipId,
  });
}

export function incomingVendorFromInput(input: IncomingVendor): IncomingVendor {
  return {
    businessName: input.businessName,
    email: input.email ?? "",
    phone: input.phone ?? "",
    websiteUrl: input.websiteUrl ?? "",
    contactName: input.contactName ?? "",
    category: input.category ?? "",
    notes: input.notes ?? "",
    sourceVendorId: input.sourceVendorId ?? "",
  };
}

export function importMatchRecordFromIncomingVendor(
  incoming: IncomingVendor,
  fileRow: number,
): VendorMatchRecord {
  return {
    vendorId: `file-${fileRow}`,
    relationshipId: null,
    connectedToThisVenue: true,
    businessName: incoming.businessName,
    email: incoming.email ?? null,
    phone: incoming.phone ?? null,
    websiteUrl: incoming.websiteUrl ?? null,
    contactName: incoming.contactName ?? null,
    isClaimed: false,
    sourceVendorId: incoming.sourceVendorId?.trim() || null,
    importFingerprint: vendorImportFingerprint(incoming),
    fileRow,
  };
}

export function rememberCreatedImportVendor(
  existing: VendorMatchRecord[],
  incoming: IncomingVendor,
  fileRow: number,
  vendorId: string,
  relationshipId: string | null,
  connectedToThisVenue = true,
): VendorMatchRecord {
  const remembered = {
    ...importMatchRecordFromIncomingVendor(incoming, fileRow),
    vendorId,
    relationshipId,
    connectedToThisVenue,
  };
  existing.push(remembered);
  return remembered;
}

export function isPersistedVendorId(id: string | null | undefined): boolean {
  return Boolean(
    id
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  );
}

/**
 * Same Vendor requires a confirmed, still-valid vendor. Ambiguous or vanished
 * matches stay held instead of attaching a different global vendor.
 */
export function resolveConfirmedVendorAction(
  match: VendorMatch,
  requested: PersonMatchAction | null,
): PersonMatchAction | "held" {
  if (requested === "use_existing" && (match.ambiguous || match.kind === "new" || !match.matchedVendorId)) {
    return "held";
  }
  if (requested === "use_existing" && !isPersistedVendorId(match.matchedVendorId)) {
    return "held";
  }
  if (requested === "create_same_person") {
    return match.matchedVendorId && isPersistedVendorId(match.matchedVendorId) ? "use_existing" : "held";
  }
  return resolveImportMatchAction(match, requested);
}

export function vendorMatchSkipMessage(
  match: VendorMatch,
  action: PersonMatchAction | "held",
): string {
  if (action === "use_existing") {
    return match.connectedToThisVenue
      ? "Used the vendor relationship already in Hello to Cheers. Nothing was overwritten."
      : "Connected this venue to the existing vendor. Their claimed profile was not changed.";
  }
  if (match.alreadyImported) {
    return "This vendor is already in your directory. No second relationship was created.";
  }
  return venueMatchSkipMessage(match, action);
}
