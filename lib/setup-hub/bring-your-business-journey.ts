/**
 * Unified Bring Your Business — customer-facing copy and stage helpers.
 * Exact founder copy. Shell only: Import Data + Migration Center remain the engines.
 */
import {
  bringYourBusinessHref,
  type BringYourBusinessStage,
} from "@/lib/setup-hub/bring-your-business";
import type { GuideStepStatus } from "@/lib/setup-hub/bring-your-business-guide";

export const BYB_ENTRY_HEADLINE = "Bring your business with you.";

export const BYB_ENTRY_SUPPORTING =
  "Already managing clients, bookings, and events somewhere else? We'll help you bring your information into Hello to Cheers, keep everything connected, and get you ready to pick up where you left off.";

export const BYB_ENTRY_STAGES_NOTE =
  "You can complete this in stages and come back later. Nothing is invited, emailed, or charged just because you imported it.";

export const BYB_CONTINUE_LABEL = "Continue bringing your business over";

export const BYB_ENTRY_CHOICES = [
  {
    id: "import",
    title: "Import from another system",
    description:
      "Upload files you've exported from your current software. We'll help organize and match your information before anything is added.",
    href: bringYourBusinessHref("prepare", { entry: "import" }),
  },
  {
    id: "files",
    title: "I have spreadsheets or documents",
    description:
      "Bring over the lists, bookings, agreements, and planning information you already keep in files.",
    href: bringYourBusinessHref("prepare", { entry: "files" }),
  },
] as const;

export const BYB_STARTING_FRESH = {
  title: "I'm starting fresh",
  description: "Skip importing and start setting up your business in Hello to Cheers.",
  action: "Continue to Setup",
} as const;

export const BYB_CONTINUE_WITHOUT_MORE_IMPORTS = {
  title: "Continue setup without importing more",
  description:
    "Your imported records stay in Hello to Cheers. You can keep setting up now and bring more information over later.",
  action: "Back to Setup",
} as const;

export const BYB_STAGE_NAV_LABELS: Record<Exclude<BringYourBusinessStage, "entry">, string> = {
  prepare: "Prepare",
  leads: "Leads",
  clients: "Clients",
  vendors: "Vendors",
  people: "Clients",
  dates: "Clients",
  money: "Money",
  planning: "Planning",
  review: "Review",
};

export const BYB_PREPARE_INTRO_IMPORT =
  "Export what you want to bring over from your current software, then upload it here. We'll organize and match it before anything is added.";

export const BYB_PREPARE_INTRO_FILES =
  "Use the lists, bookings, agreements, and planning files you already keep. CSV, Excel, Word, and PDF are supported where noted.";

export const BYB_PREPARE_CHECKLIST: {
  label: string;
  support: "supported" | "optional" | "manual";
  detail: string;
}[] = [
  {
    label: "Leads",
    support: "supported",
    detail: "Prospective customers who have not booked, including a preferred date. A preferred date never reserves the calendar.",
  },
  {
    label: "Clients and their events",
    support: "supported",
    detail: "Booked customers and past customers, each with their event. Upcoming bookings follow availability. Past events stay Clients.",
  },
  {
    label: "Vendors",
    support: "supported",
    detail: "Preferred vendors. Connecting them to events is a later step.",
  },
  {
    label: "Tours, holds, and calendar blocks",
    support: "supported",
    detail: "Tours, date holds, and calendar blocks can be added after clients and events. Named spaces are required before booked events when you host in more than one space.",
  },
  {
    label: "Contracts and financial records",
    support: "optional",
    detail: "Contracts, invoices, receipts, refunds, credits, and future installments. A spreadsheet row is one agreement, invoice, payment, or installment. Ambiguous events wait for your choice.",
  },
  {
    label: "Planning documents and reusable templates",
    support: "optional",
    detail: "Tasks, timelines, questionnaires and answers, floor-plan files, documents, event selections, and vendor coordination. Automations, consent, guest lists, and staff are not imported — set those up in Hello to Cheers.",
  },
];

export const BYB_CANNOT_IMPORT = [
  "Automations from another system",
  "Communication consent",
  "Guest lists (clients manage those in their portal)",
  "Staff accounts",
] as const;

export const BYB_STAGE_COPY: Record<
  Exclude<BringYourBusinessStage, "entry">,
  { title: string; summary: string }
> = {
  prepare: {
    title: "Prepare your business",
    summary: "Gather what you want to bring over. Required, optional, and not imported are listed honestly.",
  },
  leads: {
    title: "Bring over leads",
    summary:
      "Upload inquiries who have not booked. Preferred dates, partners, follow-up, and notes stay on the Lead. They do not create a booking or reserve the calendar.",
  },
  clients: {
    title: "Bring over clients and their events",
    summary:
      "Import booked customers together with their events. Upcoming bookings follow your calendar. Past events stay Clients. A preferred date without a booking belongs on Leads.",
  },
  vendors: {
    title: "Bring over vendors",
    summary: "Import vendor relationships you already work with. Nothing is sent automatically.",
  },
  people: {
    title: "Bring over clients and their events",
    summary:
      "Import booked customers together with their events. Upcoming bookings follow your calendar. Past events stay Clients.",
  },
  dates: {
    title: "Bring over clients and their events",
    summary:
      "Import booked customers together with their events. Upcoming bookings follow your calendar. Past events stay Clients.",
  },
  money: {
    title: "Bring your contracts and money",
    summary:
      "Reconcile invoices, collected amounts, remaining payments, and a signed agreement on a booked event that already exists. Totals that do not match are blocked.",
  },
  planning: {
    title: "Bring your planning materials",
    summary:
      "Tasks, timelines, questionnaires, floor-plan files, documents, selections, and vendor coordination already done for an event. Import does not replace that work with a starter playbook, and nothing is released to the client.",
  },
  review: {
    title: "Review and finish",
    summary:
      "See what was brought over, what you skipped for now, and what still needs setup. Client success means the customer and their event exist.",
  },
};

export const BYB_REVIEW_BROUGHT_OVER = "Brought over";
export const BYB_REVIEW_SKIPPED = "Skipped for now";
export const BYB_REVIEW_ATTENTION = "Needs attention or additional setup";
export const BYB_REVIEW_NOTE =
  "Lead success means a Lead exists. Client success means the customer and their event exist. Held rows are not successful imports. Contracts, payments, and planning attach later to the imported event.";

export type BringYourBusinessReviewGroups = {
  broughtOver: string[];
  skipped: string[];
  attention: string[];
};

const REVIEW_STAGE_LINES: { key: "leads" | "clients" | "vendors" | "money" | "planning"; label: string }[] = [
  { key: "leads", label: "Leads" },
  { key: "clients", label: "Clients and their events" },
  { key: "vendors", label: "Vendors" },
  { key: "money", label: "Contracts and money" },
  { key: "planning", label: "Planning materials" },
];

export function buildBringYourBusinessReview(input: {
  imported: number;
  skipped: number;
  errors: number;
  leads: GuideStepStatus;
  clients: GuideStepStatus;
  vendors: GuideStepStatus;
  money: GuideStepStatus;
  planning: GuideStepStatus;
}): BringYourBusinessReviewGroups {
  const broughtOver: string[] = [];
  const skipped: string[] = [];
  const attention: string[] = [];
  const statuses = {
    leads: input.leads,
    clients: input.clients,
    vendors: input.vendors,
    money: input.money,
    planning: input.planning,
  };

  if (input.imported > 0) {
    broughtOver.push(
      `${input.imported} record${input.imported === 1 ? "" : "s"} imported into Hello to Cheers`,
    );
  }
  if (input.skipped > 0) {
    broughtOver.push(
      `${input.skipped} import row${input.skipped === 1 ? " was" : "s were"} left out of a run (already in Hello to Cheers, missing fields, or skipped). That is not the same as skipping a whole category.`,
    );
  }

  for (const stage of REVIEW_STAGE_LINES) {
    const status = statuses[stage.key];
    if (status === "imported") {
      broughtOver.push(`${stage.label} — brought over`);
    } else if (status === "optional") {
      skipped.push(`${stage.label} — skipped for now. You can bring this over later.`);
    } else if (status === "needs_attention") {
      attention.push(`${stage.label} — held or incomplete rows still need a decision. Successful records already in Hello to Cheers stay there.`);
    } else {
      attention.push(`${stage.label} — not brought over yet.`);
    }
  }

  if (input.errors > 0) {
    attention.unshift(
      `${input.errors} imported row${input.errors === 1 ? " needs" : "s need"} attention.`,
    );
  }

  return { broughtOver, skipped, attention };
}

export const BYB_WORKFLOW_STAGES: Exclude<BringYourBusinessStage, "entry" | "people" | "dates">[] = [
  "prepare",
  "leads",
  "clients",
  "vendors",
  "money",
  "planning",
  "review",
];

export function nextBringYourBusinessStage(
  stage: BringYourBusinessStage,
): BringYourBusinessStage {
  if (stage === "entry") return "prepare";
  const index = (BYB_WORKFLOW_STAGES as readonly BringYourBusinessStage[]).indexOf(stage);
  if (index < 0 || index === BYB_WORKFLOW_STAGES.length - 1) return "review";
  return BYB_WORKFLOW_STAGES[index + 1];
}

export function previousBringYourBusinessStage(
  stage: BringYourBusinessStage,
): BringYourBusinessStage {
  if (stage === "entry" || stage === "prepare") return "entry";
  const index = (BYB_WORKFLOW_STAGES as readonly BringYourBusinessStage[]).indexOf(stage);
  if (index <= 0) return "entry";
  return BYB_WORKFLOW_STAGES[index - 1];
}

export function continueBringYourBusinessStage(progress: {
  leads: GuideStepStatus;
  clients: GuideStepStatus;
  vendors: GuideStepStatus;
  "packages-financials": GuideStepStatus;
  planning: GuideStepStatus;
}): BringYourBusinessStage {
  if (progress.leads === "not_started" || progress.leads === "needs_attention") return "leads";
  if (progress.clients === "not_started" || progress.clients === "needs_attention") return "clients";
  if (progress.vendors === "not_started" || progress.vendors === "needs_attention") return "vendors";
  if (
    progress["packages-financials"] === "not_started"
    || progress["packages-financials"] === "needs_attention"
  ) {
    return "money";
  }
  if (progress.planning === "not_started" || progress.planning === "needs_attention") return "planning";
  return "review";
}

export function hasBringYourBusinessWork(input: {
  spreadsheetImportedCount: number;
  hasMigrationImport: boolean;
  hasImportedActivity?: boolean;
}): boolean {
  return input.spreadsheetImportedCount > 0 || input.hasMigrationImport || Boolean(input.hasImportedActivity);
}

export function legacyImportRedirectHref(type?: string | null): string {
  const kind = type?.trim() || "";
  if (kind === "leads") return bringYourBusinessHref("leads");
  if (kind === "vendors") return bringYourBusinessHref("vendors");
  if (kind === "couples" || kind === "clients") return bringYourBusinessHref("clients");
  if (kind === "packages" || kind === "inventory") {
    return bringYourBusinessHref("planning", { kind });
  }
  return bringYourBusinessHref("prepare");
}

export function legacyMigrationRedirectHref(source?: string | null): string {
  const key = source?.trim() || "";
  if (key && key !== "starting_fresh") {
    return bringYourBusinessHref("clients", { source: "another_system" });
  }
  return bringYourBusinessHref("clients");
}
