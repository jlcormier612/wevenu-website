/**
 * Bring Your Business — Setup Hub routing destinations.
 * Migration Center is the cutover path (CRM + Calendar + operational).
 * CSV Import remains for small ad-hoc spreadsheet adds; same field fidelity.
 */
export const BRING_YOUR_BUSINESS_ROUTES = {
  /** Customer-facing journey. */
  guidedExperience: "/setup-hub/bring-your-business",
  /** Compatibility route — redirects into the journey. */
  migrationCenter: "/settings/migration",
  /** Compatibility route — redirects into the journey. */
  spreadsheetImport: "/settings/import",
  /** Spaces / capacity / tour availability — required before dated Events. */
  calendarAvailability: "/settings/availability",
} as const;

export type BringYourBusinessStage =
  | "entry"
  | "prepare"
  | "leads"
  | "clients"
  | "vendors"
  | "people"
  | "dates"
  | "money"
  | "planning"
  | "review";

export const BRING_YOUR_BUSINESS_STAGES: BringYourBusinessStage[] = [
  "entry", "prepare", "leads", "clients", "vendors", "people", "dates", "money", "planning", "review",
];

export function bringYourBusinessHref(stage?: BringYourBusinessStage, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (stage && stage !== "entry") params.set("stage", stage);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${BRING_YOUR_BUSINESS_ROUTES.guidedExperience}?${query}` : BRING_YOUR_BUSINESS_ROUTES.guidedExperience;
}

export function parseBringYourBusinessStage(
  raw: string | null | undefined,
  kind?: string | null,
): BringYourBusinessStage {
  const value = raw?.trim().toLowerCase() ?? "";
  const entity = kind?.trim().toLowerCase() ?? "";
  if (value === "people") {
    if (entity === "leads") return "leads";
    if (entity === "vendors") return "vendors";
    return "clients";
  }
  if (value === "dates" || value === "events" || value === "migration" || value === "couples") return "clients";
  if (value === "import" || value === "spreadsheet") return "prepare";
  if (value === "finances") return "money";
  if ((BRING_YOUR_BUSINESS_STAGES as string[]).includes(value)) return value as BringYourBusinessStage;
  return "entry";
}

export type BringYourBusinessRouteKey = keyof typeof BRING_YOUR_BUSINESS_ROUTES;

/** Conditional hard gate: dated Event import needs spaces when capacity ≥ 2. */
export type CutoverPrerequisite = {
  readyForDatedEvents: boolean;
  spacesCount: number;
  hasCapacityRules: boolean;
  message: string | null;
};

export function evaluateCutoverPrerequisites(input: {
  spacesCount: number;
  hasCapacityRules: boolean;
  maxSimultaneousEvents?: number | null;
}): CutoverPrerequisite {
  const multiSpace = (input.maxSimultaneousEvents ?? 1) >= 2;
  if (multiSpace && input.spacesCount < 1) {
    return {
      readyForDatedEvents: false,
      spacesCount: input.spacesCount,
      hasCapacityRules: input.hasCapacityRules,
      message: "Add your Event Spaces in Calendar & Availability before importing dated Events — multi-space venues need a space on each booking.",
    };
  }
  if (input.spacesCount < 1) {
    return {
      readyForDatedEvents: true,
      spacesCount: input.spacesCount,
      hasCapacityRules: input.hasCapacityRules,
      message: "Leads and vendors can import now. If you host in named spaces, add them in Calendar & Availability before importing booked clients so events land on the right space.",
    };
  }
  return {
    readyForDatedEvents: true,
    spacesCount: input.spacesCount,
    hasCapacityRules: input.hasCapacityRules,
    message: null,
  };
}
