/**
 * Customer-facing Bring Your Business guide — a sequence over existing
 * Import Data + Migration Center tools. Not a second import engine.
 */
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";
import type { EntityType, ImportBatch } from "@/lib/import/types";

export const BRING_YOUR_BUSINESS_GUIDE_HREF = "/setup-hub/bring-your-business";

export type BringYourBusinessGuideStepId =
  | "leads"
  | "clients"
  | "vendors"
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
  number: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  summary: string;
  categories: readonly GuideCategory[];
};

export const BRING_YOUR_BUSINESS_GUIDE_STEPS: readonly GuideStepDefinition[] = [
  {
    id: "leads",
    number: 1,
    title: "Leads",
    summary: "Bring over prospective customers who have not booked.",
    categories: [
      {
        id: "leads",
        title: "Leads",
        summary: "Open inquiries, including someone with a preferred event date.",
        canImport: "Names, partners, email, phone, preferred date, date flexibility, event type, guest count, source, lead status, follow-up, notes, and additional inquiries for the same person.",
        fileTypes: "CSV, Excel, Word, PDF, or a pasted list. You do not have to name the software the file came from.",
        required: "First name and last name.",
        optional: "Partner, email, phone, preferred date, date flexibility, event type, guest count, source, status, follow-up, notes.",
        template: "A CSV template is available on the Leads import step.",
        duplicates: "Possible matches are shown for your decision. Hello to Cheers will not merge or skip similar records unless you confirm. Exact repeats of a record you already imported are left out automatically.",
        afterward: "Review them on Leads. Preferred dates do not book the calendar. Historical imports stay quiet — no automations or outreach.",
        href: "/setup-hub/bring-your-business?stage=leads",
        hrefLabel: "Import leads",
      },
    ],
  },
  {
    id: "clients",
    number: 2,
    title: "Clients and their events",
    summary: "Bring over booked customers together with their events — upcoming and past.",
    categories: [
      {
        id: "clients",
        title: "Clients and their events",
        summary: "A Client import creates or matches the customer and establishes the Event.",
        canImport: "Customer identity plus confirmed event date, times, type, guests, spaces, and booked or past status. A preferred date without a booking belongs on Leads.",
        fileTypes: "CSV, Excel, Word, PDF, or a pasted list. You do not have to name the software the file came from.",
        required: "First name, last name, and a confirmed event date.",
        optional: "Partner, email, phone, times, space, guest count, event type, booking status, notes.",
        template: "A CSV template is available on the Clients import step.",
        duplicates: "Possible matches are shown for your decision. You choose whether this is the same Client and same Event, the same Client with an additional Event, a different Client, or something to leave out. A matching date is not proof it is the same Event. Exact repeats of an Event you already imported are left out automatically.",
        afterward: "Upcoming booked clients appear under All Bookings and Calendar. Past clients appear under Past. Nothing is emailed or invited.",
        href: "/setup-hub/bring-your-business?stage=clients",
        hrefLabel: "Import clients and events",
      },
    ],
  },
  {
    id: "vendors",
    number: 3,
    title: "Vendors",
    summary: "Bring over vendor relationships you already work with.",
    categories: [
      {
        id: "vendors",
        title: "Vendors",
        summary: "Preferred vendors you already work with.",
        canImport: "Business name plus optional category, contact, and notes.",
        fileTypes: "CSV, Excel, Word, PDF, or a pasted list.",
        required: "Vendor name.",
        optional: "Category, contact name, email, phone, website, pricing tier, notes.",
        template: "A CSV template is available on the Vendors import step.",
        duplicates: "Possible matches are shown for your decision. Matching email or business name is not proof of identity. You choose Same Vendor, Different Vendor, or Don't import. Exact repeats of a vendor relationship you already imported are left out automatically.",
        afterward: "They appear on Vendors. Connecting them to events is a later step — nothing is sent automatically.",
        href: "/setup-hub/bring-your-business?stage=vendors",
        hrefLabel: "Import vendors",
      },
    ],
  },
  {
    id: "packages-financials",
    number: 4,
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
        href: "/setup-hub/bring-your-business?stage=planning&kind=packages",
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
        href: "/setup-hub/bring-your-business?stage=money",
        hrefLabel: "Bring over finances",
        dependsOn: {
          label: "Event finances require the relevant clients and events to exist first.",
          href: "/setup-hub/bring-your-business?stage=clients",
          hrefLabel: "Import clients and events",
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
        href: "/setup-hub/bring-your-business?stage=planning&kind=inventory",
        hrefLabel: "Import inventory",
      },
    ],
  },
  {
    id: "planning",
    number: 5,
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
        href: "/setup-hub/bring-your-business?stage=planning",
        hrefLabel: "Bring over documents",
        dependsOn: {
          label: "Documents attach to clients or events that already exist.",
          href: "/setup-hub/bring-your-business?stage=clients",
          hrefLabel: "Import clients and events",
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
        href: "/setup-hub/bring-your-business?stage=planning",
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
        href: "/setup-hub/bring-your-business?stage=planning",
        hrefLabel: "Bring over timelines",
        dependsOn: {
          label: "Timeline entries attach to events that already exist.",
          href: "/setup-hub/bring-your-business?stage=clients",
          hrefLabel: "Import clients and events",
        },
      },
    ],
  },
  {
    id: "review",
    number: 6,
    title: "Review and get started",
    summary: "Find imported records, resolve issues, and prepare existing events for use in Hello to Cheers.",
    categories: [
      {
        id: "find-clients",
        title: "Find imported clients",
        summary: "Upcoming booked clients are under All Bookings. Past clients are under Past.",
        canImport: "Nothing new — this is where imported clients and events already are.",
        fileTypes: "Not an import.",
        required: "—",
        optional: "—",
        template: "—",
        duplicates: "—",
        afterward: "Open the event to continue planning. Do not invite until you mean to.",
        href: "/clients",
        hrefLabel: "Open All Bookings",
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
  if (imported > 0) return "imported";
  if (errors > 0) return "needs_attention";
  return "not_started";
}

export function evaluateGuideProgress(input: {
  batches: readonly GuideBatchEvidence[];
  hasMigrationImport: boolean;
  uploadedMaterialsCount: number;
  path: "individual" | "skipped" | null;
}): Record<BringYourBusinessGuideStepId, GuideStepStatus> {
  const leads = statusFromEntityTypes(input.batches, ["leads"]);
  const clients = statusFromEntityTypes(input.batches, ["couples"]);
  const vendors = statusFromEntityTypes(input.batches, ["vendors"]);
  const packages = statusFromEntityTypes(input.batches, PACKAGE_ENTITIES);

  const clientsStatus: GuideStepStatus = clients !== "not_started"
    ? clients
    : input.hasMigrationImport
      ? "imported"
      : "not_started";

  let planning: GuideStepStatus = "not_started";
  if (input.uploadedMaterialsCount > 0) planning = "imported";

  const optionalOrSkipped: GuideStepStatus = input.path === "skipped" || input.path === "individual"
    ? "optional"
    : "not_started";

  return {
    leads: leads === "not_started" && optionalOrSkipped === "optional" ? "optional" : leads,
    clients: clientsStatus === "not_started" && optionalOrSkipped === "optional" ? "optional" : clientsStatus,
    vendors: vendors === "not_started" && optionalOrSkipped === "optional" ? "optional" : vendors,
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
