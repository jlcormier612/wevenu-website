/**
 * QuickBooks income-account selection.
 *
 * The default "Hello to Cheers Services" Service Item cannot be created
 * without an income account — Intuit rejects it with ValidationFault 2020 —
 * and QuickBooks exposes no default to discover. These tests pin the two
 * properties that make the fix safe: an account is never chosen for the
 * venue, and no mutating Item request is ever sent without one.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EXCLUDED_INCOME_SUBTYPES,
  isSelectableIncomeAccount,
  selectedAccountStillValid,
  toSelectableIncomeAccounts,
  type QuickBooksAccountRow,
} from "@/lib/quickbooks/income-accounts";

const items = readFileSync(resolve("lib/quickbooks/items.ts"), "utf8");
const incomeAccounts = readFileSync(resolve("lib/quickbooks/income-accounts.ts"), "utf8");
const service = readFileSync(resolve("lib/quickbooks/service.ts"), "utf8");
const customerSync = readFileSync(resolve("lib/quickbooks/sync/customer.ts"), "utf8");
const paymentSync = readFileSync(resolve("lib/quickbooks/sync/payment.ts"), "utf8");

/** Shape taken from the real sandbox company's chart of accounts. */
const SANDBOX_ACCOUNTS: QuickBooksAccountRow[] = [
  { Id: "1", Name: "Services", AccountType: "Income", AccountSubType: "ServiceFeeIncome", Active: true },
  { Id: "45", Name: "Landscaping Services", AccountType: "Income", AccountSubType: "OtherPrimaryIncome", Active: true },
  { Id: "79", Name: "Sales of Product Income", AccountType: "Income", AccountSubType: "SalesOfProductIncome", Active: true },
  { Id: "86", Name: "Discounts given", AccountType: "Income", AccountSubType: "DiscountsRefundsGiven", Active: true },
  { Id: "87", Name: "Unapplied Cash Payment Income", AccountType: "Income", AccountSubType: "UnappliedCashPaymentIncome", Active: true },
  { Id: "63", Name: "Job Expenses", AccountType: "Expense", AccountSubType: "OtherMiscServiceCost", Active: true },
];

describe("eligible income accounts", () => {
  it("offers ordinary income accounts", () => {
    assert.equal(isSelectableIncomeAccount(SANDBOX_ACCOUNTS[0]), true);
    assert.equal(isSelectableIncomeAccount(SANDBOX_ACCOUNTS[1]), true);
    assert.equal(isSelectableIncomeAccount(SANDBOX_ACCOUNTS[2]), true);
  });

  it("never offers a non-income account", () => {
    assert.equal(isSelectableIncomeAccount(SANDBOX_ACCOUNTS[5]), false);
  });

  it("never offers QuickBooks' own system income accounts", () => {
    for (const account of SANDBOX_ACCOUNTS) {
      if (EXCLUDED_INCOME_SUBTYPES.has(account.AccountSubType ?? "")) {
        assert.equal(isSelectableIncomeAccount(account), false, `${account.Name} must not be offered`);
      }
    }
    assert.ok(EXCLUDED_INCOME_SUBTYPES.has("UnappliedCashPaymentIncome"));
    assert.ok(EXCLUDED_INCOME_SUBTYPES.has("DiscountsRefundsGiven"));
  });

  it("never offers a deactivated account", () => {
    assert.equal(
      isSelectableIncomeAccount({ ...SANDBOX_ACCOUNTS[0], Active: false }),
      false,
    );
  });

  it("skips rows missing an id or a name rather than yielding a broken option", () => {
    assert.equal(isSelectableIncomeAccount({ Name: "No id", AccountType: "Income", Active: true }), false);
    assert.equal(isSelectableIncomeAccount({ Id: "9", AccountType: "Income", Active: true }), false);
  });

  it("prefers the fully qualified name so nested accounts stay distinguishable", () => {
    const [account] = toSelectableIncomeAccounts([{
      Id: "48", Name: "Fountains and Garden Lighting", AccountType: "Income",
      AccountSubType: "OtherPrimaryIncome", Active: true,
      FullyQualifiedName: "Landscaping Services:Job Materials:Fountains and Garden Lighting",
    }]);
    assert.equal(account.name, "Landscaping Services:Job Materials:Fountains and Garden Lighting");
  });
});

describe("no account is ever chosen automatically", () => {
  it("returns every eligible account, not a single recommendation", () => {
    const accounts = toSelectableIncomeAccounts(SANDBOX_ACCOUNTS);
    assert.equal(accounts.length, 3);
    assert.deepEqual(accounts.map((a) => a.id).sort(), ["1", "45", "79"]);
  });

  it("an empty chart of accounts yields nothing rather than a fallback", () => {
    assert.deepEqual(toSelectableIncomeAccounts([]), []);
  });

  it("a company with only unsuitable accounts yields nothing", () => {
    const unsuitable = SANDBOX_ACCOUNTS.filter((a) => !isSelectableIncomeAccount(a));
    assert.deepEqual(toSelectableIncomeAccounts(unsuitable), []);
  });

  it("exposes no helper that picks one", () => {
    for (const banned of [/\bpickDefault/, /\bchooseAccount/, /accounts\s*\[\s*0\s*\]/, /\.find\(\s*\(\s*\)\s*=>/]) {
      assert.doesNotMatch(incomeAccounts, banned, `income-accounts.ts must not auto-select (${banned})`);
    }
  });

  it("does not rank or match accounts by name", () => {
    // The only capitalised string literals allowed are the two excluded
    // subtypes and the AccountType gate — anything else would be name matching.
    const literals = incomeAccounts.match(/"[A-Z][A-Za-z]+"/g) ?? [];
    for (const literal of literals) {
      assert.ok(
        ["\"UnappliedCashPaymentIncome\"", "\"DiscountsRefundsGiven\"", "\"Income\""].includes(literal),
        `unexpected account literal ${literal} suggests name-based selection`,
      );
    }
  });
});

describe("a stale selection forces a new explicit choice", () => {
  const accounts = toSelectableIncomeAccounts(SANDBOX_ACCOUNTS);

  it("accepts a selection that is still offered", () => {
    assert.equal(selectedAccountStillValid("45", accounts), true);
  });

  it("rejects a selection QuickBooks no longer offers", () => {
    assert.equal(selectedAccountStillValid("999", accounts), false);
  });

  it("rejects a selection that has been deactivated", () => {
    const deactivated = toSelectableIncomeAccounts(
      SANDBOX_ACCOUNTS.map((a) => (a.Id === "45" ? { ...a, Active: false } : a)),
    );
    assert.equal(selectedAccountStillValid("45", deactivated), false);
  });

  it("treats no selection as invalid rather than defaulting", () => {
    assert.equal(selectedAccountStillValid(null, accounts), false);
  });

  it("re-validates against QuickBooks before persisting a choice", () => {
    const fn = service.slice(service.indexOf("export async function selectQuickBooksIncomeAccount"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    const listedAt = body.indexOf("listIncomeAccounts");
    const foundAt = body.indexOf(".find(");
    const persistedAt = body.indexOf("setDefaultIncomeAccount");
    assert.ok(listedAt > -1 && foundAt > listedAt, "must re-list before trusting the id");
    assert.ok(persistedAt > foundAt, "must confirm the account exists before persisting");
    assert.match(body, /no longer available in QuickBooks/);
  });
});

describe("ensureDefaultItem", () => {
  const ensureBody = items.slice(items.indexOf("export async function ensureDefaultItem"));

  it("short-circuits on a cached item before any QuickBooks call", () => {
    const cachedAt = ensureBody.indexOf("connection?.defaultItemQuickBooksId");
    const firstCallAt = ensureBody.indexOf("await quickBooksFetch");
    assert.ok(cachedAt > -1, "cached item check missing");
    assert.ok(cachedAt < firstCallAt, "cached item must be checked before any QuickBooks call");
  });

  it("still adopts an existing item, so adoption does not require a selection", () => {
    const adoptAt = items.indexOf("if (existingId)");
    const guardAt = items.indexOf("if (!incomeAccountId)");
    assert.ok(adoptAt > -1 && guardAt > adoptAt, "adoption must precede the account requirement");
    assert.match(items, /setDefaultItemId\(admin, venueId, existingId\)/);
  });

  it("requires a selected account before the create request", () => {
    const guardAt = items.indexOf("if (!incomeAccountId)");
    const postAt = items.indexOf('quickBooksFetch(venueId, "/item"');
    assert.ok(guardAt > -1 && postAt > guardAt, "the guard must precede the POST");
  });

  it("sends the explicitly selected account as IncomeAccountRef", () => {
    assert.match(items, /IncomeAccountRef:\s*\{\s*value:\s*incomeAccountId\s*\}/);
    assert.match(items, /const incomeAccountId = connection\?\.defaultIncomeAccountQuickBooksId/);
  });

  it("reports a missing selection as a non-retryable configuration error", () => {
    const guard = items.slice(items.indexOf("if (!incomeAccountId)"));
    const block = guard.slice(0, guard.indexOf("\n  }"));
    assert.match(block, /retryable:\s*false/);
    assert.match(block, /Settings → Integrations → QuickBooks Online/);
    assert.doesNotMatch(block, /uncertain/);
  });

  it("keeps timeout and transport uncertainty flowing to the review path", () => {
    assert.match(items, /uncertain:\s*createResult\.uncertain/);
  });

  it("never substitutes another account when one is missing or rejected", () => {
    assert.doesNotMatch(items, /AccountType\s*=\s*'Income'/);
    assert.doesNotMatch(items, /listIncomeAccounts/);
  });
});

describe("account listing reuses the established read semantics", () => {
  it("queries QuickBooks read-only through the shared client", () => {
    assert.match(incomeAccounts, /quickBooksFetch\(venueId, `\/query\?query=/);
    assert.doesNotMatch(incomeAccounts, /method:\s*"POST"/);
  });

  it("propagates retryability from the shared failure classifier", () => {
    assert.match(incomeAccounts, /retryable:\s*result\.retryable/);
  });
});

describe("customer and payment sync are untouched", () => {
  it("neither path references an item or an income account", () => {
    for (const [name, source] of [["customer", customerSync], ["payment", paymentSync]] as const) {
      assert.doesNotMatch(source, /ensureDefaultItem/, `${name} sync must not require the item`);
      assert.doesNotMatch(source, /IncomeAccountRef/, `${name} sync must not set an account`);
    }
  });

  it("customer sync still creates on DisplayName and payment on PrivateNote", () => {
    assert.match(customerSync, /DisplayName: displayName/);
    assert.match(paymentSync, /PrivateNote: privateNote/);
  });
});
