import { strToU8, zipSync } from "fflate";

/** Keys removed everywhere in the archive. Mirrors venue_export_redact in SQL. */
export const EXPORT_REDACT_KEYS = [
  "stripe_account_id",
  "embed_key",
  "tour_embed_key",
  "sign_token",
  "access_token",
  "refresh_token",
  "user_access_token",
  "page_access_token",
  "client_secret",
  "api_key",
  "webhook_secret",
  "password",
  "password_hash",
  "secret_key",
  "token",
  "claim_token",
  "luv_draft_id",
  "luv_intro_seen_at",
] as const;

const REDACT = new Set(
  EXPORT_REDACT_KEYS.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, "")),
);

const BRANDING_KEYS = new Set([
  "name",
  "businessName",
  "logoUrl",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "neutralColor",
  "email",
  "phone",
  "website",
  "addressLine1",
  "addressLine2",
  "city",
  "stateRegion",
  "postalCode",
  "country",
]);

const CHANNEL_METADATA_KEYS = new Set([
  "sequenceEnrollmentId",
  "sourceType",
  "sourceId",
  "automated",
]);

const EVENT_ORDER_SHARE_KEYS = new Set(["sections", "lines", "total"]);

const INQUIRY_CONTEXT_KEYS = new Set([
  "eventId",
  "eventDate",
  "eventType",
  "venueName",
  "coupleName",
]);

function exportKeyBlocked(key: string): boolean {
  return REDACT.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
}

function projectObject(value: unknown, keys: Set<string>): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key)) out[key] = child;
  }
  return out;
}

function mapRows(
  value: unknown,
  column: string,
  keys: Set<string>,
): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const record = row as Record<string, unknown>;
    if (!(column in record)) return row;
    return { ...record, [column]: projectObject(record[column], keys) };
  });
}

/** Keep known business shapes. Other venue-authored JSON stays intact for redaction. */
export function shapeExportCollections(collections: Record<string, unknown>): Record<string, unknown> {
  return {
    ...collections,
    contracts: mapRows(collections.contracts, "branding_snapshot", BRANDING_KEYS),
    invoices: mapRows(collections.invoices, "branding_snapshot", BRANDING_KEYS),
    conversation_messages: mapRows(collections.conversation_messages, "channel_metadata", CHANNEL_METADATA_KEYS),
    event_order_share_snapshots: mapRows(collections.event_order_share_snapshots, "payload", EVENT_ORDER_SHARE_KEYS),
    conversations: mapRows(collections.conversations, "inquiry_context", INQUIRY_CONTEXT_KEYS),
  };
}

export const EXPORT_FILE_BUCKETS = [
  "documents",
  "couple-messages",
  "contract-representations",
  "event-order-representations",
  "floor-plans",
  "uploads",
] as const;

export type ExportFileBucket = (typeof EXPORT_FILE_BUCKETS)[number];

export type ExportFileRef = {
  /** Null means the object lives in one of the representation buckets. */
  bucket: ExportFileBucket | null;
  path: string;
  fileName: string;
  /** Stable id used only to disambiguate archive filenames. */
  recordId: string;
  /** Path under Documents-and-Uploads, before collision suffixes. */
  proposedName: string;
};

const OMITTED = [
  { name: "Wedding websites", reason: "Couple-owned website content is not part of the venue export." },
  { name: "Couple planning data", reason: "Guest lists, seating, budgets, RSVP answers, and questionnaire answers stay with the couple export." },
  { name: "Luv", reason: "Luv recommendations, drafts, and internal signals are excluded." },
  { name: "Credentials", reason: "Passwords, tokens, embed keys, and payment-account secrets are excluded." },
  { name: "Platform operations", reason: "Hello to Cheers CRM, HQ, and incident records are excluded." },
];

export function redactExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactExportValue(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (exportKeyBlocked(key)) continue;
    out[key] = redactExportValue(child);
  }
  return out;
}

/**
 * Documents rows for conversation uploads keep the couple-messages object path
 * (`conversations/{venueId}/…`). Workspace files stay in the documents bucket.
 */
export function documentExportBucket(storagePath: string): ExportFileBucket {
  return storagePath.startsWith("conversations/") ? "couple-messages" : "documents";
}

export function venueOwnsStoragePath(venueId: string, storagePath: string): boolean {
  if (!venueId || !storagePath) return false;
  const parts = storagePath.split("/").filter(Boolean);
  return parts.includes(venueId);
}

export function storagePathFromUrl(url: string, bucket: string): string | null {
  for (const marker of [`/object/public/${bucket}/`, `/object/sign/${bucket}/`, `/object/${bucket}/`]) {
    const index = url.indexOf(marker);
    if (index >= 0) {
      const rest = url.slice(index + marker.length).split("?")[0] ?? "";
      try {
        return decodeURIComponent(rest) || null;
      } catch {
        return rest || null;
      }
    }
  }
  return null;
}

function pushFile(
  files: ExportFileRef[],
  seen: Set<string>,
  venueId: string,
  bucket: ExportFileBucket | null,
  storagePath: string | null | undefined,
  fileName: string,
  recordId: string,
  proposedName: string,
) {
  if (!storagePath || !venueOwnsStoragePath(venueId, storagePath)) return;
  const key = `${bucket ?? "resolve"}/${storagePath}`;
  if (seen.has(key)) return;
  seen.add(key);
  files.push({
    bucket,
    path: storagePath,
    fileName: fileName || storagePath.split("/").at(-1) || "file",
    recordId: recordId || storagePath,
    proposedName,
  });
}

const DOCUMENT_CATEGORY_FOLDERS: Record<string, string> = {
  contract: "Contracts",
  insurance: "Insurance",
  inspiration: "Inspiration",
  floor_plan: "Floor-plans",
  menu: "Menus",
  permit: "Permits",
  questionnaire: "Questionnaires",
  invoice_copy: "Invoice-copies",
  other: "Other",
};

export function sanitizeExportLabel(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "Venue";
}

export function venueExportBaseName(venueName: string, exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  return `Hello-to-Cheers-Export-${sanitizeExportLabel(venueName)}-${date}`;
}

export function safeArchiveFileName(value: string): string {
  const cleaned = value.replace(/[\\/\0]/g, "-").replace(/^\.+/, "").trim();
  return cleaned || "file";
}

function fileExtension(path: string): string {
  const base = path.split("/").at(-1) ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

function categoryFolder(category: unknown): string {
  const key = typeof category === "string" ? category : "other";
  return DOCUMENT_CATEGORY_FOLDERS[key] ?? "Other";
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") as Record<string, unknown>[] : [];
}

export function collectExportFiles(collections: Record<string, unknown>, venueId: string): ExportFileRef[] {
  const files: ExportFileRef[] = [];
  const seen = new Set<string>();
  for (const row of rows(collections.documents)) {
    const path = stringField(row.storage_path);
    const original = stringField(row.file_name) || "document";
    const folder = path.startsWith("conversations/") ? "Message-attachments" : categoryFolder(row.category);
    pushFile(
      files, seen, venueId, documentExportBucket(path), path, original, stringField(row.id),
      `${folder}/${safeArchiveFileName(original)}`,
    );
  }
  for (const row of rows(collections.document_file_versions)) {
    const path = stringField(row.storage_path);
    const original = stringField(row.file_name) || "document-version";
    pushFile(
      files, seen, venueId, documentExportBucket(path), path, original, stringField(row.id),
      `Document-versions/${safeArchiveFileName(original)}`,
    );
  }
  for (const row of rows(collections.message_attachments)) {
    const path = stringField(row.storage_path);
    const original = stringField(row.name) || "attachment";
    pushFile(
      files, seen, venueId, documentExportBucket(path), path, original, stringField(row.id),
      `Message-attachments/${safeArchiveFileName(original)}`,
    );
  }
  for (const row of rows(collections.floor_plans)) {
    const url = stringField(row.background_image_url);
    if (!url) continue;
    const path = storagePathFromUrl(url, "floor-plans") ?? (venueOwnsStoragePath(venueId, url) ? url : null);
    const ext = path ? fileExtension(path) : "";
    const label = safeArchiveFileName(stringField(row.name) || "floor-plan");
    pushFile(
      files, seen, venueId, "floor-plans", path, label, stringField(row.id),
      `Floor-plans/${ext ? `${label}.${ext}` : label}`,
    );
  }
  for (const row of rows(collections.canonical_document_representations)) {
    const path = stringField(row.storage_path);
    const kind = safeArchiveFileName(stringField(row.representation_type) || "representation");
    const ext = fileExtension(path);
    const id = stringField(row.id) || "file";
    pushFile(
      files, seen, venueId, null, path, kind, id,
      `Generated-documents/${kind}-${id}${ext ? `.${ext}` : ""}`,
    );
  }
  return files;
}

/** Owner-facing spreadsheets. Nested bodies stay in Technical-Backup JSON. */
const CSV_VIEWS: Record<string, { folder: string; file: string; omit: readonly string[] }> = {
  venues: { folder: "Business-Overview", file: "venue-profile.csv", omit: [] },
  venue_business_hours: { folder: "Business-Overview", file: "business-hours.csv", omit: [] },
  venue_spaces: { folder: "Business-Overview", file: "spaces.csv", omit: [] },
  venue_capacity_rules: { folder: "Business-Overview", file: "capacity.csv", omit: [] },
  venue_schedule_item_types: { folder: "Business-Overview", file: "schedule-item-types.csv", omit: [] },
  venue_required_vendor_categories: { folder: "Business-Overview", file: "required-vendor-categories.csv", omit: [] },
  venue_notification_preferences: { folder: "Business-Overview", file: "notification-preferences.csv", omit: [] },
  venue_lead_capture_channels: { folder: "Business-Overview", file: "lead-capture-channels.csv", omit: [] },
  tour_availability_windows: { folder: "Business-Overview", file: "tour-availability-windows.csv", omit: [] },
  tour_availability_exceptions: { folder: "Business-Overview", file: "tour-availability-exceptions.csv", omit: [] },
  calendar_blocks: { folder: "Business-Overview", file: "calendar-blocks.csv", omit: [] },
  date_holds: { folder: "Business-Overview", file: "date-holds.csv", omit: [] },
  date_hold_spaces: { folder: "Business-Overview", file: "date-hold-spaces.csv", omit: [] },
  public_form_questions: { folder: "Business-Overview", file: "public-form-questions.csv", omit: [] },
  inquiry_form_questions: { folder: "Business-Overview", file: "inquiry-form-questions.csv", omit: [] },
  leads: { folder: "Leads-and-Clients", file: "leads.csv", omit: [] },
  lead_notes: { folder: "Leads-and-Clients", file: "lead-notes.csv", omit: [] },
  lead_activities: { folder: "Leads-and-Clients", file: "lead-activities.csv", omit: [] },
  lead_tasks: { folder: "Leads-and-Clients", file: "lead-tasks.csv", omit: [] },
  lead_event_space_preferences: { folder: "Leads-and-Clients", file: "lead-space-preferences.csv", omit: [] },
  clients: { folder: "Leads-and-Clients", file: "clients.csv", omit: [] },
  client_contacts: { folder: "Leads-and-Clients", file: "client-contacts.csv", omit: [] },
  client_notes: { folder: "Leads-and-Clients", file: "client-notes.csv", omit: [] },
  client_activities: { folder: "Leads-and-Clients", file: "client-activities.csv", omit: [] },
  client_media: { folder: "Leads-and-Clients", file: "client-media.csv", omit: ["file_url"] },
  client_invitations: { folder: "Leads-and-Clients", file: "client-invitations.csv", omit: [] },
  events: { folder: "Events-and-Planning", file: "events.csv", omit: [] },
  event_notes: { folder: "Events-and-Planning", file: "event-notes.csv", omit: [] },
  event_activities: { folder: "Events-and-Planning", file: "event-activities.csv", omit: [] },
  event_space_assignments: { folder: "Events-and-Planning", file: "event-spaces.csv", omit: [] },
  event_team: { folder: "Events-and-Planning", file: "event-team.csv", omit: [] },
  event_inventory: { folder: "Events-and-Planning", file: "event-inventory.csv", omit: [] },
  event_inventory_items: { folder: "Events-and-Planning", file: "event-inventory-items.csv", omit: [] },
  packages: { folder: "Events-and-Planning", file: "packages.csv", omit: [] },
  package_items: { folder: "Events-and-Planning", file: "package-items.csv", omit: [] },
  offerings: { folder: "Events-and-Planning", file: "offerings.csv", omit: [] },
  offering_categories: { folder: "Events-and-Planning", file: "offering-categories.csv", omit: [] },
  inventory_items: { folder: "Events-and-Planning", file: "inventory-items.csv", omit: ["image_url"] },
  inventory_categories: { folder: "Events-and-Planning", file: "inventory-categories.csv", omit: [] },
  event_orders: { folder: "Events-and-Planning", file: "event-orders.csv", omit: [] },
  event_order_sections: { folder: "Events-and-Planning", file: "event-order-sections.csv", omit: [] },
  event_order_lines: { folder: "Events-and-Planning", file: "event-order-lines.csv", omit: [] },
  floor_plans: { folder: "Events-and-Planning", file: "floor-plans.csv", omit: ["background_image_url"] },
  timeline_templates: { folder: "Events-and-Planning", file: "timeline-templates.csv", omit: [] },
  timeline_template_items: { folder: "Events-and-Planning", file: "timeline-template-items.csv", omit: [] },
  timeline_sections: { folder: "Events-and-Planning", file: "timeline-sections.csv", omit: [] },
  timeline_entries: { folder: "Events-and-Planning", file: "timeline-entries.csv", omit: [] },
  timeline_entry_links: { folder: "Events-and-Planning", file: "timeline-entry-links.csv", omit: ["url"] },
  event_tasks: { folder: "Events-and-Planning", file: "event-tasks.csv", omit: ["action_url"] },
  contracts: {
    folder: "Contracts-and-Finances",
    file: "contracts.csv",
    omit: ["content", "branding_snapshot", "signer_ip", "signer_user_agent"],
  },
  contract_signers: {
    folder: "Contracts-and-Finances",
    file: "contract-signers.csv",
    omit: ["signer_ip", "signer_user_agent", "content_hash"],
  },
  invoices: { folder: "Contracts-and-Finances", file: "invoices.csv", omit: ["branding_snapshot"] },
  invoice_line_items: { folder: "Contracts-and-Finances", file: "invoice-line-items.csv", omit: [] },
  payment_schedules: { folder: "Contracts-and-Finances", file: "payment-schedules.csv", omit: [] },
  payment_line_items: { folder: "Contracts-and-Finances", file: "payments.csv", omit: [] },
  conversations: { folder: "Communications", file: "conversations.csv", omit: [] },
  conversation_messages: { folder: "Communications", file: "conversation-messages.csv", omit: [] },
  conversation_participants: { folder: "Communications", file: "conversation-participants.csv", omit: [] },
  messages: { folder: "Communications", file: "messages.csv", omit: [] },
  message_threads: { folder: "Communications", file: "message-threads.csv", omit: [] },
  message_thread_participants: { folder: "Communications", file: "message-thread-participants.csv", omit: [] },
  message_attachments: { folder: "Communications", file: "message-attachments.csv", omit: ["storage_url"] },
  scheduled_messages: { folder: "Communications", file: "scheduled-messages.csv", omit: [] },
  message_templates: { folder: "Communications", file: "message-templates.csv", omit: ["email_body", "sms_body"] },
  message_sequences: { folder: "Communications", file: "message-sequences.csv", omit: [] },
  sequence_steps: { folder: "Communications", file: "sequence-steps.csv", omit: [] },
  sequence_enrollments: { folder: "Communications", file: "sequence-enrollments.csv", omit: [] },
  vendors: { folder: "Vendors-and-Team", file: "vendors.csv", omit: ["cover_image_url", "hero_image_url", "logo_url"] },
  venue_vendor_relationships: { folder: "Vendors-and-Team", file: "vendor-relationships.csv", omit: [] },
  event_vendor_assignments: { folder: "Vendors-and-Team", file: "event-vendor-assignments.csv", omit: [] },
  event_vendor_recommendations: { folder: "Vendors-and-Team", file: "event-vendor-recommendations.csv", omit: [] },
  vendor_inquiries: { folder: "Vendors-and-Team", file: "vendor-inquiries.csv", omit: [] },
  venue_staff: { folder: "Vendors-and-Team", file: "staff.csv", omit: ["capability_overrides"] },
  documents: { folder: "Documents-and-Uploads", file: "documents.csv", omit: ["storage_url"] },
  document_file_versions: { folder: "Documents-and-Uploads", file: "document-versions.csv", omit: ["storage_url"] },
};

const VENUE_PROFILE_COLUMNS = [
  "id", "name", "business_name", "email", "phone", "address_line1", "address_line2",
  "city", "state_region", "postal_code", "country", "capacity", "currency",
];

export function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function recordsToCsv(records: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.map((column) => csvCell(column)).join(",")];
  for (const record of records) {
    lines.push(columns.map((column) => csvCell(record[column])).join(","));
  }
  return `${lines.join("\r\n")}\n`;
}

function collectionRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return rows(value);
  if (value && typeof value === "object") return [value as Record<string, unknown>];
  return [];
}

function csvColumns(name: string, records: Record<string, unknown>[], omit: readonly string[]): string[] {
  if (name === "venues") return VENUE_PROFILE_COLUMNS.filter((column) => records.some((row) => column in row));
  const present = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!omit.includes(key)) present.add(key);
    }
  }
  const preferred = ["id", "venue_id"].filter((key) => present.has(key));
  const foreign = [...present].filter((key) => key.endsWith("_id") && !preferred.includes(key)).sort();
  const rest = [...present].filter((key) => !preferred.includes(key) && !foreign.includes(key)).sort();
  return [...preferred, ...foreign, ...rest];
}

export function assignUniqueArchiveNames(files: readonly ExportFileRef[]): Map<ExportFileRef, string> {
  const used = new Set<string>();
  const assigned = new Map<ExportFileRef, string>();
  for (const file of files) {
    let name = file.proposedName;
    if (used.has(name)) {
      const slash = name.lastIndexOf("/");
      const base = slash >= 0 ? name.slice(slash + 1) : name;
      const dir = slash >= 0 ? name.slice(0, slash + 1) : "";
      const dot = base.lastIndexOf(".");
      const suffix = file.recordId.replace(/-/g, "").slice(-8) || "copy";
      name = dot > 0
        ? `${dir}${base.slice(0, dot)}-${suffix}${base.slice(dot)}`
        : `${dir}${base}-${suffix}`;
      let extra = 2;
      while (used.has(name)) {
        name = dot > 0
          ? `${dir}${base.slice(0, dot)}-${suffix}-${extra}${base.slice(dot)}`
          : `${dir}${base}-${suffix}-${extra}`;
        extra += 1;
      }
    }
    used.add(name);
    assigned.set(file, name);
  }
  return assigned;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type ArchiveEntry = { path: string; kind: "guide" | "spreadsheet" | "json" | "original"; records?: number };

function venueDisplayName(collections: Record<string, unknown>, fallback: string | undefined): string {
  const venue = collections.venues;
  if (venue && typeof venue === "object" && !Array.isArray(venue)) {
    const name = stringField((venue as Record<string, unknown>).name);
    if (name) return name;
  }
  return fallback?.trim() || "Venue";
}

export function buildStartHere(input: {
  venueName: string;
  exportedAt: string;
  entries: ArchiveEntry[];
}): string {
  const spreadsheets = input.entries.filter((entry) => entry.kind === "spreadsheet");
  const originals = input.entries.filter((entry) => entry.kind === "original");
  const lines = [
    "Hello to Cheers data export",
    `Venue: ${input.venueName}`,
    `Exported: ${input.exportedAt}`,
    "",
    "Times in this export are Coordinated Universal Time (UTC). A timestamp ending in Z is UTC.",
    "",
    "How to open this folder",
    "- Files ending in .csv open in Excel or Google Sheets. They are convenient views of the main records.",
    "- The complete copy of every record is the matching JSON file in Technical-Backup. Use that file when a spreadsheet does not show the whole record, including contract text and other structured details.",
    originals.length
      ? "- Original uploads keep their original format in Documents-and-Uploads."
      : "- This export did not include original uploaded files.",
    "",
    "Open these files",
  ];
  if (!spreadsheets.length) lines.push("- No spreadsheets were included because those lists were empty.");
  for (const entry of spreadsheets) lines.push(`- ${entry.path}`);
  if (originals.length) {
    lines.push("", "Original documents");
    for (const entry of originals) lines.push(`- ${entry.path}`);
  }
  lines.push(
    "",
    "How related records connect",
    "Spreadsheets include the record id and the related record ids that already exist, such as client_id, event_id, invoice_id, and schedule_id. Match those ids to connect a lead to a client, an invoice to its lines, or a payment to its schedule.",
    "",
    "What a JSON file is",
    "Each file in Technical-Backup is the full structured backup for one kind of record. A spreadsheet is only a convenient view and does not replace that JSON file.",
    "",
    "Not included",
  );
  for (const item of OMITTED) lines.push(`- ${item.name}: ${item.reason}`);
  lines.push("");
  return lines.join("\n");
}

export function buildVenueExportZip(input: {
  venueId: string;
  exportedAt: string;
  venueName?: string;
  collections: Record<string, unknown>;
  fileBytes?: Array<{ file: ExportFileRef; bytes: Uint8Array }>;
}): Uint8Array {
  const collections = redactExportValue(shapeExportCollections(input.collections)) as Record<string, unknown>;
  const counts: Record<string, number> = {};
  const root = venueExportBaseName(venueDisplayName(collections, input.venueName), input.exportedAt);
  const entries: Record<string, Uint8Array> = {};
  const described: ArchiveEntry[] = [];

  for (const [name, value] of Object.entries(collections)) {
    counts[name] = Array.isArray(value) ? value.length : value ? 1 : 0;
    const backupPath = `Technical-Backup/${name}.json`;
    entries[`${root}/${backupPath}`] = strToU8(`${JSON.stringify(value, null, 2)}\n`);
    described.push({ path: backupPath, kind: "json", records: counts[name] });

    const view = CSV_VIEWS[name];
    if (!view) continue;
    const records = collectionRecords(value);
    if (!records.length) continue;
    const columns = csvColumns(name, records, view.omit);
    if (!columns.length) continue;
    const csvPath = `${view.folder}/${view.file}`;
    entries[`${root}/${csvPath}`] = strToU8(recordsToCsv(records, columns));
    described.push({ path: csvPath, kind: "spreadsheet", records: records.length });
  }

  const included = (input.fileBytes ?? []).filter((file) => venueOwnsStoragePath(input.venueId, file.file.path));
  const names = assignUniqueArchiveNames(included.map((file) => file.file));
  const fileManifest: Array<{ bucket: ExportFileBucket | null; path: string; fileName: string; archivePath: string }> = [];
  for (const file of included) {
    const archivePath = `Documents-and-Uploads/${names.get(file.file) ?? file.file.proposedName}`;
    entries[`${root}/${archivePath}`] = file.bytes;
    described.push({ path: archivePath, kind: "original" });
    fileManifest.push({
      bucket: file.file.bucket,
      path: file.file.path,
      fileName: file.file.fileName,
      archivePath,
    });
  }

  described.sort((a, b) => a.path.localeCompare(b.path));
  const startHere = buildStartHere({
    venueName: venueDisplayName(collections, input.venueName),
    exportedAt: input.exportedAt,
    entries: described.filter((entry) => entry.kind !== "json"),
  });
  entries[`${root}/START-HERE.txt`] = strToU8(startHere);
  described.unshift({ path: "START-HERE.txt", kind: "guide" });

  const manifest = {
    exportedAt: input.exportedAt,
    venueId: input.venueId,
    venueName: venueDisplayName(collections, input.venueName),
    counts,
    files: fileManifest,
    entries: described,
    omitted: OMITTED,
  };
  entries[`${root}/manifest.json`] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
  return zipSync(entries);
}
