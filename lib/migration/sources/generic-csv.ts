/**
 * Migration Center — the generic CSV/spreadsheet adapter.
 *
 * Rows arriving here have already had their raw column headers mapped to
 * canonical field keys by the Migration Center / Import field-mapping step.
 * This file does light value coercion into normalized candidate shapes.
 * Nothing is dropped silently — unusable rows return ok:false.
 */
import type {
  MigrationEntityType,
  NormalizationResult,
  NormalizedCalendarBlockLike,
  NormalizedClientLike,
  NormalizedDateHoldLike,
  NormalizedEventLike,
  NormalizedKeyDateLike,
  NormalizedLeadLike,
  NormalizedPackageLike,
  NormalizedTourLike,
  NormalizedVendorLike,
  SourceAdapter,
  SourceRow,
} from "@/lib/migration/types";
import { MANUAL_SCHEDULE_TYPES, type ManualScheduleType, type RecurrenceRule } from "@/lib/availability/types";

function str(row: SourceRow, key: string): string | null {
  const v = row[key];
  if (v == null) return null;
  const trimmed = String(v).trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeClientLike(row: SourceRow): (NormalizedClientLike & { ok: true }) | { ok: false; error: string } {
  const firstName = str(row, "firstName");
  const lastName = str(row, "lastName");
  if (!firstName || !lastName) {
    return { ok: false, error: "Missing a first and last name — every record needs at least one identifiable person." };
  }
  return {
    ok: true,
    firstName,
    lastName,
    partnerFirstName: str(row, "partnerFirstName"),
    partnerLastName: str(row, "partnerLastName"),
    email: str(row, "email"),
    phone: str(row, "phone"),
    eventDate: str(row, "eventDate"),
    endDate: str(row, "endDate") ?? str(row, "eventEndDate"),
    eventType: str(row, "eventType"),
    guestCount: str(row, "guestCount"),
    startTime: str(row, "startTime") ?? str(row, "ceremonyTime"),
    endTime: str(row, "endTime") ?? str(row, "receptionTime"),
    setupTime: str(row, "setupTime"),
    teardownTime: str(row, "teardownTime"),
    spaceId: str(row, "spaceId"),
    spaceName: str(row, "spaceName") ?? str(row, "space"),
    notes: str(row, "internalNotes") ?? str(row, "notes"),
    sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
  };
}

const BLOCK_TYPES = new Set<string>(MANUAL_SCHEDULE_TYPES);
const RECURRENCE_RULES = new Set<RecurrenceRule>(["none", "daily", "weekly", "monthly", "annual"]);

function parseBool(v: string | null, defaultValue: boolean): boolean {
  if (v == null) return defaultValue;
  const lower = v.toLowerCase();
  if (["1", "true", "yes", "y", "all day", "all-day"].includes(lower)) return true;
  if (["0", "false", "no", "n"].includes(lower)) return false;
  return defaultValue;
}

function normalizeRow(row: SourceRow, entityType: MigrationEntityType): NormalizationResult {
  if (entityType === "client") {
    const r = normalizeClientLike(row);
    if (!r.ok) return r;
    const { ok: _ok, ...normalized } = r;
    return { ok: true, entityType, normalized };
  }

  if (entityType === "lead") {
    const r = normalizeClientLike(row);
    if (!r.ok) return r;
    const { ok: _ok, ...base } = r;
    const normalized: NormalizedLeadLike = {
      ...base,
      inquiryMessage: str(row, "inquiryMessage"),
      estimatedBudget: str(row, "estimatedBudget"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "vendor") {
    const businessName = str(row, "businessName");
    if (!businessName) {
      return { ok: false, error: "Missing a business name — every vendor record needs one." };
    }
    const normalized: NormalizedVendorLike = {
      businessName,
      category: str(row, "category"),
      contactName: str(row, "contactName"),
      email: str(row, "email"),
      phone: str(row, "phone"),
      websiteUrl: str(row, "websiteUrl"),
      notes: str(row, "notes"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "calendar_block") {
    const title = str(row, "title");
    const startDate = str(row, "startDate") ?? str(row, "date");
    if (!title || !startDate) {
      return { ok: false, error: "Calendar blocks need a title and a start date." };
    }
    const typeRaw = (str(row, "type") ?? "blocked_time").toLowerCase().replace(/\s+/g, "_");
    if (!BLOCK_TYPES.has(typeRaw)) {
      return { ok: false, error: `Unrecognized schedule type "${typeRaw}". Use one of HTC's supported calendar types (e.g. blocked_time, tour, personal_appointment).` };
    }
    const ruleRaw = (str(row, "recurrenceRule") ?? "none").toLowerCase();
    if (!RECURRENCE_RULES.has(ruleRaw as RecurrenceRule)) {
      return { ok: false, error: `Unrecognized recurrence "${ruleRaw}". Use none, daily, weekly, monthly, or annual.` };
    }
    const normalized: NormalizedCalendarBlockLike = {
      title,
      type: typeRaw as ManualScheduleType,
      reason: str(row, "reason"),
      startDate,
      endDate: str(row, "endDate") ?? startDate,
      isAllDay: parseBool(str(row, "isAllDay"), !str(row, "startTime")),
      startTime: str(row, "startTime"),
      endTime: str(row, "endTime"),
      notes: str(row, "notes"),
      recurrenceRule: ruleRaw,
      recurrenceEndsOn: str(row, "recurrenceEndsOn"),
      recurrenceInterval: str(row, "recurrenceInterval"),
      recurrenceCount: str(row, "recurrenceCount"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "date_hold") {
    const title = str(row, "title");
    const holdDate = str(row, "holdDate") ?? str(row, "date");
    if (!title || !holdDate) {
      return { ok: false, error: "Holds need a title and a hold date." };
    }
    const normalized: NormalizedDateHoldLike = {
      title,
      holdDate,
      startTime: str(row, "startTime"),
      endTime: str(row, "endTime"),
      expiresAt: str(row, "expiresAt"),
      notes: str(row, "notes"),
      leadEmail: str(row, "leadEmail"),
      leadId: str(row, "leadId"),
      spaceId: str(row, "spaceId"),
      spaceName: str(row, "spaceName") ?? str(row, "space"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "tour") {
    const scheduledAt = str(row, "scheduledAt") ?? str(row, "slotStart") ?? str(row, "dateTime");
    if (!scheduledAt) {
      return { ok: false, error: "Tours need a scheduled date/time (ISO timestamp or YYYY-MM-DD HH:MM)." };
    }
    const leadId = str(row, "leadId");
    const leadEmail = str(row, "leadEmail") ?? str(row, "email");
    if (!leadId && !leadEmail) {
      return { ok: false, error: "Tours need a lead email or lead id so we can attach the appointment to a real Lead." };
    }
    const normalized: NormalizedTourLike = {
      scheduledAt,
      notes: str(row, "notes"),
      leadEmail,
      leadId,
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "package") {
    const name = str(row, "name");
    if (!name) return { ok: false, error: "Packages need a name." };
    const normalized: NormalizedPackageLike = {
      name,
      description: str(row, "description"),
      basePrice: str(row, "basePrice") ?? str(row, "price"),
      category: str(row, "category"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "event") {
    const name = str(row, "name") ?? str(row, "title");
    const eventDate = str(row, "eventDate") ?? str(row, "date");
    if (!name || !eventDate) {
      return { ok: false, error: "Events need a name and an event date." };
    }
    const clientId = str(row, "clientId");
    const clientEmail = str(row, "clientEmail") ?? str(row, "email");
    if (!clientId && !clientEmail) {
      return { ok: false, error: "Standalone events need a client email or client id." };
    }
    const normalized: NormalizedEventLike = {
      name,
      eventDate,
      eventEndDate: str(row, "eventEndDate") ?? str(row, "endDate"),
      eventType: str(row, "eventType"),
      startTime: str(row, "startTime") ?? str(row, "ceremonyTime"),
      endTime: str(row, "endTime") ?? str(row, "receptionTime"),
      setupTime: str(row, "setupTime"),
      teardownTime: str(row, "teardownTime"),
      guestCount: str(row, "guestCount"),
      clientEmail,
      clientId,
      spaceId: str(row, "spaceId"),
      spaceName: str(row, "spaceName") ?? str(row, "space"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "key_date") {
    const label = str(row, "label") ?? str(row, "title");
    const date = str(row, "date") ?? str(row, "keyDate");
    if (!label || !date) {
      return { ok: false, error: "Key dates need a label and a date." };
    }
    const clientId = str(row, "clientId");
    const clientEmail = str(row, "clientEmail") ?? str(row, "email");
    if (!clientId && !clientEmail) {
      return { ok: false, error: "Key dates need a client email or client id." };
    }
    const normalized: NormalizedKeyDateLike = {
      label,
      date,
      note: str(row, "note") ?? str(row, "notes"),
      clientEmail,
      clientId,
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "payment") {
    return { ok: false, error: "Payments are not reconstructed automatically. Preserve signed documents as artifacts; remaining balances and future contractual obligations still need evaluation." };
  }
  if (entityType === "document") {
    return { ok: false, error: "Attach signed contracts and files as migration artifacts. They are historical records, not live contracts or payment plans." };
  }

  return { ok: false, error: `Generic CSV import does not yet support "${entityType}" records.` };
}

export const genericCsvAdapter: SourceAdapter = {
  key: "generic_csv",
  recognizes: () => true,
  normalizeRow,
};
