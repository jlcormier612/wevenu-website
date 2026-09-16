/**
 * Which Financials nav destinations a venue staff role may open.
 * Staff cannot SELECT invoices/payment schedules (RLS) — hide those links.
 * Contracts remain visible (view-only for staff per permissions model).
 */

import type { NavItem, NavSection } from "@/lib/navigation";

const STAFF_HIDDEN_FINANCIAL_HREFS = new Set(["/invoices", "/payments"]);

export function canAccessFinancialNavHref(
  role: string | null | undefined,
  href: string,
): boolean {
  if (role !== "staff") return true;
  return !STAFF_HIDDEN_FINANCIAL_HREFS.has(href);
}

export function filterNavSectionsForRole(
  sections: NavSection[],
  role: string | null | undefined,
): NavSection[] {
  return sections
    .map((section) => {
      // Matched on the stable id, not the label: "Financials" is editorial and
      // a rewording must not quietly expose invoices/payments to staff.
      if (section.id !== "financials") return section;
      const items = section.items.filter((item: NavItem) =>
        canAccessFinancialNavHref(role, item.href),
      );
      if (items.length === 0) return null;
      return { ...section, items };
    })
    .filter((s): s is NavSection => s != null);
}
