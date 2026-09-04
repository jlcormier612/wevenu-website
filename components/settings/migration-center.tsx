"use client";

/**
 * Migration Center — self-service V1 (docs/migration-cutover-architecture.md).
 *
 * Deliberately a simpler, separate flow from components/settings/
 * import-wizard.tsx rather than a rework of it — that wizard's one-shot,
 * synchronous, no-dedupe-review commit is exactly right for a venue adding
 * a handful of records today; this one is for "bring my whole business
 * over," where recognizing duplicates and reviewing them before anything
 * is created is the entire point. Both call the same canonical entity-
 * create functions underneath; neither is a second domain model.
 *
 * Migration is not a one-hour task — a venue may start it, leave, and come
 * back days later. Every session in history is independently resumable:
 * clicking one reads its actual current state (lib/migration/service.ts's
 * getOwnSessionResumeState) and renders exactly the next step, never a
 * blank slate and never a re-upload prompt.
 */
import * as React from "react";
import Link from "next/link";
import Papa from "papaparse";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/integrations/supabase/client";
import {
  addMigrationRowsAction,
  attachMigrationSourceFileAction,
  commitMigrationSessionAction,
  commitReviewedActiveCommitmentAction,
  getMigrationSessionRecordsAction,
  getMigrationSessionResumeStateAction,
  getMigrationSessionSourceFilesAction,
  listMigrationSessionsAction,
  proposeActiveCommitmentFromFileAction,
  proposeActiveCommitmentFromTextAction,
  proposeMigrationFieldMappingAction,
  retryMigrationRecordAction,
  reviewMigrationRecordAction,
  runMigrationDedupeAction,
  startMigrationSessionAction,
} from "@/app/(app)/settings/migration-actions";
import { ActiveCommitmentReview } from "@/components/settings/active-commitment-review";
import { FloorPlanMigrationImport } from "@/components/settings/floor-plan-migration-import";
import type { NormalizedActiveCommitment } from "@/lib/migration/active-commitment-model";
import { isHistoricalRecordEligibleError, isLiveAvailabilityConflictError, HISTORICAL_RECORD_ELIGIBLE, HISTORICAL_RECORD_LABEL } from "@/lib/migration/historical-record";
import { formatSessionOutcomeSentence } from "@/lib/migration/session-accounting";
import {
  MIGRATION_CENTER_INTRO,
  SOURCE_SELECTION_LANES,
  laneForRecognizedSource,
  namedSourceProfiles,
  sourceHistoryLabel,
  sourceKeyForLane,
  sourceSelectionGuidance,
  type SourceSelectionLane,
} from "@/lib/migration/source-selection";
import { recognizeSource } from "@/lib/migration/source-profiles";
import type {
  MigrationEntityType, MigrationRecord, MigrationSession, SessionResumeState, SessionSourceFile, SessionSummary, SourceProfile,
} from "@/lib/migration/types";
import type { CutoverPrerequisite } from "@/lib/setup-hub/bring-your-business";
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";

type CsvRow = Record<string, string>;

const ENTITY_LABEL: Record<MigrationEntityType, string> = {
  client: "Clients (booked couples)",
  lead: "Leads (open inquiries)",
  vendor: "Vendors",
  event: "Events (standalone)",
  payment: "Payments (use Active commitment)",
  document: "Documents (contracts & files on Events/Clients)",
  calendar_block: "Calendar blocks (incl. recurring)",
  date_hold: "Date holds",
  tour: "Tours / appointments",
  package: "Packages",
  key_date: "Key dates",
  active_commitment: "Active commitment (Event Order, invoice, payments, signed agreement)",
  guest_list: "Guest list (operational couple guests on an active Event)",
  event_vendor_assignment: "Event vendor assignments (photographer, caterer, …)",
  timeline_entry: "Timeline entries (near-event / finalized day-of)",
  floor_plan: "Floor plans (Space masters, event layouts, reference files)",
};
const COMMITTABLE_ENTITIES: MigrationEntityType[] = [
  "calendar_block", "date_hold", "client", "lead", "vendor", "package", "event", "tour", "key_date",
  "document", "active_commitment", "guest_list", "event_vendor_assignment", "timeline_entry",
  "floor_plan",
];

const FIELD_KEYS_BY_ENTITY: Record<MigrationEntityType, { key: string; label: string; required: boolean }[]> = {
  client: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "name", label: "Full name (only if your file has ONE combined name column instead of separate first/last)", required: false },
    { key: "partnerFirstName", label: "Partner first name", required: false },
    { key: "partnerLastName", label: "Partner last name", required: false },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: false },
    { key: "endDate", label: "Event end date (YYYY-MM-DD)", required: false },
    { key: "eventType", label: "Event type", required: false },
    { key: "guestCount", label: "Guest count", required: false },
    { key: "startTime", label: "Start time (HH:MM)", required: false },
    { key: "endTime", label: "End time (HH:MM)", required: false },
    { key: "setupTime", label: "Setup time (HH:MM)", required: false },
    { key: "teardownTime", label: "Teardown time (HH:MM)", required: false },
    { key: "spaceName", label: "Event space name", required: false },
    { key: "spaceId", label: "Event space id (if you have it)", required: false },
    { key: "internalNotes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID (if the export has one)", required: false },
  ],
  lead: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "name", label: "Full name (only if your file has ONE combined name column instead of separate first/last)", required: false },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: false },
    { key: "endDate", label: "Event end date (YYYY-MM-DD)", required: false },
    { key: "eventType", label: "Event type", required: false },
    { key: "estimatedBudget", label: "Budget", required: false },
    { key: "inquiryMessage", label: "Inquiry notes", required: false },
    { key: "sourceId", label: "Their own record ID (if the export has one)", required: false },
  ],
  vendor: [
    { key: "businessName", label: "Business name", required: true },
    { key: "category", label: "Category", required: false },
    { key: "contactName", label: "Contact name", required: false },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "websiteUrl", label: "Website", required: false },
    { key: "notes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID (if the export has one)", required: false },
  ],
  calendar_block: [
    { key: "title", label: "Title", required: true },
    { key: "type", label: "Type (blocked_time, tour, personal_appointment, …)", required: false },
    { key: "startDate", label: "Start date (YYYY-MM-DD)", required: true },
    { key: "endDate", label: "End date (YYYY-MM-DD)", required: false },
    { key: "isAllDay", label: "All day? (yes/no)", required: false },
    { key: "startTime", label: "Start time (HH:MM)", required: false },
    { key: "endTime", label: "End time (HH:MM)", required: false },
    { key: "recurrenceRule", label: "Recurrence (none/daily/weekly/monthly/annual)", required: false },
    { key: "recurrenceEndsOn", label: "Recurrence ends on (YYYY-MM-DD)", required: false },
    { key: "recurrenceInterval", label: "Every N (interval)", required: false },
    { key: "recurrenceCount", label: "Stop after N occurrences", required: false },
    { key: "notes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  date_hold: [
    { key: "title", label: "Title", required: true },
    { key: "holdDate", label: "Hold date (YYYY-MM-DD)", required: true },
    { key: "startTime", label: "Start time", required: false },
    { key: "endTime", label: "End time", required: false },
    { key: "leadEmail", label: "Lead email", required: false },
    { key: "spaceName", label: "Event space name", required: false },
    { key: "expiresAt", label: "Expires at", required: false },
    { key: "notes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  tour: [
    { key: "scheduledAt", label: "Scheduled at (ISO or YYYY-MM-DD HH:MM)", required: true },
    { key: "leadEmail", label: "Lead email", required: true },
    { key: "notes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  package: [
    { key: "name", label: "Package name", required: true },
    { key: "description", label: "Description", required: false },
    { key: "basePrice", label: "Base price", required: false },
    { key: "category", label: "Category", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  event: [
    { key: "name", label: "Event name", required: true },
    { key: "eventDate", label: "Event date", required: true },
    { key: "eventEndDate", label: "Event end date", required: false },
    { key: "clientEmail", label: "Client email", required: true },
    { key: "startTime", label: "Start time", required: false },
    { key: "endTime", label: "End time", required: false },
    { key: "setupTime", label: "Setup time", required: false },
    { key: "teardownTime", label: "Teardown time", required: false },
    { key: "spaceName", label: "Event space name", required: false },
    { key: "guestCount", label: "Guest count", required: false },
    { key: "eventType", label: "Event type", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  key_date: [
    { key: "label", label: "Label", required: true },
    { key: "date", label: "Date", required: true },
    { key: "clientEmail", label: "Client email", required: true },
    { key: "note", label: "Note", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  payment: [],
  document: [
    { key: "name", label: "Document name", required: true },
    { key: "fileName", label: "File name", required: true },
    { key: "storagePath", label: "Storage path (from upload)", required: true },
    { key: "storageUrl", label: "Storage URL (from upload)", required: true },
    { key: "category", label: "Category (contract, insurance, …)", required: false },
    { key: "entityType", label: "Attach to (event or client)", required: false },
    { key: "eventId", label: "Event id", required: false },
    { key: "clientEmail", label: "Client email", required: false },
    { key: "eventDate", label: "Event date (with client email)", required: false },
    { key: "notes", label: "Notes", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  active_commitment: [
    { key: "clientEmail", label: "Client email", required: true },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: true },
    { key: "eventId", label: "Event id (optional if email+date unique)", required: false },
    { key: "contractedTotal", label: "Contracted total", required: true },
    { key: "packageName", label: "Package / commitment name", required: true },
    { key: "paidAmount", label: "Already paid amount", required: false },
    { key: "paidDate", label: "Paid date", required: false },
    { key: "paidMethod", label: "Paid method (other, check, …)", required: false },
    { key: "remainingAmount1", label: "Remaining payment 1 amount", required: false },
    { key: "remainingDueDate1", label: "Remaining payment 1 due date", required: false },
    { key: "remainingAmount2", label: "Remaining payment 2 amount", required: false },
    { key: "remainingDueDate2", label: "Remaining payment 2 due date", required: false },
    { key: "scheduleLinesJson", label: "Full schedule JSON (overrides paid/remaining columns)", required: false },
    { key: "contractTitle", label: "Externally executed agreement title", required: false },
    { key: "contractSignedAt", label: "Signed date (outside HTC)", required: false },
    { key: "shareSignedAgreementWithCouple", label: "Share with couple? (yes/no)", required: false },
    { key: "documentFileName", label: "Signed PDF file name", required: false },
    { key: "documentStoragePath", label: "Signed PDF storage path", required: false },
    { key: "documentStorageUrl", label: "Signed PDF storage URL", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  guest_list: [
    { key: "clientEmail", label: "Client email (for Event resolution)", required: true },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: true },
    { key: "eventId", label: "Event id (optional)", required: false },
    { key: "firstName", label: "Guest first name", required: true },
    { key: "lastName", label: "Guest last name", required: false },
    { key: "guestEmail", label: "Guest email", required: false },
    { key: "phone", label: "Guest phone", required: false },
    { key: "household", label: "Household name", required: false },
    { key: "rsvpStatus", label: "RSVP (pending/attending/declined/maybe)", required: false },
    { key: "mealChoice", label: "Meal choice", required: false },
    { key: "dietaryRestrictions", label: "Dietary notes", required: false },
    { key: "isChild", label: "Child? (yes/no)", required: false },
    { key: "isWeddingParty", label: "Wedding party? (yes/no)", required: false },
    { key: "plusOne", label: "Has a plus one? (yes/no)", required: false },
    { key: "plusOneName", label: "Plus one's name", required: false },
    { key: "dietaryTags", label: "Dietary tags (vegetarian, vegan, gluten_free, dairy_free, nut_allergy, shellfish_allergy, kosher, halal)", required: false },
    { key: "accessibilityTags", label: "Accessibility tags (wheelchair, limited_mobility, hearing_assistance, vision_assistance, service_animal, special_seating)", required: false },
    { key: "accessibilityNotes", label: "Accessibility notes", required: false },
    { key: "age", label: "Age (children)", required: false },
    { key: "highChairRequired", label: "High chair required? (yes/no)", required: false },
    { key: "childNotes", label: "Child notes", required: false },
    { key: "isVendorMeal", label: "Vendor meal placeholder? (yes/no)", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  event_vendor_assignment: [
    { key: "clientEmail", label: "Client email (for Event resolution)", required: true },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: true },
    { key: "eventId", label: "Event id (optional)", required: false },
    { key: "vendorBusinessName", label: "Vendor business name", required: true },
    { key: "vendorId", label: "Vendor id (if already in HTC)", required: false },
    { key: "category", label: "Category (photographer, florist, …)", required: false },
    { key: "vendorEmail", label: "Vendor email", required: false },
    { key: "arrivalTime", label: "Arrival time (HH:MM)", required: false },
    { key: "setupLocation", label: "Setup location", required: false },
    { key: "loadInNotes", label: "Load-in notes", required: false },
    { key: "agreedFee", label: "Agreed fee", required: false },
    { key: "paymentStatus", label: "Payment status (pending/paid)", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  timeline_entry: [
    { key: "clientEmail", label: "Client email (for Event resolution)", required: true },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: true },
    { key: "eventId", label: "Event id (optional)", required: false },
    { key: "title", label: "Timeline item title", required: true },
    { key: "entryTime", label: "Start time (HH:MM)", required: false },
    { key: "dayOffset", label: "Day offset (0 = event day)", required: false },
    { key: "audiences", label: "Audiences (venue,vendors,wedding_party)", required: false },
    { key: "lockState", label: "Lock state (locked/editable)", required: false },
    { key: "timelineFinalized", label: "Finalized day-of timeline? (yes/no)", required: false },
    { key: "forceImport", label: "Force import even if >21 days? (yes/no)", required: false },
    { key: "sourceId", label: "Their own record ID", required: false },
  ],
  floor_plan: [
    { key: "fileName", label: "File name", required: true },
    { key: "storagePath", label: "Storage path (from upload)", required: true },
    { key: "storageUrl", label: "Storage URL (from upload)", required: true },
    { key: "renderableImageUrl", label: "Editor preview URL (image or PDF page-1)", required: false },
    { key: "scope", label: "Scope (space_master / event_specific / general_reference)", required: true },
    { key: "spaceId", label: "Space id", required: false },
    { key: "spaceName", label: "Space name", required: false },
    { key: "eventId", label: "Event id", required: false },
    { key: "eventName", label: "Event name", required: false },
    { key: "eventDate", label: "Event date (YYYY-MM-DD)", required: false },
    { key: "sourceId", label: "Stable source id", required: false },
  ],
};

const NEEDS_DECISION_STATUSES = ["duplicate_likely", "conflict", "needs_review"] as const;

/** Plain-language status, computed from the session's actual current state — never the raw enum. */
function humanStatus(state: SessionResumeState | null, session: MigrationSession): { label: string; tone: "success" | "warning" | "destructive" | "outline" } {
  if (session.status === "failed" && state !== "partially_done") return { label: "Something went wrong", tone: "destructive" };
  if (session.status === "abandoned") return { label: "Stopped", tone: "outline" };
  switch (state) {
    case "empty":
    case "needs_processing": return { label: "Uploaded — not yet reviewed", tone: "outline" };
    case "needs_review": return { label: "Needs your attention", tone: "warning" };
    case "ready_to_commit": return { label: "Ready to import", tone: "outline" };
    case "partially_done": return { label: "Partly imported — some records need attention", tone: "warning" };
    case "done": return { label: "Complete", tone: "success" };
    default: return { label: "In progress", tone: "outline" };
  }
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
    validated: { label: "Ready", variant: "success" },
    approved: { label: "Approved", variant: "success" },
    committed: { label: "Imported", variant: "success" },
    duplicate_exact: { label: "Already exists — will skip", variant: "outline" },
    duplicate_likely: { label: "Possible duplicate", variant: "warning" },
    conflict: { label: "Needs a decision", variant: "warning" },
    needs_review: { label: "Couldn't read this row", variant: "destructive" },
    rejected: { label: "Intentionally excluded", variant: "outline" },
    skipped: { label: "Already in Hello to Cheers", variant: "outline" },
  };
  const m = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

/** Plain-language outcome sentence for a summary's counts — the "did everything make it in?" answer. */
function outcomeSentence(summary: SessionSummary): string {
  return formatSessionOutcomeSentence(summary.counts);
}

function recordHeadline(r: MigrationRecord): string {
  const p = r.normalizedPayload ?? {};
  const name =
    [p.firstName, p.lastName].filter(Boolean).join(" ")
    || String(p.businessName ?? p.name ?? p.title ?? "").trim()
    || r.sourceRowRef
    || "Record";
  const date = String(p.eventDate ?? p.holdDate ?? p.startDate ?? "").trim();

  if (r.targetEntityType === "floor_plan") {
    const scope = String(p.scope ?? "");
    if (scope === "space_master") {
      const space = String(p.spaceName ?? "").trim();
      return space
        ? `${name} · Floor plan → Space ${space}`
        : `${name} · Floor plan → Space`;
    }
    if (scope === "event_specific") {
      const event = String(p.eventName ?? "").trim();
      if (event && date) return `${name} · Floor plan → Event · ${event} · ${date}`;
      if (event) return `${name} · Floor plan → Event · ${event}`;
      if (date) return `${name} · Floor plan → Event · ${date}`;
      return `${name} · Floor plan → Event`;
    }
    if (scope === "general_reference") {
      return `${name} · Floor plan · Reference document`;
    }
    return `${name} · Floor plan`;
  }

  const entity = r.targetEntityType.replace(/_/g, " ");
  if (date) return `${name} · ${entity} · ${date}`;
  return `${name} · ${entity}`;
}

export function MigrationCenter({
  sourceProfiles,
  cutover,
  venueId,
}: {
  sourceProfiles: SourceProfile[];
  cutover: CutoverPrerequisite;
  venueId: string;
}) {
  const [sessions, setSessions] = React.useState<MigrationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [resume, setResume] = React.useState<{ state: SessionResumeState; summary: SessionSummary } | null>(null);
  const [decisionRecords, setDecisionRecords] = React.useState<MigrationRecord[]>([]);
  const [sourceFiles, setSourceFiles] = React.useState<SessionSourceFile[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [starting, setStarting] = React.useState(false);

  const namedProfiles = React.useMemo(() => namedSourceProfiles(sourceProfiles), [sourceProfiles]);
  const [lane, setLane] = React.useState<SourceSelectionLane>("another_system");
  const sourceKey = sourceKeyForLane(lane);
  const [entityType, setEntityType] = React.useState<MigrationEntityType>("client");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<CsvRow[]>([]);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [suggesting, startSuggest] = React.useTransition();
  const [smartText, setSmartText] = React.useState("");
  const [smartNotes, setSmartNotes] = React.useState<string[]>([]);
  const [smartWorking, setSmartWorking] = React.useState(false);
  const [commitmentDraft, setCommitmentDraft] = React.useState<NormalizedActiveCommitment | null>(null);
  const smartFileRef = React.useRef<HTMLInputElement>(null);

  const selectedProfile = sourceProfiles.find((p) => p.key === sourceKey) ?? sourceProfiles[0];
  const guidance = sourceSelectionGuidance(lane, selectedProfile ?? null);
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const refreshSessions = React.useCallback(() => {
    startLoading(async () => setSessions(await listMigrationSessionsAction()));
  }, []);

  React.useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const openSession = React.useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    startLoading(async () => {
      const [resumeState, files] = await Promise.all([
        getMigrationSessionResumeStateAction(sessionId),
        getMigrationSessionSourceFilesAction(sessionId),
      ]);
      setResume(resumeState);
      setSourceFiles(files);
      if (resumeState && (resumeState.state === "needs_review" || resumeState.state === "partially_done")) {
        const needsDecision = (await Promise.all(NEEDS_DECISION_STATUSES.map((status) => getMigrationSessionRecordsAction(sessionId, status)))).flat();
        setDecisionRecords(needsDecision as MigrationRecord[]);
      } else {
        setDecisionRecords([]);
      }
      // Resume may have advanced a settled session (e.g. Don't import only) to
      // committed — refresh History so the badge matches Complete.
      setSessions(await listMigrationSessionsAction());
    });
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    Papa.parse<CsvRow>(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const hs = results.meta.fields ?? [];
        setHeaders(hs);
        setRows(results.data);
        const fields = FIELD_KEYS_BY_ENTITY[entityType];
        const auto: Record<string, string> = {};
        for (const f of fields) {
          const found = hs.find((h) => h.trim().toLowerCase() === f.label.toLowerCase() || h.trim().toLowerCase() === f.key.toLowerCase());
          if (found) auto[f.key] = found;
        }
        setMapping(auto);

        // Best-effort recognition only — never forces a source; venue can keep
        // "another system" / manual mapping. Uses existing recognizeSource().
        const detected = recognizeSource(hs);
        const detectedLane = detected ? laneForRecognizedSource(detected) : null;
        if (detectedLane && namedProfiles.some((p) => p.key === detected)) {
          const label = namedProfiles.find((p) => p.key === detected)?.displayName ?? detected;
          if (lane !== detectedLane) {
            setLane(detectedLane);
            toast.success(`This file looks like a ${label} export — we selected it for you. You can change that anytime.`);
          } else {
            toast.success(`Read ${results.data.length} rows from ${file.name}.`);
          }
        } else {
          toast.success(`Read ${results.data.length} rows from ${file.name}.`);
        }
      },
      error: () => toast.error("Could not read that file."),
    });
  }

  // Fills in whatever the exact-label auto-match (handleFile, above) couldn't
  // confidently resolve — an unfamiliar competitor-export header like
  // "Bride/Groom" instead of "First Name". A proposal only: it only ever
  // fills *unmapped* fields, never overwrites a mapping already set by the
  // auto-match or by the coordinator. Same lib/luv/import-assist.ts function
  // already used by the CSV Import wizard's own "Suggest with Luv" — no
  // second AI mapping system.
  function handleSuggestMapping() {
    startSuggest(async () => {
      const result = await proposeMigrationFieldMappingAction(headers, entityType);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const next = { ...mapping };
      let filled = 0;
      for (const [key, header] of Object.entries(result.mapping)) {
        if (!next[key] && header) { next[key] = header; filled++; }
      }
      if (filled === 0) {
        toast.info("Luv didn't find any new matches beyond what's already mapped.");
        return;
      }
      setMapping(next);
      toast.success(`Luv suggested ${filled} mapping${filled === 1 ? "" : "s"} — review before continuing.`);
    });
  }

  async function uploadSourceFile(sessionId: string, file: File) {
    try {
      const supabase = createClient();
      const docId = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";
      // Same storage architecture components/document-workspace/upload-
      // button.tsx already uses (the `documents` bucket, an unguessable
      // random path) — a migration source file is stored as an ordinary,
      // venue-level document, not a parallel storage system. sessionId and
      // docId are both random UUIDs, so this path is not enumerable —
      // matching every other document in this bucket's own security model.
      const fullPath = `migration/${sessionId}/${docId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(fullPath, file, { upsert: false, contentType: file.type });
      if (uploadError) { toast.error("Could not save the original file, but your data was still read and imported."); return; }
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fullPath);
      await attachMigrationSourceFileAction(sessionId, {
        fileName: file.name, fileSize: file.size, mimeType: file.type, storagePath: fullPath, storageUrl: urlData.publicUrl,
      });
    } catch {
      toast.error("Could not save the original file, but your data was still read and imported.");
    }
  }

  async function handleStartAndUpload() {
    if (eventImportBlocked) {
      toast.error(cutover.message ?? "Add Event Spaces before importing dated Events.");
      return;
    }
    if (rows.length === 0) { toast.error("Choose a file first."); return; }
    setStarting(true);
    try {
      const started = await startMigrationSessionAction(sourceKey);
      if (!started.ok) { toast.error(started.message); return; }
      if (pendingFile) await uploadSourceFile(started.session.id, pendingFile);
      const sourceRows = rows.map((row) => {
        const mapped: Record<string, string | null> = {};
        for (const [key, col] of Object.entries(mapping)) mapped[key] = (row[col] ?? "").trim() || null;
        return mapped;
      });
      const added = await addMigrationRowsAction(started.session.id, entityType, sourceRows);
      if (!added.ok) { toast.error(added.message); return; }
      const deduped = await runMigrationDedupeAction(started.session.id);
      if (!deduped.ok) { toast.error(deduped.message); return; }
      toast.success("Files recognized and checked for duplicates — review below.");
      setRows([]); setHeaders([]); setMapping({}); setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      refreshSessions();
      openSession(started.session.id);
    } finally {
      setStarting(false);
    }
  }

  function handleContinueProcessing(sessionId: string) {
    startLoading(async () => {
      const result = await runMigrationDedupeAction(sessionId);
      if (!result.ok) { toast.error(result.message); return; }
      openSession(sessionId);
      refreshSessions();
    });
  }

  function handleDecision(sessionId: string, recordId: string, decision: "approve" | "reject" | "approve_historical") {
    startLoading(async () => {
      const result = await reviewMigrationRecordAction(sessionId, recordId, decision);
      if (result.ok) openSession(sessionId);
      else toast.error(result.message);
    });
  }

  function handleRetryRecord(sessionId: string, recordId: string) {
    startLoading(async () => {
      const result = await retryMigrationRecordAction(sessionId, recordId);
      if (result.ok) {
        toast.success("Imported after retry.");
        openSession(sessionId);
        refreshSessions();
      } else {
        toast.error(result.message);
        openSession(sessionId);
      }
    });
  }

  function handleCommit(sessionId: string) {
    startLoading(async () => {
      const result = await commitMigrationSessionAction(sessionId);
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`Imported ${result.outcome.committed}, skipped ${result.outcome.skipped}${result.outcome.failed ? `, ${result.outcome.failed} need another look` : ""}.`);
      openSession(sessionId);
      refreshSessions();
    });
  }

  async function handleSmartActiveCommitmentFromText() {
    if (!smartText.trim()) {
      toast.error("Paste the contract or booking text first, or upload a PDF/DOCX.");
      return;
    }
    setSmartWorking(true);
    try {
      const extracted = await proposeActiveCommitmentFromTextAction(smartText);
      if (!extracted.ok) {
        toast.error(extracted.message);
        return;
      }
      setSmartNotes(extracted.confidenceNotes);
      setCommitmentDraft(extracted.proposal);
      setEntityType("active_commitment");
      toast.success("Proposal ready — review every number before importing.");
    } finally {
      setSmartWorking(false);
    }
  }

  async function handleSmartActiveCommitmentFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSmartWorking(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const extracted = await proposeActiveCommitmentFromFileAction(formData);
      if (!extracted.ok) {
        toast.error(extracted.message);
        return;
      }
      setSmartNotes(extracted.confidenceNotes);
      setCommitmentDraft(extracted.proposal);
      setEntityType("active_commitment");
      toast.success("Original file retained. Review the proposed commitment before importing.");
    } finally {
      setSmartWorking(false);
      if (smartFileRef.current) smartFileRef.current.value = "";
    }
  }

  async function handleConfirmActiveCommitment() {
    if (!commitmentDraft) return;
    setSmartWorking(true);
    try {
      const result = await commitReviewedActiveCommitmentAction(sourceKey, commitmentDraft);
      if (!result.ok) {
        toast.error("message" in result ? result.message : "Could not import this commitment.");
        return;
      }
      toast.success(
        result.outcome.committed > 0
          ? "Active commitment imported into Hello to Cheers."
          : `Imported ${result.outcome.committed}, skipped ${result.outcome.skipped}${result.outcome.failed ? `, ${result.outcome.failed} need another look` : ""}.`,
      );
      setCommitmentDraft(null);
      setSmartNotes([]);
      setSmartText("");
      refreshSessions();
    } finally {
      setSmartWorking(false);
    }
  }

  const pendingCommitCount = resume ? resume.summary.counts.validated + resume.summary.counts.approved : 0;
  const datedEventsBlocked = !cutover.readyForDatedEvents && (entityType === "event" || entityType === "client");
  const eventImportBlocked = !cutover.readyForDatedEvents && entityType === "event";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{MIGRATION_CENTER_INTRO.title}</CardTitle>
          <CardDescription>{MIGRATION_CENTER_INTRO.body}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-heading">Where are you moving from?</p>
            <RadioGroup
              value={lane}
              onValueChange={(v) => setLane(v as SourceSelectionLane)}
              className="gap-3"
            >
              {SOURCE_SELECTION_LANES.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/20"
                >
                  <RadioGroupItem value={option.id} className="mt-0.5" />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium text-heading">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-sm font-medium text-heading">{guidance.headline}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{guidance.body}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-heading">What are you bringing over?</p>
            <Select value={entityType} onValueChange={(v) => setEntityType(v as MigrationEntityType)} items={COMMITTABLE_ENTITIES.map((e) => ({ value: e, label: ENTITY_LABEL[e] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COMMITTABLE_ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {entityType === "active_commitment" ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-heading">Smart Import — active booked Event</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload the signed PDF/DOCX (preferred) or paste booking text. Hello to Cheers extracts a proposal,
                  retains the original file, and shows a full financial review before anything is created.
                  Import the Client and Event first when they are not already in HTC.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={smartFileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleSmartActiveCommitmentFromFile}
                  className="text-sm"
                  disabled={smartWorking}
                />
              </div>
              <textarea
                value={smartText}
                onChange={(e) => setSmartText(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Or paste contract / booking text here…"
              />
              <Button type="button" variant="outline" onClick={handleSmartActiveCommitmentFromText} disabled={smartWorking || starting}>
                {smartWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Propose from pasted text
              </Button>
              {commitmentDraft ? (
                <ActiveCommitmentReview
                  proposal={commitmentDraft}
                  confidenceNotes={smartNotes}
                  onChange={setCommitmentDraft}
                  onConfirm={handleConfirmActiveCommitment}
                  onCancel={() => { setCommitmentDraft(null); setSmartNotes([]); }}
                  confirming={smartWorking}
                />
              ) : null}
            </div>
          ) : null}

          {datedEventsBlocked && cutover.message ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {cutover.message}{" "}
              <Link href={BRING_YOUR_BUSINESS_ROUTES.calendarAvailability} className="font-medium underline">
                Open Calendar & Availability
              </Link>
              {entityType === "client" ? " You can still import clients that do not have an event date." : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-dashed border-border p-4">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="text-sm" disabled={eventImportBlocked} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              CSV export from {lane === "honeybook" || lane === "tripleseat" ? selectedProfile.displayName : "your current system"}.
              We&apos;ll keep a copy of this file with your migration history. This never connects to or logs into another platform on your behalf.
            </p>
          </div>

          {headers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Match your columns</p>
                <Button type="button" variant="outline" size="sm" onClick={handleSuggestMapping} disabled={suggesting} className="shrink-0">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {suggesting ? "Asking Luv…" : "Suggest with Luv"}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELD_KEYS_BY_ENTITY[entityType].map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <label className="w-40 shrink-0 text-xs text-muted-foreground">{f.label}{f.required && " *"}</label>
                    <Select value={mapping[f.key] ?? "__none__"} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === "__none__" ? "" : v }))} items={[{ value: "__none__", label: "Don't import" }, ...headers.map((h) => ({ value: h, label: h }))]}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Don't import</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleStartAndUpload} disabled={starting || eventImportBlocked}>
                  {starting ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Working…</> : <><Upload className="mr-1.5 h-3.5 w-3.5" />Bring in {rows.length} row{rows.length === 1 ? "" : "s"}</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeSession && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {sourceHistoryLabel(
                  sourceProfiles.find((p) => p.key === activeSession.sourceKey),
                  activeSession.sourceKey,
                )}
              </CardTitle>
              {resume && <StatusPill state={resume.state} session={activeSession} />}
            </div>
            <CardDescription>
              Started {new Date(activeSession.startedAt).toLocaleDateString()} · last activity {new Date(activeSession.lastActivityAt).toLocaleDateString()}
              {resume && <> · {outcomeSentence(resume.summary)}</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceFiles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original file{sourceFiles.length === 1 ? "" : "s"}</p>
                {sourceFiles.map((f) => (
                  <a key={f.documentId} href={f.storageUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/20">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.fileSize)} · uploaded {new Date(f.uploadedAt).toLocaleDateString()}</span>
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}

            {resume?.state === "needs_processing" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">We started reading this file but haven't finished checking it for duplicates yet.</p>
                <Button size="sm" className="mt-2" onClick={() => handleContinueProcessing(activeSession.id)} disabled={loading}>
                  {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking…</> : "Continue checking this file"}
                </Button>
              </div>
            )}

            {resume?.state === "empty" && (
              <p className="text-sm text-muted-foreground">Nothing was recognized from this upload yet.</p>
            )}

            {(resume?.state === "needs_review" || resume?.state === "partially_done") && decisionRecords.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs your decision</p>
                <p className="text-xs text-muted-foreground">
                  These source records are still part of this migration. Resolve the underlying issue and try again, or intentionally exclude them — they will not disappear.
                </p>
                {decisionRecords.filter((r) => r.targetEntityType !== "floor_plan").map((r) => {
                  const historical = isHistoricalRecordEligibleError(r.validationErrors);
                  const liveConflict = isLiveAvailabilityConflictError(r.validationErrors);
                  const displayError = (r.validationErrors?.[0] ?? "").replace(`${HISTORICAL_RECORD_ELIGIBLE}: `, "");
                  const canRetry = !!r.normalizedPayload && (r.status === "needs_review" || r.status === "conflict");
                  return (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-heading">
                        {recordHeadline(r)}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {displayError && <span className="text-[11px] text-muted-foreground">{displayError}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleDecision(activeSession.id, r.id, "reject")} disabled={loading}>Don&apos;t bring this over</Button>
                      {historical ? (
                        <Button size="sm" onClick={() => handleDecision(activeSession.id, r.id, "approve_historical")} disabled={loading}>
                          {HISTORICAL_RECORD_LABEL}
                        </Button>
                      ) : r.status !== "needs_review" && !liveConflict ? (
                        <Button size="sm" onClick={() => handleDecision(activeSession.id, r.id, "approve")} disabled={loading}>Import anyway</Button>
                      ) : canRetry ? (
                        <Button size="sm" onClick={() => handleRetryRecord(activeSession.id, r.id)} disabled={loading}>Try again</Button>
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {pendingCommitCount > 0 && (resume?.state === "ready_to_commit" || resume?.state === "partially_done" || resume?.state === "needs_review") && (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Historical records import quietly — no invite emails, no automated messages, no "new lead" alerts. They'll simply appear in Hello to Cheers.
                </p>
                <Button size="sm" className="shrink-0" onClick={() => handleCommit(activeSession.id)} disabled={loading || pendingCommitCount === 0}>
                  {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Importing…</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Import {pendingCommitCount} record{pendingCommitCount === 1 ? "" : "s"}</>}
                </Button>
              </div>
            )}

            {resume?.state === "done" && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-foreground">
                Everything from this file has been resolved — {outcomeSentence(resume.summary)}.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {venueId ? (
        <FloorPlanMigrationImport
          venueId={venueId}
          sourceKey={sourceKey}
          onSessionReady={(id) => {
            setActiveSessionId(id);
            openSession(id);
            refreshSessions();
          }}
          activeSessionId={activeSessionId}
          floorPlanRecords={decisionRecords.filter((r) => r.targetEntityType === "floor_plan")}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Every migration you've started, with what happened — leave and come back any time.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No migrations started yet.</p>
          ) : (
            <div className="space-y-1.5">
              {sessions.map((s) => {
                const profile = sourceProfiles.find((p) => p.key === s.sourceKey);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openSession(s.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/20 ${s.id === activeSessionId ? "border-primary" : "border-border"}`}
                  >
                    <span>
                      <span className="font-medium text-heading">
                        {sourceHistoryLabel(profile, s.sourceKey)}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                    </span>
                    <SessionListBadge session={s} />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ state, session }: { state: SessionResumeState; session: MigrationSession }) {
  const { label, tone } = humanStatus(state, session);
  return <Badge variant={tone}>{label}</Badge>;
}

/**
 * The history list can't afford a resume-state fetch per row up front (N
 * sessions -> N calls) — it renders directly from the already-loaded
 * MigrationSession.status, mapped to the same plain-language vocabulary
 * humanStatus() uses for the open session, just without the extra
 * "ready to commit vs. needs review" nuance that requires per-record
 * counts. Opening a session (openSession) always fetches the precise
 * resume state for the detail view above.
 */
function SessionListBadge({ session }: { session: MigrationSession }) {
  const map: Record<MigrationSession["status"], { label: string; tone: "success" | "warning" | "destructive" | "outline" }> = {
    uploaded: { label: "Uploaded — not yet reviewed", tone: "outline" },
    recognizing: { label: "Processing…", tone: "outline" },
    mapping: { label: "Processing…", tone: "outline" },
    validating: { label: "Processing…", tone: "outline" },
    ready_for_review: { label: "Needs your attention", tone: "warning" },
    committing: { label: "Importing…", tone: "outline" },
    committed: { label: "Complete", tone: "success" },
    partially_committed: { label: "Partly imported", tone: "warning" },
    failed: { label: "Something went wrong", tone: "destructive" },
    abandoned: { label: "Stopped", tone: "outline" },
  };
  const m = map[session.status] ?? { label: session.status, tone: "outline" as const };
  return <Badge variant={m.tone}>{m.label}</Badge>;
}
