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
  NormalizedDocumentLike,
  NormalizedEventLike,
  NormalizedKeyDateLike,
  NormalizedLeadLike,
  NormalizedPackageLike,
  NormalizedTourLike,
  NormalizedVendorLike,
  SourceAdapter,
  SourceRow,
} from "@/lib/migration/types";
import type { NormalizedActiveCommitment, ActiveCommitmentScheduleLine } from "@/lib/migration/active-commitment";
import { validateActiveCommitment } from "@/lib/migration/active-commitment";
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
    return {
      ok: false,
      error: "Use Active commitment (Event Order, invoice, and payment plan) — standalone payment rows are not imported alone.",
    };
  }
  if (entityType === "document") {
    const fileName = str(row, "fileName") ?? str(row, "name");
    const storagePath = str(row, "storagePath");
    const storageUrl = str(row, "storageUrl");
    if (!fileName || !storagePath || !storageUrl) {
      return { ok: false, error: "Documents need a file name plus storagePath and storageUrl from an uploaded file." };
    }
    const entityTypeRaw = (str(row, "entityType") ?? "event").toLowerCase();
    const entityScope: "event" | "client" = entityTypeRaw === "client" ? "client" : "event";
    const normalized: NormalizedDocumentLike = {
      name: str(row, "name") ?? fileName,
      fileName,
      storagePath,
      storageUrl,
      mimeType: str(row, "mimeType"),
      fileSize: str(row, "fileSize"),
      category: str(row, "category") ?? "contract",
      notes: str(row, "notes") ?? str(row, "note"),
      entityType: entityScope,
      eventId: str(row, "eventId"),
      clientEmail: str(row, "clientEmail") ?? str(row, "email"),
      clientId: str(row, "clientId"),
      eventDate: str(row, "eventDate"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "active_commitment") {
    const contractedTotal = str(row, "contractedTotal") ?? str(row, "total") ?? str(row, "contractTotal");
    if (!contractedTotal) {
      return { ok: false, error: "Active commitments need a contractedTotal." };
    }

    const scheduleLines: ActiveCommitmentScheduleLine[] = [];
    const paidAmount = str(row, "paidAmount") ?? str(row, "amountPaid");
    if (paidAmount) {
      scheduleLines.push({
        label: str(row, "paidLabel") ?? "Deposit (already paid)",
        amount: paidAmount,
        dueDate: str(row, "paidDate") ?? str(row, "paidDueDate"),
        obligationKind: "deposit",
        alreadyPaid: true,
        paidDate: str(row, "paidDate"),
        paymentMethod: str(row, "paidMethod") ?? "other",
        referenceNumber: str(row, "paidReference"),
      });
    }
    for (const n of [1, 2, 3, 4] as const) {
      const amount = str(row, `remainingAmount${n}`) ?? str(row, `dueAmount${n}`);
      if (!amount) continue;
      scheduleLines.push({
        label: str(row, `remainingLabel${n}`) ?? str(row, `dueLabel${n}`) ?? `Payment ${n}`,
        amount,
        dueDate: str(row, `remainingDueDate${n}`) ?? str(row, `dueDate${n}`),
        obligationKind: n === 4 ? "final" : "installment",
        alreadyPaid: false,
      });
    }
    // Optional JSON override for full schedule fidelity.
    const scheduleJson = str(row, "scheduleLinesJson");
    if (scheduleJson) {
      try {
        const parsed = JSON.parse(scheduleJson) as ActiveCommitmentScheduleLine[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          scheduleLines.length = 0;
          scheduleLines.push(...parsed);
        }
      } catch {
        return { ok: false, error: "scheduleLinesJson must be valid JSON." };
      }
    }

    const normalized: NormalizedActiveCommitment = {
      eventId: str(row, "eventId"),
      clientEmail: str(row, "clientEmail") ?? str(row, "email"),
      clientId: str(row, "clientId"),
      eventDate: str(row, "eventDate"),
      contractedTotal,
      packageName: str(row, "packageName") ?? str(row, "package"),
      scheduleLines,
      invoiceNotes: str(row, "invoiceNotes") ?? str(row, "notes"),
      scheduleTitle: str(row, "scheduleTitle") ?? "Payment plan",
      contractTitle: str(row, "contractTitle"),
      contractContent: str(row, "contractContent"),
      contractSignedAt: str(row, "contractSignedAt") ?? str(row, "signedAt"),
      contractSignerName: str(row, "contractSignerName") ?? str(row, "signerName"),
      shareSignedAgreementWithCouple: ["yes", "true", "1"].includes(
        (str(row, "shareSignedAgreementWithCouple") ?? "").toLowerCase(),
      ),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };

    const linesJson = str(row, "linesJson");
    if (linesJson) {
      try {
        const parsed = JSON.parse(linesJson) as NormalizedActiveCommitment["lines"];
        if (Array.isArray(parsed) && parsed.length > 0) normalized.lines = parsed;
      } catch {
        return { ok: false, error: "linesJson must be valid JSON." };
      }
    }

    if (str(row, "documentStorageUrl") && str(row, "documentStoragePath") && str(row, "documentFileName")) {
      normalized.documents = [{
        name: str(row, "documentName") ?? str(row, "documentFileName")!,
        fileName: str(row, "documentFileName")!,
        storagePath: str(row, "documentStoragePath")!,
        storageUrl: str(row, "documentStorageUrl")!,
        mimeType: str(row, "documentMimeType") ?? "application/pdf",
        category: "contract",
        notes: "Original signed agreement from the prior system.",
        entityType: "event",
      }];
    }

    const validationError = validateActiveCommitment(normalized);
    if (validationError) {
      return { ok: false, error: validationError };
    }
    return { ok: true, entityType, normalized: normalized as unknown as Record<string, unknown> };
  }

  if (entityType === "guest_list") {
    const firstName = str(row, "firstName") ?? str(row, "guestFirstName");
    if (!firstName) return { ok: false, error: "Guest rows need a firstName." };
    const bool = (v: string | null | undefined) => ["yes", "true", "1"].includes((v ?? "").toLowerCase());
    const splitTags = (v: string | null | undefined) =>
      (v ?? "").split(/[,|;]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    const normalized = {
      eventId: str(row, "eventId"),
      clientEmail: str(row, "clientEmail"),
      clientId: str(row, "clientId"),
      eventDate: str(row, "eventDate"),
      firstName,
      lastName: str(row, "lastName") ?? str(row, "guestLastName"),
      email: str(row, "guestEmail"),
      phone: str(row, "phone") ?? str(row, "guestPhone"),
      household: str(row, "household") ?? str(row, "householdName"),
      rsvpStatus: str(row, "rsvpStatus") ?? str(row, "rsvp"),
      mealChoice: str(row, "mealChoice"),
      dietaryRestrictions: str(row, "dietaryRestrictions") ?? str(row, "dietary"),
      isChild: bool(str(row, "isChild")),
      isWeddingParty: bool(str(row, "isWeddingParty")),
      plusOne: bool(str(row, "plusOne")),
      plusOneName: str(row, "plusOneName"),
      dietaryTags: splitTags(str(row, "dietaryTags")),
      accessibilityTags: splitTags(str(row, "accessibilityTags")),
      accessibilityNotes: str(row, "accessibilityNotes"),
      age: str(row, "age"),
      highChairRequired: bool(str(row, "highChairRequired")),
      childNotes: str(row, "childNotes"),
      isVendorMeal: bool(str(row, "isVendorMeal")),
      notes: str(row, "notes"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "event_vendor_assignment") {
    const vendorBusinessName = str(row, "vendorBusinessName") ?? str(row, "businessName");
    const vendorId = str(row, "vendorId");
    if (!vendorBusinessName && !vendorId) {
      return { ok: false, error: "Assignments need vendorBusinessName or vendorId." };
    }
    const paymentRaw = (str(row, "paymentStatus") ?? "").toLowerCase();
    const normalized = {
      eventId: str(row, "eventId"),
      clientEmail: str(row, "clientEmail") ?? str(row, "email"),
      clientId: str(row, "clientId"),
      eventDate: str(row, "eventDate"),
      vendorId,
      vendorBusinessName,
      category: str(row, "category"),
      contactName: str(row, "contactName"),
      email: str(row, "vendorEmail") ?? str(row, "email"),
      phone: str(row, "phone"),
      arrivalTime: str(row, "arrivalTime"),
      setupLocation: str(row, "setupLocation"),
      loadInNotes: str(row, "loadInNotes"),
      notes: str(row, "notes"),
      agreedFee: str(row, "agreedFee"),
      paymentStatus: paymentRaw === "paid" ? "paid" as const : paymentRaw === "pending" ? "pending" as const : null,
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    if (str(row, "clientEmail")) normalized.clientEmail = str(row, "clientEmail");
    return { ok: true, entityType, normalized };
  }

  if (entityType === "timeline_entry") {
    const title = str(row, "title");
    if (!title) return { ok: false, error: "Timeline rows need a title." };
    const bool = (v: string | null | undefined) => ["yes", "true", "1"].includes((v ?? "").toLowerCase());
    const normalized = {
      eventId: str(row, "eventId"),
      clientEmail: str(row, "clientEmail") ?? str(row, "email"),
      clientId: str(row, "clientId"),
      eventDate: str(row, "eventDate"),
      title,
      description: str(row, "description"),
      notes: str(row, "notes"),
      entryTime: str(row, "entryTime") ?? str(row, "startTime"),
      endTime: str(row, "endTime"),
      dayOffset: str(row, "dayOffset"),
      audiences: str(row, "audiences"),
      status: str(row, "status"),
      lockState: str(row, "lockState"),
      timelineFinalized: bool(str(row, "timelineFinalized")) || bool(str(row, "finalized")),
      forceImport: bool(str(row, "forceImport")),
      sortOrder: str(row, "sortOrder"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "floor_plan") {
    const fileName = str(row, "fileName") ?? str(row, "name");
    const storagePath = str(row, "storagePath");
    const storageUrl = str(row, "storageUrl");
    if (!fileName || !storagePath || !storageUrl) {
      return { ok: false, error: "Floor plans need a file name plus storagePath and storageUrl from an uploaded file." };
    }
    const scopeRaw = (str(row, "scope") ?? "general_reference").toLowerCase();
    const scope =
      scopeRaw === "space_master" || scopeRaw === "event_specific" || scopeRaw === "general_reference"
        ? scopeRaw
        : "general_reference";
    const normalized = {
      name: str(row, "name") ?? fileName,
      fileName,
      storagePath,
      storageUrl,
      renderableImageUrl: str(row, "renderableImageUrl"),
      mimeType: str(row, "mimeType"),
      fileSize: str(row, "fileSize"),
      scope,
      spaceId: str(row, "spaceId"),
      spaceName: str(row, "spaceName"),
      eventId: str(row, "eventId"),
      eventName: str(row, "eventName"),
      eventDate: str(row, "eventDate"),
      sourceId: str(row, "sourceId") ?? storagePath,
      notes: str(row, "notes"),
    };
    return { ok: true, entityType, normalized };
  }

  return { ok: false, error: `Generic CSV import does not yet support "${entityType}" records.` };
}

export const genericCsvAdapter: SourceAdapter = {
  key: "generic_csv",
  recognizes: () => true,
  normalizeRow,
};
