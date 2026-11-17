/**
 * Venue-controlled import matching.
 *
 * Reuses lib/leads/duplicate-detection signals. Matching is evidence for a
 * review queue — never permission to merge, skip, or create automatically.
 * The only automatic skip is a proven retry: the same venue, same record
 * type, and a stored source-system record ID or an identical previously
 * accepted import fingerprint.
 */
import {
  normalizeEmail,
  signalLabel,
  signalsAgainstRecord,
  type DuplicateCandidate,
  type DuplicateSignal,
  type InquiryIdentity,
} from "@/lib/leads/duplicate-detection";
import type { IdentityDecision } from "@/lib/identity/decision";
import type { PersonMatchAction, PersonMatchKind } from "@/lib/import/match-policy";

function norm(value: string | number | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function preferredDate(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, 10);
}

export type ImportMatchRecord = {
  leadId: string | null;
  clientId: string | null;
  relationshipId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  partnerEmail: string | null;
  inquiryMessage: string | null;
  eventDate: string | null;
  eventType: string | null;
  salesStage: string | null;
  guestCount: string | number | null;
  source: string | null;
  followUpDate: string | null;
  nextActionText: string | null;
  estimatedBudget: string | number | null;
  sourceRecordId: string | null;
  importFingerprint: string | null;
  fileRow?: number | null;
};

export type IncomingImportPerson = InquiryIdentity & {
  eventDate?: string | null;
  eventType?: string | null;
  guestCount?: string | number | null;
  source?: string | null;
  originalSourceLabel?: string | null;
  followUpDate?: string | null;
  nextActionText?: string | null;
  dateFlexibility?: string | null;
  salesStage?: string | null;
  estimatedBudget?: string | number | null;
  sourceRecordId?: string | null;
};

export type ImportFieldDifference = {
  label: string;
  incoming: string;
  existing: string;
};

export type VenueControlledMatch = {
  kind: PersonMatchKind;
  reason: string;
  defaultAction: PersonMatchAction;
  needsReview: boolean;
  alreadyImported: boolean;
  matchedId: string | null;
  matchedName: string | null;
  matchedEmail: string | null;
  matchedPhone: string | null;
  matchedEventDate: string | null;
  matchedSalesStage: string | null;
  relationshipId: string | null;
  signals: DuplicateSignal[];
  inquiryNotes: string[];
  differences: ImportFieldDifference[];
  fileMatchRow: number | null;
  changedSinceImport: boolean;
};

function displayName(row: Pick<ImportMatchRecord, "firstName" | "lastName" | "partnerFirstName" | "partnerLastName">): string {
  const primary = `${row.firstName} ${row.lastName}`.trim();
  const partner = `${row.partnerFirstName ?? ""} ${row.partnerLastName ?? ""}`.trim();
  return partner ? `${primary} & ${partner}` : primary;
}

function show(value: string | number | null | undefined): string {
  const t = String(value ?? "").trim();
  return t || "—";
}

/**
 * Durable snapshot of an accepted import row. Stored on leads.source_data.
 * An identical snapshot at the same venue is a proven retry.
 */
export function leadImportFingerprint(input: IncomingImportPerson): string {
  return [
    `rid:${norm(input.sourceRecordId)}`,
    `n:${norm(input.firstName)}|${norm(input.lastName)}|${norm(input.email)}|${norm(input.phone)}`,
    `p:${norm(input.partnerFirstName)}|${norm(input.partnerLastName)}|${norm(input.partnerEmail)}`,
    `d:${preferredDate(input.eventDate)}|${norm(input.eventType)}|${norm(input.originalSourceLabel) || norm(input.source)}`,
    `m:${norm(input.inquiryMessage)}`,
    `x:${norm(input.guestCount)}|${norm(input.estimatedBudget)}|${preferredDate(input.followUpDate)}|${norm(input.nextActionText)}|${norm(input.dateFlexibility)}|${norm(input.salesStage)}`,
  ].join("::");
}

export function sourceDataFromImport(input: IncomingImportPerson): Record<string, unknown> {
  const data: Record<string, unknown> = {
    import_fingerprint: leadImportFingerprint(input),
  };
  if (input.sourceRecordId?.trim()) data.source_record_id = input.sourceRecordId.trim();
  if (input.originalSourceLabel?.trim()) data.original_source_label = input.originalSourceLabel.trim();
  if (input.dateFlexibility?.trim()) data.date_flexibility = input.dateFlexibility.trim();
  return data;
}

export function sourceRecordIdFromData(sourceData: Record<string, unknown> | null | undefined): string | null {
  const value = sourceData?.source_record_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function importFingerprintFromData(sourceData: Record<string, unknown> | null | undefined): string | null {
  const value = sourceData?.import_fingerprint;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function candidateFromRecord(record: ImportMatchRecord, signals: DuplicateSignal[]): DuplicateCandidate {
  return {
    leadId: record.leadId,
    clientId: record.clientId,
    relationshipId: record.relationshipId,
    displayName: displayName(record),
    email: record.email,
    phone: record.phone,
    salesStage: record.salesStage,
    signals,
  };
}

function samePrimaryName(incoming: IncomingImportPerson, matched: ImportMatchRecord): boolean {
  return Boolean(
    norm(incoming.firstName)
    && norm(incoming.lastName)
    && norm(incoming.firstName) === norm(matched.firstName)
    && norm(incoming.lastName) === norm(matched.lastName),
  );
}

function inquiryNotes(incoming: IncomingImportPerson, matched: ImportMatchRecord | null): string[] {
  if (!matched) return [];
  const notes: string[] = [];
  if (samePrimaryName(incoming, matched)) notes.push("Matching name");
  const inDate = preferredDate(incoming.eventDate);
  const exDate = preferredDate(matched.eventDate);
  if (inDate && exDate && inDate === exDate) notes.push("Same preferred date");
  if (inDate && exDate && inDate !== exDate) notes.push("Different preferred date — this may be a separate inquiry or an update");
  if (!inDate && !exDate) notes.push("Neither record has a preferred date");
  if (!inDate && exDate) notes.push("Incoming row has no preferred date");
  if (inDate && !exDate) notes.push("Existing record has no preferred date");
  if (matched.salesStage === "booked" || matched.clientId) {
    notes.push("Existing record is a booked customer — importing a Lead will not change that booking");
  }
  if (incoming.eventType?.trim() && matched.eventType?.trim() && norm(incoming.eventType) === norm(matched.eventType)) {
    notes.push("Same event type");
  }
  return notes;
}

function differences(incoming: IncomingImportPerson, matched: ImportMatchRecord): ImportFieldDifference[] {
  const rows: Array<[string, string | number | null | undefined, string | number | null | undefined]> = [
    ["Name", `${incoming.firstName} ${incoming.lastName}`.trim(), `${matched.firstName} ${matched.lastName}`.trim()],
    ["Email", incoming.email ?? "", matched.email],
    ["Phone", incoming.phone ?? "", matched.phone],
    ["Preferred date", preferredDate(incoming.eventDate), preferredDate(matched.eventDate)],
    ["Event type", incoming.eventType ?? "", matched.eventType],
    ["Inquiry notes", incoming.inquiryMessage ?? "", matched.inquiryMessage],
    ["Guest count", incoming.guestCount ?? "", matched.guestCount],
    ["Budget", incoming.estimatedBudget ?? "", matched.estimatedBudget],
    ["Follow-up", incoming.followUpDate ?? "", matched.followUpDate],
    ["Next action", incoming.nextActionText ?? "", matched.nextActionText],
  ];
  return rows
    .filter(([, a, b]) => norm(a) !== norm(b))
    .map(([label, a, b]) => ({ label, incoming: show(a), existing: show(b) }));
}

function reasonFrom(signals: DuplicateSignal[], notes: string[], fileMatchRow: number | null, changed: boolean): string {
  const parts: string[] = [];
  if (changed) parts.push("This looks like a record you already imported, and some details have changed.");
  if (signals.length > 0) parts.push(`Matched by: ${signals.map(signalLabel).join(", ")}.`);
  else if (notes.some((note) => note === "Matching name")) parts.push("Matched by: matching name.");
  if (fileMatchRow) parts.push(`Also matches row ${fileMatchRow} in this file.`);
  if (notes.length > 0) parts.push(notes.join(". ") + ".");
  if (parts.length === 0) return "No matching person in Hello to Cheers.";
  parts.push("Hello to Cheers will not decide this for you.");
  return parts.join(" ");
}

function kindFromSignals(incoming: IncomingImportPerson, matched: ImportMatchRecord, signals: DuplicateSignal[]): PersonMatchKind {
  const sameName =
    norm(incoming.firstName) === norm(matched.firstName)
    && norm(incoming.lastName) === norm(matched.lastName);
  const sameEmail = Boolean(normalizeEmail(incoming.email) && normalizeEmail(incoming.email) === normalizeEmail(matched.email));
  if (sameName && sameEmail) return "exact";
  if (signals.length > 0) return "likely";
  return "new";
}

/**
 * Classify one incoming row against existing venue records and earlier rows
 * in the same file. Proven retries skip. Everything else with a signal
 * needs a venue decision.
 */
export function classifyVenueControlledMatch(
  incoming: IncomingImportPerson,
  existing: readonly ImportMatchRecord[],
  priorInFile: readonly ImportMatchRecord[] = [],
): VenueControlledMatch {
  const fingerprint = leadImportFingerprint(incoming);
  const sourceId = incoming.sourceRecordId?.trim() || null;

  const proven = existing.find((row) => {
    if (sourceId && row.sourceRecordId && sourceId === row.sourceRecordId) return true;
    return Boolean(row.importFingerprint && row.importFingerprint === fingerprint);
  });
  if (proven && proven.importFingerprint === fingerprint) {
    return {
      kind: "exact",
      reason: "This is the same record you already brought in. We will skip it so nothing is duplicated or overwritten.",
      defaultAction: "skip",
      needsReview: false,
      alreadyImported: true,
      matchedId: proven.leadId ?? proven.clientId,
      matchedName: displayName(proven),
      matchedEmail: proven.email,
      matchedPhone: proven.phone,
      matchedEventDate: proven.eventDate,
      matchedSalesStage: proven.salesStage,
      relationshipId: proven.relationshipId,
      signals: ["inquiry_text"],
      inquiryNotes: ["Already imported"],
      differences: [],
      fileMatchRow: null,
      changedSinceImport: false,
    };
  }
  if (proven && sourceId && proven.sourceRecordId === sourceId) {
    const diffs = differences(incoming, proven);
    const notes = inquiryNotes(incoming, proven);
    return {
      kind: kindFromSignals(incoming, proven, ["inquiry_text"]),
      reason: reasonFrom(["inquiry_text"], notes, null, true),
      defaultAction: "skip",
      needsReview: true,
      alreadyImported: false,
      matchedId: proven.leadId ?? proven.clientId,
      matchedName: displayName(proven),
      matchedEmail: proven.email,
      matchedPhone: proven.phone,
      matchedEventDate: proven.eventDate,
      matchedSalesStage: proven.salesStage,
      relationshipId: proven.relationshipId,
      signals: ["inquiry_text"],
      inquiryNotes: notes,
      differences: diffs,
      fileMatchRow: null,
      changedSinceImport: true,
    };
  }

  let best: { record: ImportMatchRecord; signals: DuplicateSignal[]; fileRow: number | null } | null = null;
  const consider = (record: ImportMatchRecord, fileRow: number | null) => {
    const signals = signalsAgainstRecord(incoming, record);
    const named = samePrimaryName(incoming, record);
    if (signals.length === 0 && !named) return;
    if (
      !best
      || signals.length > best.signals.length
      || (signals.length === best.signals.length && named && !samePrimaryName(incoming, best.record))
      || (signals.length === best.signals.length && Boolean(record.relationshipId) && !best.record.relationshipId)
    ) {
      best = { record, signals, fileRow };
    }
  };
  for (const row of existing) consider(row, null);
  for (const row of priorInFile) consider(row, row.fileRow ?? null);

  if (!best) {
    return {
      kind: "new",
      reason: "No matching person in Hello to Cheers.",
      defaultAction: "create_new",
      needsReview: false,
      alreadyImported: false,
      matchedId: null,
      matchedName: null,
      matchedEmail: null,
      matchedPhone: null,
      matchedEventDate: null,
      matchedSalesStage: null,
      relationshipId: null,
      signals: [],
      inquiryNotes: [],
      differences: [],
      fileMatchRow: null,
      changedSinceImport: false,
    };
  }

  const { record, signals, fileRow } = best;
  const notes = inquiryNotes(incoming, record);
  const kind = kindFromSignals(incoming, record, signals);
  return {
    kind,
    reason: reasonFrom(signals, notes, fileRow, false),
    defaultAction: "skip",
    needsReview: true,
    alreadyImported: false,
    matchedId: record.leadId ?? record.clientId,
    matchedName: displayName(record),
    matchedEmail: record.email,
    matchedPhone: record.phone,
    matchedEventDate: record.eventDate,
    matchedSalesStage: record.salesStage,
    relationshipId: record.relationshipId,
    signals,
    inquiryNotes: notes,
    differences: differences(incoming, record),
    fileMatchRow: fileRow,
    changedSinceImport: false,
  };
}

export function importMatchRecordFromIncoming(
  incoming: IncomingImportPerson,
  fileRow: number,
): ImportMatchRecord {
  return {
    leadId: `file-${fileRow}`,
    clientId: null,
    relationshipId: null,
    firstName: incoming.firstName,
    lastName: incoming.lastName,
    email: incoming.email ?? null,
    phone: incoming.phone ?? null,
    partnerFirstName: incoming.partnerFirstName ?? null,
    partnerLastName: incoming.partnerLastName ?? null,
    partnerEmail: incoming.partnerEmail ?? null,
    inquiryMessage: incoming.inquiryMessage ?? null,
    eventDate: incoming.eventDate ?? null,
    eventType: incoming.eventType ?? null,
    salesStage: incoming.salesStage ?? null,
    guestCount: incoming.guestCount ?? null,
    source: incoming.source ?? null,
    followUpDate: incoming.followUpDate ?? null,
    nextActionText: incoming.nextActionText ?? null,
    estimatedBudget: incoming.estimatedBudget ?? null,
    sourceRecordId: incoming.sourceRecordId?.trim() || null,
    importFingerprint: leadImportFingerprint(incoming),
    fileRow,
  };
}

export function resolveImportMatchAction(
  match: Pick<VenueControlledMatch, "needsReview" | "alreadyImported" | "kind" | "defaultAction">,
  requested?: PersonMatchAction | null,
): PersonMatchAction | "held" {
  if (match.alreadyImported) return "skip";
  if (
    requested === "use_existing"
    || requested === "create_same_person"
    || requested === "create_new"
    || requested === "skip"
  ) {
    if (match.kind === "new" && (requested === "use_existing" || requested === "create_same_person")) {
      return "create_new";
    }
    return requested;
  }
  if (match.needsReview) return "held";
  return match.defaultAction;
}

/**
 * Relationship reuse requires an explicit same-person confirmation.
 * Matching email, name, phone, or date is not enough. Different person
 * always creates a new relationship. Never calls merge_leads_v1.
 */
export function importedLeadIdentityDecision(
  match: VenueControlledMatch,
  action: PersonMatchAction,
): IdentityDecision | undefined {
  if (action === "create_same_person") {
    if (match.relationshipId) {
      return { action: "use_existing", relationshipId: match.relationshipId };
    }
    return { action: "create_new" };
  }
  if (action === "create_new") {
    return { action: "create_new" };
  }
  return undefined;
}

/** After a Lead is created in this import, later rows can reuse that person. */
export function rememberCreatedImportLead(
  existing: ImportMatchRecord[],
  incoming: IncomingImportPerson,
  fileRow: number,
  leadId: string,
  relationshipId: string | null | undefined,
): ImportMatchRecord {
  const remembered = {
    ...importMatchRecordFromIncoming(incoming, fileRow),
    leadId,
    relationshipId: relationshipId?.trim() || null,
  };
  existing.push(remembered);
  return remembered;
}

export function incomingPersonFromLeadInput(input: IncomingImportPerson): IncomingImportPerson {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? "",
    phone: input.phone ?? "",
    partnerFirstName: input.partnerFirstName ?? "",
    partnerLastName: input.partnerLastName ?? "",
    partnerEmail: input.partnerEmail ?? "",
    inquiryMessage: input.inquiryMessage ?? "",
    eventDate: preferredDate(input.eventDate),
    eventType: input.eventType ?? "",
    guestCount: input.guestCount ?? "",
    source: input.source ?? "",
    originalSourceLabel: input.originalSourceLabel ?? "",
    followUpDate: preferredDate(input.followUpDate),
    nextActionText: input.nextActionText ?? "",
    dateFlexibility: input.dateFlexibility ?? "",
    salesStage: input.salesStage ?? "",
    estimatedBudget: input.estimatedBudget ?? "",
    sourceRecordId: input.sourceRecordId ?? "",
  };
}

export function venueMatchSkipMessage(
  match: VenueControlledMatch,
  action: PersonMatchAction | "held",
): string {
  if (action === "held") {
    return "Held for your decision — this row was not imported.";
  }
  if (action === "use_existing") {
    return "Used the record already in Hello to Cheers. Nothing was overwritten.";
  }
  if (match.alreadyImported) {
    return "This inquiry is already in Hello to Cheers. No second Lead was created.";
  }
  return "Left out of this import.";
}

export function candidateSummary(match: VenueControlledMatch): DuplicateCandidate | null {
  if (!match.matchedId && !match.relationshipId) return null;
  return {
    leadId: match.matchedId,
    clientId: null,
    relationshipId: match.relationshipId,
    displayName: match.matchedName ?? "",
    email: match.matchedEmail,
    phone: match.matchedPhone,
    salesStage: match.matchedSalesStage,
    signals: match.signals,
  };
}
