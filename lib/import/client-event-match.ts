/**
 * Venue-controlled Client+Event import matching.
 *
 * Person identity and Event identity are distinct. A matching Client does
 * not prove a matching Event. A matching date does not prove a matching
 * Event. The only automatic skip is a proven Event retry: this venue, this
 * Event record type, and an identical stored source Event ID fingerprint
 * or an identical previously accepted Event fingerprint.
 */
import type { PersonMatchAction, PersonMatchKind } from "@/lib/import/match-policy";
import {
  resolveImportMatchAction,
  venueMatchSkipMessage,
  type ImportFieldDifference,
  type VenueControlledMatch,
} from "@/lib/import/venue-controlled-match";

function norm(value: string | number | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function dateOnly(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, 10);
}

function show(value: string | number | null | undefined): string {
  const t = String(value ?? "").trim();
  return t || "—";
}

export type ClientEventMatchRecord = {
  clientId: string;
  eventId: string | null;
  relationshipId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  eventDate: string | null;
  eventType: string | null;
  guestCount: string | number | null;
  internalNotes: string | null;
  sourceClientId: string | null;
  sourceEventId: string | null;
  clientFingerprint: string | null;
  eventFingerprint: string | null;
  fileRow?: number | null;
};

export type IncomingClientEvent = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  eventDate?: string | null;
  eventType?: string | null;
  guestCount?: string | number | null;
  internalNotes?: string | null;
  ceremonyTime?: string | null;
  receptionTime?: string | null;
  spaceId?: string | null;
  bookingStatus?: string | null;
  sourceClientId?: string | null;
  sourceEventId?: string | null;
};

export type ClientEventMatch = VenueControlledMatch & {
  matchedClientId: string | null;
  matchedEventId: string | null;
  matchedEvents: Array<{ eventId: string | null; eventDate: string | null; eventType: string | null }>;
};

export function clientImportFingerprint(input: IncomingClientEvent): string {
  return [
    `cid:${norm(input.sourceClientId)}`,
    `n:${norm(input.firstName)}|${norm(input.lastName)}|${norm(input.email)}|${norm(input.phone)}`,
    `p:${norm(input.partnerFirstName)}|${norm(input.partnerLastName)}`,
  ].join("::");
}

export function eventImportFingerprint(input: IncomingClientEvent): string {
  return [
    `eid:${norm(input.sourceEventId)}`,
    `cid:${norm(input.sourceClientId)}`,
    `d:${dateOnly(input.eventDate)}|${norm(input.eventType)}|${norm(input.guestCount)}`,
    `t:${norm(input.ceremonyTime)}|${norm(input.receptionTime)}|${norm(input.spaceId)}|${norm(input.bookingStatus)}`,
    `m:${norm(input.internalNotes)}`,
  ].join("::");
}

export function clientEventSourceData(input: IncomingClientEvent): {
  client: Record<string, unknown>;
  event: Record<string, unknown>;
} {
  const client: Record<string, unknown> = { import_fingerprint: clientImportFingerprint(input) };
  const event: Record<string, unknown> = { import_fingerprint: eventImportFingerprint(input) };
  if (input.sourceClientId?.trim()) {
    client.source_client_id = input.sourceClientId.trim();
    event.source_client_id = input.sourceClientId.trim();
  }
  if (input.sourceEventId?.trim()) event.source_event_id = input.sourceEventId.trim();
  return { client, event };
}

export function sourceClientIdFromData(sourceData: Record<string, unknown> | null | undefined): string | null {
  const value = sourceData?.source_client_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function sourceEventIdFromData(sourceData: Record<string, unknown> | null | undefined): string | null {
  const value = sourceData?.source_event_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function importFingerprintFromData(sourceData: Record<string, unknown> | null | undefined): string | null {
  const value = sourceData?.import_fingerprint;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function displayName(row: Pick<ClientEventMatchRecord, "firstName" | "lastName" | "partnerFirstName" | "partnerLastName">): string {
  const primary = `${row.firstName} ${row.lastName}`.trim();
  const partner = `${row.partnerFirstName ?? ""} ${row.partnerLastName ?? ""}`.trim();
  return partner ? `${primary} & ${partner}` : primary;
}

function samePrimaryName(incoming: IncomingClientEvent, matched: ClientEventMatchRecord): boolean {
  return Boolean(
    norm(incoming.firstName)
    && norm(incoming.lastName)
    && norm(incoming.firstName) === norm(matched.firstName)
    && norm(incoming.lastName) === norm(matched.lastName),
  );
}

function sameEmail(incoming: IncomingClientEvent, matched: ClientEventMatchRecord): boolean {
  return Boolean(norm(incoming.email) && norm(incoming.email) === norm(matched.email));
}

function differences(incoming: IncomingClientEvent, matched: ClientEventMatchRecord): ImportFieldDifference[] {
  const rows: Array<[string, string | number | null | undefined, string | number | null | undefined]> = [
    ["Name", `${incoming.firstName} ${incoming.lastName}`.trim(), `${matched.firstName} ${matched.lastName}`.trim()],
    ["Email", incoming.email, matched.email],
    ["Phone", incoming.phone, matched.phone],
    ["Event date", dateOnly(incoming.eventDate), dateOnly(matched.eventDate)],
    ["Event type", incoming.eventType, matched.eventType],
    ["Guest count", incoming.guestCount, matched.guestCount],
    ["Notes", incoming.internalNotes, matched.internalNotes],
  ];
  return rows
    .filter(([, incomingValue, existing]) => show(incomingValue) !== show(existing))
    .map(([label, incomingValue, existing]) => ({
      label,
      incoming: show(incomingValue),
      existing: show(existing),
    }));
}

function eventsForClient(records: readonly ClientEventMatchRecord[], clientId: string) {
  return records
    .filter((row) => row.clientId === clientId && row.eventId)
    .map((row) => ({ eventId: row.eventId, eventDate: row.eventDate, eventType: row.eventType }));
}

function result(partial: Omit<ClientEventMatch, "matchedPhone" | "matchedSalesStage" | "fileMatchRow" | "inquiryNotes"> & {
  inquiryNotes?: string[];
  fileMatchRow?: number | null;
}): ClientEventMatch {
  return {
    matchedPhone: null,
    matchedSalesStage: null,
    fileMatchRow: partial.fileMatchRow ?? null,
    inquiryNotes: partial.inquiryNotes ?? [],
    ...partial,
  };
}

export function classifyClientEventMatch(
  incoming: IncomingClientEvent,
  existing: readonly ClientEventMatchRecord[],
  priorInFile: readonly ClientEventMatchRecord[] = [],
): ClientEventMatch {
  const sourceClientId = incoming.sourceClientId?.trim() || null;
  const sourceEventId = incoming.sourceEventId?.trim() || null;
  const eventFingerprint = eventImportFingerprint(incoming);
  const all = [...existing, ...priorInFile];

  const provenEvent = all.find((row) => {
    if (sourceEventId && row.sourceEventId && sourceEventId === row.sourceEventId) return true;
    return Boolean(row.eventFingerprint && row.eventFingerprint === eventFingerprint);
  });
  if (provenEvent && provenEvent.eventFingerprint === eventFingerprint) {
    return result({
      kind: "exact",
      reason: "This Event is already in Hello to Cheers. We will skip it so nothing is duplicated or overwritten.",
      defaultAction: "skip",
      needsReview: false,
      alreadyImported: true,
      changedSinceImport: false,
      matchedId: provenEvent.clientId,
      matchedClientId: provenEvent.clientId,
      matchedEventId: provenEvent.eventId,
      matchedName: displayName(provenEvent),
      matchedEmail: provenEvent.email,
      matchedEventDate: provenEvent.eventDate,
      relationshipId: provenEvent.relationshipId,
      signals: ["inquiry_text"],
      differences: [],
      matchedEvents: eventsForClient(all, provenEvent.clientId),
      inquiryNotes: ["Already imported"],
      fileMatchRow: provenEvent.fileRow ?? null,
    });
  }
  if (provenEvent && sourceEventId && provenEvent.sourceEventId === sourceEventId) {
    return result({
      kind: "exact",
      reason: "This looks like an Event you already brought in, with updated details. Same Client, same Event keeps what is already in Hello to Cheers.",
      defaultAction: "use_existing",
      needsReview: true,
      alreadyImported: false,
      changedSinceImport: true,
      matchedId: provenEvent.clientId,
      matchedClientId: provenEvent.clientId,
      matchedEventId: provenEvent.eventId,
      matchedName: displayName(provenEvent),
      matchedEmail: provenEvent.email,
      matchedEventDate: provenEvent.eventDate,
      relationshipId: provenEvent.relationshipId,
      signals: ["inquiry_text"],
      differences: differences(incoming, provenEvent),
      matchedEvents: eventsForClient(all, provenEvent.clientId),
      inquiryNotes: ["Matching source Event ID", "Details have changed"],
      fileMatchRow: provenEvent.fileRow ?? null,
    });
  }

  const bySourceClient = sourceClientId
    ? all.filter((row) => row.sourceClientId && row.sourceClientId === sourceClientId)
    : [];
  const named = all.filter((row) => samePrimaryName(incoming, row));
  const emailed = all.filter((row) => sameEmail(incoming, row));

  let best: ClientEventMatchRecord | null = bySourceClient[0] ?? null;
  if (!best && named.length > 0 && emailed.some((row) => named.includes(row))) {
    best = named.find((row) => sameEmail(incoming, row)) ?? named[0] ?? null;
  } else if (!best && named[0]) {
    best = named[0];
  } else if (!best && emailed[0]) {
    best = emailed[0];
  }

  if (!best) {
    return result({
      kind: "new",
      reason: "No matching client or event in Hello to Cheers.",
      defaultAction: "create_new",
      needsReview: false,
      alreadyImported: false,
      changedSinceImport: false,
      matchedId: null,
      matchedClientId: null,
      matchedEventId: null,
      matchedName: null,
      matchedEmail: null,
      matchedEventDate: null,
      relationshipId: null,
      signals: [],
      differences: [],
      matchedEvents: [],
    });
  }

  const clientEvents = eventsForClient(all, best.clientId);
  const incomingDate = dateOnly(incoming.eventDate);
  const sameDateEvent = all.find((row) =>
    row.clientId === best!.clientId && incomingDate && dateOnly(row.eventDate) === incomingDate,
  ) ?? null;
  const sourceClientOnly = bySourceClient.length > 0 && !provenEvent;
  const exactPerson = samePrimaryName(incoming, best) && sameEmail(incoming, best);
  const kind: PersonMatchKind = exactPerson || sourceClientOnly ? "exact" : "likely";
  const notes: string[] = [];
  if (sourceClientOnly) notes.push("Matching source Client ID — that does not prove this Event is already imported");
  if (exactPerson) notes.push("Matching name and email — confirm whether this is the same client");
  else if (samePrimaryName(incoming, best) && !sameEmail(incoming, best)) notes.push("Matching name, different email");
  else if (sameEmail(incoming, best) && !samePrimaryName(incoming, best)) notes.push("Same email, different name — two people can share an address");
  if (sameDateEvent) notes.push("This client already has an Event on this date. A matching date is not proof it is the same Event.");
  else if (clientEvents.length > 0) notes.push("This client already has other Events");

  const additional = !sameDateEvent || Boolean(incoming.sourceEventId && incoming.sourceEventId !== sameDateEvent?.sourceEventId);
  return result({
    kind,
    reason: additional
      ? "Possible match. Choose whether this is the same Event, an additional Event for this client, a different client, or something to leave out."
      : "Possible match on this client and date. Choose whether this is the same Event, an additional Event, a different client, or something to leave out.",
    defaultAction: "skip",
    needsReview: true,
    alreadyImported: false,
    changedSinceImport: false,
    matchedId: best.clientId,
    matchedClientId: best.clientId,
    matchedEventId: sameDateEvent?.eventId ?? best.eventId,
    matchedName: displayName(best),
    matchedEmail: best.email,
    matchedEventDate: sameDateEvent?.eventDate ?? best.eventDate,
    relationshipId: best.relationshipId,
    signals: exactPerson ? ["name_pair", "email"] : sameEmail(incoming, best) ? ["email"] : ["name_pair"],
    differences: differences(incoming, sameDateEvent ?? best),
    matchedEvents: clientEvents,
    inquiryNotes: notes,
    fileMatchRow: best.fileRow ?? null,
  });
}

export function incomingClientEventFromInput(input: IncomingClientEvent): IncomingClientEvent {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? "",
    phone: input.phone ?? "",
    partnerFirstName: input.partnerFirstName ?? "",
    partnerLastName: input.partnerLastName ?? "",
    eventDate: dateOnly(input.eventDate),
    eventType: input.eventType ?? "",
    guestCount: input.guestCount ?? "",
    internalNotes: input.internalNotes ?? "",
    ceremonyTime: input.ceremonyTime ?? "",
    receptionTime: input.receptionTime ?? "",
    spaceId: input.spaceId ?? "",
    bookingStatus: input.bookingStatus ?? "",
    sourceClientId: input.sourceClientId ?? "",
    sourceEventId: input.sourceEventId ?? "",
  };
}

export function importMatchRecordFromIncomingClient(
  incoming: IncomingClientEvent,
  fileRow: number,
): ClientEventMatchRecord {
  return {
    clientId: `file-${fileRow}`,
    eventId: `file-event-${fileRow}`,
    relationshipId: null,
    firstName: incoming.firstName,
    lastName: incoming.lastName,
    email: incoming.email ?? null,
    phone: incoming.phone ?? null,
    partnerFirstName: incoming.partnerFirstName ?? null,
    partnerLastName: incoming.partnerLastName ?? null,
    eventDate: dateOnly(incoming.eventDate) || null,
    eventType: incoming.eventType ?? null,
    guestCount: incoming.guestCount ?? null,
    internalNotes: incoming.internalNotes ?? null,
    sourceClientId: incoming.sourceClientId?.trim() || null,
    sourceEventId: incoming.sourceEventId?.trim() || null,
    clientFingerprint: clientImportFingerprint(incoming),
    eventFingerprint: eventImportFingerprint(incoming),
    fileRow,
  };
}

export function rememberCreatedImportClientEvent(
  existing: ClientEventMatchRecord[],
  incoming: IncomingClientEvent,
  fileRow: number,
  clientId: string,
  eventId: string | null,
  relationshipId: string | null | undefined,
): ClientEventMatchRecord {
  const remembered = {
    ...importMatchRecordFromIncomingClient(incoming, fileRow),
    clientId,
    eventId,
    relationshipId: relationshipId?.trim() || null,
  };
  existing.push(remembered);
  return remembered;
}

export function importedClientIdentityDecision(
  match: ClientEventMatch,
  action: PersonMatchAction,
): import("@/lib/identity/decision").IdentityDecision | undefined {
  if (action === "create_same_person" && match.relationshipId) {
    return { action: "use_existing", relationshipId: match.relationshipId };
  }
  if (action === "create_new") return { action: "create_new" };
  return undefined;
}

export function isPersistedImportId(id: string | null | undefined): boolean {
  return Boolean(
    id
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  );
}

/**
 * Venue confirmation is required. If the confirmed Client disappeared or is
 * still only a same-file placeholder, hold instead of inventing another identity.
 */
export function resolveConfirmedClientEventAction(
  match: ClientEventMatch,
  requested: PersonMatchAction | null,
): PersonMatchAction | "held" {
  if (
    (requested === "use_existing" || requested === "create_same_person")
    && (match.kind === "new" || !match.matchedClientId)
  ) {
    return "held";
  }
  if (requested === "create_same_person" && !isPersistedImportId(match.matchedClientId)) {
    return "held";
  }
  return resolveImportMatchAction(match, requested);
}

export function clientEventMatchSkipMessage(
  match: ClientEventMatch,
  action: PersonMatchAction | "held",
): string {
  if (action === "use_existing") {
    return "Used the Event already in Hello to Cheers. Nothing was overwritten.";
  }
  if (match.alreadyImported) {
    return "This Event is already in Hello to Cheers. No second Event was created.";
  }
  return venueMatchSkipMessage(match, action);
}

export { resolveImportMatchAction };
