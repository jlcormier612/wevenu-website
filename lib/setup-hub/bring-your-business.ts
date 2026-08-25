/**
 * Bring Your Business — Setup Hub routing destinations.
 * Decision UI only; Migration Center / CSV Import own their own logic.
 */
export const BRING_YOUR_BUSINESS_ROUTES = {
  /** Switching from another venue-management system. */
  migrationCenter: "/settings/migration",
  /** Simple spreadsheet / CSV upload. */
  spreadsheetImport: "/settings/import",
} as const;

export type BringYourBusinessRouteKey = keyof typeof BRING_YOUR_BUSINESS_ROUTES;
