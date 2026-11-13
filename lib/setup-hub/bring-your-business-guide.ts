/**
 * Customer-facing Bring Your Business guide — a sequence over existing
 * Import Data + Migration Center tools. Not a second import engine.
 */
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";
import type { EntityType, ImportBatch } from "@/lib/import/types";

export const BRING_YOUR_BUSINESS_GUIDE_HREF = "/setup-hub/bring-your-business";

export type BringYourBusinessGuideStepId =
  | "people"
  | "venue-events"
  | "packages-financials"
  | "planning"
  | "review";

/** Truthful statuses from durable records — never “opened the page.” */
export type GuideStepStatus = "not_started" | "imported" | "needs_attention" | "optional";

export type GuideCategory = {
  id: string;
  title: string;
  summary: string;
  canImport: string;
  fileTypes: string;
  required: string;
  optional: string;
  template: string;
  duplicates: string;
  afterward: string;
  href: string;
  hrefLabel: string;
  dependsOn?: { label: string; href: string; hrefLabel: string };
};

export type GuideStepDefinition = {
  id: BringYourBusinessGuideStepId;
  number: 1 | 2 | 3 | 4 | 5;
  title: string;
  summary: string;
  categories: readonly GuideCategory[];
};

export const BRING_YOUR_BUSINESS_GUIDE_STEPS: readonly GuideStepDefinition[] = [
  {
    id: "people",
    number: 1,
    title: "People",
    summary: "Bring over clients, leads, and vendors.",
    categories: [
      {
        id: "clients",
        title: "Clients",
        summary: "People you already work with — booked or not.",
        canImport: "Names, contact details, and optional event dates. Future dates stay on the client until you attach a booking. Past dates can create a historical event.",
        fileTypes: "CSV, Excel (.xlsx/.xls), Word (.docx), PDF, or a pasted list via Import Data. Migration Center accepts CSV for larger client files.",
        required: "First name and last name.",
        optional: "Partner name, email, phone, event date, event type, guest count, times, space name, notes.",
        template: "A CSV template is available on Import Data.",
        duplicates: "Rows that match an existing client are skipped — they are not overwritten and a second copy is not created.",
        afterward: "Imported clients appear under Clients → Contacts until they have an active booking. All Bookings only shows clients with a booking. Nothing is emailed or invited.",
        href: "/settings/import?type=couples",
        hrefLabel: "Import clients",
      },
      {
        id: "leads",
        title: "Leads",
        summary: "Open inquiries that are not booked yet.",
        canImport: "Inquirer names plus optional contact details, event date, budget, and notes.",
        fileTypes: "CSV, Excel, Word, PDF, or a pasted list via Import Data.",
        required: "First name and last name.",
        optional: "Email, phone, event date, event type, guest count, budget, source, notes.",
        template: "A CSV template is available on Import Data.",
        duplicates: "Matching existing leads are skipped.",
        afterward: "Review them on Leads. Historical imports stay quiet — no automations or outreach.",
        href: "/settings/import?type=leads",
        hrefLabel: "Import leads",
      },
      {
        id: "vendors",
        title: "Vendors",
        summary: "Preferred vendors you already work with.",
        canImport: "Business name plus optional category, contact, and notes.",
        fileTypes: "CSV, Excel, Word, PDF, or a pasted list via Import Data.",
        required: "Vendor name.",
        optional: "Category, contact name, email, phone, website, pricing tier, notes.",
        template: "A CSV template is available on Import Data.",
        duplicates: "Matching vendors are skipped.",
        afterward: "They appear on Vendors. Connecting them to events is a later step — nothing is sent automatically.",
        href: "/settings/import?type=vendors",
        hrefLabel: "Import vendors",
      },
    ],
  },
  {
    id: "venue-events",
    number: 2,
    title: "Venue and events",
    summary: "Configure relevant spaces and availability, then bring over upcoming and existing events, tours, holds, and calendar blocks.",
    categories: [
      {
        id: "spaces",
        title: "Spaces and availability",
        summary: "Named spaces and capacity so dated events land in the right place.",
        canImport: "This step is configuration, not a file import. Add event spaces and how many events you can host at once.",
        fileTypes: "Not a file import.",
        required: "Multi-space venues need at least one event space before dated events can import.",
        optional: "Tour availability if you offer tours.",
        template: "None — use Availability & Capacity.",
        duplicates: "Does not create duplicate spaces from a file.",
        afterward: "Dated events, tours, holds, and blocks can use those spaces.",
        href: BRING_YOUR_BUSINESS_ROUTES.calendarAvailability,
        hrefLabel: "Open Availability & Capacity",
      },
      {
        id: "events",
        title: "Events, tours, holds, and blocks",
        summary: "Upcoming and existing calendar commitments.",
        canImport: "Events with dates, spaces, and booking status; tours; date holds; calendar blocks. Clients should exist first so events attach to the right people.",
        fileTypes: "CSV in Migration Center. Excel, Word, or PDF contact lists belong on Import Data — they do not create operational events by themselves.",
        required: "Event date (and a space when you host in more than one space).",
        optional: "Times, guest count, status, client match fields.",
        template: "Column mapping and review happen in Migration Center before anything is created.",
        duplicates: "Rows that look like existing events are held for review — they are not silently duplicated.",
        afterward: "Imported events appear on Calendar. Clients with a booking appear under All Bookings. Contacts without a booking stay under Contacts.",
        href: `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`,
        hrefLabel: "Bring over events",
        dependsOn: {
          label: "Bring over clients first if the events belong to people already on your books.",
          href: "/settings/import?type=couples",
          hrefLabel: "Import clients",
        },
      },
    ],
  },
  {
    id: "packages-financials",
    number: 3,
    title: "Packages and financial information",
    summary: "Bring over package information and supported existing-event financial records.",
    categories: [
      {
        id: "packages",
        title: "Packages",
        summary: "What you sell — names, prices, and included items.",
        canImport: "Package name, description, price, category, and included line items.",
        fileTypes: "CSV, Excel, Word, PDF, or paste via Import Data. Migration Center also accepts a packages CSV.",
        required: "Package name.",
        optional: "Description, base price, category, included items.",
        template: "A CSV template is available on Import Data.",
        duplicates: "Matching packages are skipped.",
        afterward: "Review them in Library → Packages. Starter packages already in Hello to Cheers are separate from what you import.",
        href: "/settings/import?type=packages",
        hrefLabel: "Import packages",
      },
      {
        id: "finances",
        title: "Existing-event finances",
        summary: "Invoices, payment schedules, and signed agreements already in place.",
        canImport: "Supported booked-event financial records: invoice, payments, and a signed agreement file attached to an existing client and event.",
        fileTypes: "PDF or Word (.docx) in Migration Center (Booked-event finances). A spreadsheet of invoices is not a supported importer.",
        required: "The client and their event must already exist in Hello to Cheers.",
        optional: "The original signed file, so it stays on the event.",
        template: "No spreadsheet template — upload the agreement or booking document and review the proposed commitment.",
        duplicates: "Review before import. Hello to Cheers does not silently change existing financial obligations.",
        afterward: "Review balances on the event. No payment requests, invoices, or contract executions are sent automatically.",
        href: `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`,
        hrefLabel: "Bring over finances",
        dependsOn: {
          label: "Event finances require the relevant clients and events to exist first.",
          href: `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`,
          hrefLabel: "Bring over events",
        },
      },
      {
        id: "inventory",
        title: "Inventory templates",
        summary: "Tables, chairs, and other items you place on floor plans.",
        canImport: "Item name plus optional category, quantity, dimensions, shape, and color.",
        fileTypes: "CSV, Excel, Word, PDF, or paste via Import Data.",
        required: "Item name.",
        optional: "Category, quantity, dimensions, shape, color, printable name.",
        template: "A CSV template is available on Import Data.",
        duplicates: "Matching items are skipped.",
        afterward: "They appear in Library → Inventory. Photos and floor-plan shapes can be added later.",
        href: "/settings/import?type=inventory",
        hrefLabel: "Import inventory",
      },
    ],
  },
  {
    id: "planning",
    number: 4,
    title: "Planning resources",
    summary: "Bring over supported documents, timelines, floor plans, and other planning materials.",
    categories: [
      {
        id: "documents",
        title: "Documents",
        summary: "Contracts and files that belong on a client or event.",
        canImport: "Files attached to existing clients or events. Uploading a PDF stores the file — it does not automatically create a structured contract, invoice, or event.",
        fileTypes: "CSV mapping in Migration Center for document rows; signed files as PDF/DOCX on booked-event finances.",
        required: "A matching client or event already in Hello to Cheers.",
        optional: "File name and storage path when you are attaching an existing file.",
        template: "None as a standalone spreadsheet of contracts. Use Migration Center Documents.",
        duplicates: "Review before import. Existing files are not silently replaced.",
        afterward: "Open the client or event to see attached files. Nothing is released to the client portal automatically.",
        href: `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`,
        hrefLabel: "Bring over documents",
        dependsOn: {
          label: "Documents attach to clients or events that already exist.",
          href: "/settings/import?type=couples",
          hrefLabel: "Import clients",
        },
      },
      {
        id: "floor-plans",
        title: "Floor plans",
        summary: "Space layouts and reference drawings.",
        canImport: "Original floor-plan files kept as reference. They do not become an approved event layout until you place them on an event.",
        fileTypes: "PDF, PNG, JPG, WebP, GIF, SVG, or a ZIP of those files in Migration Center.",
        required: "At least one image or PDF.",
        optional: "A ZIP of many plans.",
        template: "None — upload the drawings you already use.",
        duplicates: "Each uploaded file is kept. Review names so you can find them later.",
        afterward: "Find them with your floor plans. Apply them to events when you are preparing the client experience.",
        href: `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`,
        hrefLabel: "Bring over floor plans",
      },
      {
        id: "timelines",
        title: "Timelines",
        summary: "Day-of or near-event timeline entries on existing events.",
        canImport: "Timeline rows attached to an event that already exists.",
        fileTypes: "CSV in Migration Center.",
        required: "A matching event.",
        optional: "Times and descriptions for each entry.",
        template: "Column mapping in Migration Center.",
        duplicates: "Review before import.",
        afterward: "Open the event workspace to refine the timeline. Clients are not notified.",
        href: `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`,
        hrefLabel: "Bring over timelines",
        dependsOn: {
          label: "Timeline entries attach to events that already exist.",
          href: `${BRING_YOUR_BUSINESS_ROUTES.migrationCenter}?source=another_system`,
          hrefLabel: "Bring over events",
        },
      },
    ],
  },
  {
    id: "review",
    number: 5,
    title: "Review and get started",
    summary: "Find imported records, resolve issues, and prepare existing events for use in Hello to Cheers.",
    categories: [
      {
        id: "find-contacts",
        title: "Find imported contacts",
        summary: "Clients without a booking live under Contacts, not All Bookings.",
        canImport: "Nothing new — this is where imported people already are.",
        fileTypes: "Not an import.",
        required: "—",
        optional: "—",
        template: "—",
        duplicates: "—",
        afterward: "From a contact, bring over their event when you are ready. Do not invite until you mean to.",
        href: "/clients?filter=contacts",
        hrefLabel: "Open Contacts",
      },
      {
        id: "review-events",
        title: "Review imported events",
        summary: "Confirm dates, spaces, and booking statuses on the calendar.",
        canImport: "Nothing new — open events you already brought over.",
        fileTypes: "Not an import.",
        required: "—",
        optional: "—",
        template: "—",
        duplicates: "—",
        afterward: "Open an event to apply a Setup Profile, prepare planning resources, and preview the client portal. Invite only when ready.",
        href: "/calendar",
        hrefLabel: "Open Calendar",
      },
      {
        id: "setup-profiles",
        title: "Prepare the client experience",
        summary: "Setup Profiles, planning resources, and portal preview — still private until you release or invite.",
        canImport: "Nothing is applied automatically just because records were imported.",
        fileTypes: "Not an import.",
        required: "—",
        optional: "—",
        template: "—",
        duplicates: "—",
        afterward: "Preview never sends an invitation. You choose when a client sees anything.",
        href: "/settings/leads/setup-profiles",
        hrefLabel: "Open Setup Profiles",
      },
    ],
  },
];

export const BRING_YOUR_BUSINESS_WILL_NOT = [
  "Invite clients or open the client portal",
  "Send email or SMS",
  "Execute contracts",
  "Request payments or send invoices",
  "Change existing financial obligations silently",
  "Create a second copy of a record when a safe match already exists",
] as const;

export const BRING_YOUR_BUSINESS_WILL_NOT_DO_AUTOMATICALLY =
  "Importing does not invite clients, send email or SMS, release the portal, execute contracts, or request payments. Review before you confirm. Imports are not a full undo — treat them as lasting records.";

const PEOPLE_ENTITIES: EntityType[] = ["couples", "leads", "vendors"];
const PACKAGE_ENTITIES: EntityType[] = ["packages", "inventory"];

export type GuideBatchEvidence = Pick<
  ImportBatch,
  "entityType" | "importedCount" | "errorCount" | "skippedCount" | "rolledBackAt" | "migrationSessionId"
>;

function activeBatches(batches: readonly GuideBatchEvidence[]): GuideBatchEvidence[] {
  return batches.filter((b) => !b.rolledBackAt);
}

function statusFromEntityTypes(
  batches: readonly GuideBatchEvidence[],
  entityTypes: readonly EntityType[],
): GuideStepStatus {
  const relevant = activeBatches(batches).filter((b) => entityTypes.includes(b.entityType));
  if (relevant.length === 0) return "not_started";
  const imported = relevant.reduce((sum, b) => sum + b.importedCount, 0);
  const errors = relevant.reduce((sum, b) => sum + b.errorCount, 0);
  if (errors > 0) return "needs_attention";
  if (imported > 0) return "imported";
  return "not_started";
}

export function evaluateGuideProgress(input: {
  batches: readonly GuideBatchEvidence[];
  hasMigrationImport: boolean;
  uploadedMaterialsCount: number;
  path: "individual" | "skipped" | null;
}): Record<BringYourBusinessGuideStepId, GuideStepStatus> {
  const people = statusFromEntityTypes(input.batches, PEOPLE_ENTITIES);
  const packages = statusFromEntityTypes(input.batches, PACKAGE_ENTITIES);

  let venueEvents: GuideStepStatus = "not_started";
  if (input.hasMigrationImport) venueEvents = "imported";

  let planning: GuideStepStatus = "not_started";
  if (input.uploadedMaterialsCount > 0) planning = "imported";

  const optionalOrSkipped: GuideStepStatus = input.path === "skipped" || input.path === "individual"
    ? "optional"
    : "not_started";

  return {
    people: people === "not_started" && optionalOrSkipped === "optional" ? "optional" : people,
    "venue-events": venueEvents === "not_started" && optionalOrSkipped === "optional" ? "optional" : venueEvents,
    "packages-financials": packages === "not_started" && optionalOrSkipped === "optional" ? "optional" : packages,
    planning: planning === "not_started" && optionalOrSkipped === "optional" ? "optional" : planning,
    // Never complete just because the review page was opened.
    review: "not_started",
  };
}

export function guideStatusLabel(status: GuideStepStatus): string {
  if (status === "imported") return "Brought over";
  if (status === "needs_attention") return "Needs attention";
  if (status === "optional") return "Optional / skipped";
  return "Not started";
}

export function hasMeaningfulExistingBusiness(input: {
  contactCount: number;
  hasMigrationImport: boolean;
  spreadsheetImportedCount: number;
}): boolean {
  return input.contactCount > 0 || input.hasMigrationImport || input.spreadsheetImportedCount > 0;
}

export function spreadsheetImportedCount(batches: readonly GuideBatchEvidence[]): number {
  return activeBatches(batches).reduce((sum, b) => sum + b.importedCount, 0);
}
