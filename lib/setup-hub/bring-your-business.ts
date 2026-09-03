/**
 * Bring Your Business — Setup Hub routing destinations.
 * Migration Center is the cutover path (CRM + Calendar + operational).
 * CSV Import remains for small ad-hoc spreadsheet adds; same field fidelity.
 */
export const BRING_YOUR_BUSINESS_ROUTES = {
  /** Full cutover: clients, calendar, holds, tours, blocks, packages. */
  migrationCenter: "/settings/migration",
  /** Small spreadsheet add — same create paths, not a second domain model. */
  spreadsheetImport: "/settings/import",
  /** Spaces / capacity / tour availability — required before dated Events. */
  calendarAvailability: "/settings/availability",
} as const;

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
      message: "You can import clients now. If you host in named spaces, add them in Calendar & Availability first so Events land on the right space.",
    };
  }
  return {
    readyForDatedEvents: true,
    spacesCount: input.spacesCount,
    hasCapacityRules: input.hasCapacityRules,
    message: null,
  };
}
