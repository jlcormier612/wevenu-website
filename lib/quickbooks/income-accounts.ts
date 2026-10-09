/**
 * Income account selection for the default "Hello to Cheers Services" Item.
 *
 * QuickBooks requires an income account on a Service Item and offers no
 * default to discover — the company Preferences endpoint exposes only
 * DefaultDiscountAccount, and a real chart of accounts holds many equally
 * plausible income accounts (Intuit's own sample company has twenty). So the
 * venue chooses, once, and nothing here ever chooses for them: there is
 * deliberately no "pick the first one" path, no name matching, and no
 * subtype ranking anywhere in this file.
 *
 * The one judgement this module does make is which accounts are safe to
 * *offer*. Two income subtypes are QuickBooks' own bookkeeping machinery
 * rather than places a venue earns revenue, and assigning the Item to either
 * would silently corrupt their books — so they are excluded from the picker.
 * Excluding an unsuitable option is not the same as selecting one.
 */
import { quickBooksFetch } from "@/lib/quickbooks/client";

/**
 * UnappliedCashPaymentIncome is a QuickBooks-managed system account; a venue
 * must never post service revenue to it. DiscountsRefundsGiven is
 * contra-revenue — "Discounts given", "Refunds-Allowances" — the opposite of
 * where an invoice line belongs. Everything else QuickBooks classifies as
 * Income is a legitimate choice that only the venue can make.
 */
export const EXCLUDED_INCOME_SUBTYPES = new Set([
  "UnappliedCashPaymentIncome",
  "DiscountsRefundsGiven",
]);

export type QuickBooksAccountRow = {
  Id?: string;
  Name?: string;
  AccountType?: string;
  AccountSubType?: string;
  Active?: boolean;
  FullyQualifiedName?: string;
};

export type SelectableIncomeAccount = {
  id: string;
  name: string;
  subType: string;
};

/** Active, genuinely-income, not a QuickBooks system account. */
export function isSelectableIncomeAccount(account: QuickBooksAccountRow): boolean {
  if (!account.Id || !account.Name) return false;
  if (account.AccountType !== "Income") return false;
  if (account.Active === false) return false;
  return !EXCLUDED_INCOME_SUBTYPES.has(account.AccountSubType ?? "");
}

/**
 * Shapes the query response for the picker. Returns every eligible account —
 * never a single "best" one — so the caller has no way to skip the venue's
 * decision. Order is QuickBooks' own; callers must not treat position as
 * preference.
 */
export function toSelectableIncomeAccounts(rows: QuickBooksAccountRow[]): SelectableIncomeAccount[] {
  return rows.filter(isSelectableIncomeAccount).map((a) => ({
    id: a.Id as string,
    name: a.FullyQualifiedName?.trim() || (a.Name as string),
    subType: a.AccountSubType ?? "",
  }));
}

/**
 * Whether a previously-saved selection is still offered by QuickBooks. A
 * deactivated or deleted account must force an explicit re-selection rather
 * than quietly falling back to another account.
 */
export function selectedAccountStillValid(
  selectedId: string | null,
  accounts: SelectableIncomeAccount[],
): boolean {
  if (!selectedId) return false;
  return accounts.some((a) => a.id === selectedId);
}

export type ListIncomeAccountsResult =
  | { ok: true; accounts: SelectableIncomeAccount[] }
  | { ok: false; error: string; retryable: boolean };

/**
 * Read-only. Uses the same authenticated client, environment handling and
 * failure classification as every other QuickBooks read, so a timeout or 5xx
 * stays retryable and a validation error does not.
 */
export async function listIncomeAccounts(venueId: string): Promise<ListIncomeAccountsResult> {
  const query = "select * from Account where AccountType = 'Income'";
  const result = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!result.ok) return { ok: false, error: result.error, retryable: result.retryable };

  const data = await result.response.json() as { QueryResponse?: { Account?: QuickBooksAccountRow[] } };
  return { ok: true, accounts: toSelectableIncomeAccounts(data.QueryResponse?.Account ?? []) };
}
