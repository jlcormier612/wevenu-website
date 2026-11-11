/**
 * Venue-facing Internal Notes workspace — chronological projection of
 * authoritative venue-private note sources. Not a second store. Not Activity.
 *
 * Customer-facing Luv / portal must not import this module as draft context.
 */

import { normalizeInquiryMessageOrigin } from "@/lib/leads/inquiry-message-origin";

export type InternalNoteSourceKind =
  | "inquiry"
  | "tour"
  | "lead_note"
  | "event_note"
  | "client_note"
  | "client_record"
  | "conversation";

export type InternalNoteRollupItem = {
  id: string;
  sourceId: string;
  kind: InternalNoteSourceKind;
  provenanceLabel: string;
  body: string;
  occurredAt: string;
  canEdit: boolean;
  canDelete: boolean;
  edited: boolean;
};

const PROVENANCE: Record<InternalNoteSourceKind, string> = {
  inquiry: "Inquiry",
  tour: "Venue Tour",
  lead_note: "Internal note",
  event_note: "Internal note",
  client_note: "Internal note",
  client_record: "Client",
  conversation: "Internal note",
};

const KIND_RANK: Record<InternalNoteSourceKind, number> = {
  inquiry: 0,
  tour: 1,
  client_record: 2,
  conversation: 3,
  lead_note: 4,
  event_note: 5,
  client_note: 6,
};

function trimBody(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const body = raw.replace(/\s+/g, " ").trim();
  return body.length > 0 ? raw.trim() : null;
}

function normalizeForEcho(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

export function tourNotesEchoCustomerInquiry(
  tourNotes: string,
  inquiryMessage: string | null | undefined,
  inquiryOrigin: string | null | undefined,
): boolean {
  if (normalizeInquiryMessageOrigin(inquiryOrigin) !== "customer") return false;
  const inquiry = trimBody(inquiryMessage);
  if (!inquiry) return false;
  return normalizeForEcho(tourNotes) === normalizeForEcho(inquiry);
}

export function compareInternalNoteRollup(
  a: InternalNoteRollupItem,
  b: InternalNoteRollupItem,
): number {
  const byTime = a.occurredAt.localeCompare(b.occurredAt);
  if (byTime !== 0) return byTime;
  const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (byKind !== 0) return byKind;
  return a.id.localeCompare(b.id);
}

function item(
  kind: InternalNoteSourceKind,
  sourceId: string,
  body: string,
  occurredAt: string,
  opts?: { canEdit?: boolean; canDelete?: boolean; edited?: boolean },
): InternalNoteRollupItem {
  return {
    id: `${kind}:${sourceId}`,
    sourceId,
    kind,
    provenanceLabel: PROVENANCE[kind],
    body,
    occurredAt,
    canEdit: opts?.canEdit ?? false,
    canDelete: opts?.canDelete ?? false,
    edited: opts?.edited ?? false,
  };
}

export function buildInternalNotesRollup(input: {
  inquiry?: {
    leadId: string;
    body: string | null;
    origin: string | null | undefined;
    createdAt: string;
  } | null;
  tours?: Array<{
    id: string;
    notes: string | null;
    createdAt: string;
    completedAt?: string | null;
    actualOccurredAt?: string | null;
    scheduledAt?: string | null;
  }>;
  leadNotes?: Array<{
    id: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  eventNotes?: Array<{
    id: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  clientNotes?: Array<{
    id: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  clientRecordNotes?: { clientId: string; body: string | null; createdAt: string } | null;
  conversationNotes?: Array<{ id: string; body: string; sentAt: string }>;
}): InternalNoteRollupItem[] {
  const out: InternalNoteRollupItem[] = [];
  const inquiryBody = trimBody(input.inquiry?.body);
  if (
    input.inquiry &&
    inquiryBody &&
    normalizeInquiryMessageOrigin(input.inquiry.origin) === "venue"
  ) {
    out.push(item("inquiry", input.inquiry.leadId, inquiryBody, input.inquiry.createdAt));
  }

  for (const tour of input.tours ?? []) {
    const notes = trimBody(tour.notes);
    if (!notes) continue;
    if (
      tourNotesEchoCustomerInquiry(
        notes,
        input.inquiry?.body,
        input.inquiry?.origin,
      )
    ) {
      continue;
    }
    const occurredAt =
      tour.completedAt || tour.actualOccurredAt || tour.createdAt || tour.scheduledAt || "";
    if (!occurredAt) continue;
    out.push(item("tour", tour.id, notes, occurredAt));
  }

  if (input.clientRecordNotes) {
    const body = trimBody(input.clientRecordNotes.body);
    if (body) {
      out.push(item("client_record", input.clientRecordNotes.clientId, body, input.clientRecordNotes.createdAt));
    }
  }

  for (const note of input.conversationNotes ?? []) {
    const body = trimBody(note.body);
    if (!body) continue;
    out.push(item("conversation", note.id, body, note.sentAt));
  }

  for (const note of input.leadNotes ?? []) {
    const body = trimBody(note.body);
    if (!body) continue;
    out.push(
      item("lead_note", note.id, body, note.createdAt, {
        canEdit: true,
        canDelete: true,
        edited: Boolean(note.updatedAt && note.updatedAt !== note.createdAt),
      }),
    );
  }

  for (const note of input.eventNotes ?? []) {
    const body = trimBody(note.body);
    if (!body) continue;
    out.push(
      item("event_note", note.id, body, note.createdAt, {
        canEdit: true,
        canDelete: true,
        edited: Boolean(note.updatedAt && note.updatedAt !== note.createdAt),
      }),
    );
  }

  for (const note of input.clientNotes ?? []) {
    const body = trimBody(note.body);
    if (!body) continue;
    out.push(
      item("client_note", note.id, body, note.createdAt, {
        canEdit: false,
        canDelete: false,
        edited: Boolean(note.updatedAt && note.updatedAt !== note.createdAt),
      }),
    );
  }

  return [...out].sort(compareInternalNoteRollup);
}

export function formatInternalNoteOccurredOn(
  iso: string,
  timeZone?: string | null,
): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timeZone || undefined,
    });
  } catch {
    return iso;
  }
}
