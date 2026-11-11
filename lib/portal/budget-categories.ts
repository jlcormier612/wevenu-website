/**
 * Couple budget category helpers — soft-remove returns budgeted dollars to
 * unallocated (total − sum of visible budgeted). Custom keys are namespaced.
 */
import type { BudgetCategory } from "@/lib/portal/types";

export const BUDGET_UNUSED_LABEL = "Unallocated";

export function isCustomBudgetCategoryKey(key: string): boolean {
  return key.startsWith("custom_");
}

export function newCustomBudgetCategoryKey(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `custom_${id}`;
}

export function visibleBudgetCategories(categories: BudgetCategory[]): BudgetCategory[] {
  return categories.filter((c) => c.isRemoved !== true);
}

export function unallocatedBudgetAmount(
  totalBudget: number,
  categories: BudgetCategory[],
): number {
  const budgeted = visibleBudgetCategories(categories).reduce(
    (sum, c) => sum + (c.budgetedAmount || 0),
    0,
  );
  return Math.max(0, totalBudget - budgeted);
}
