import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NAV_SECTIONS } from "@/lib/navigation";
import {
  canAccessFinancialNavHref,
  filterNavSectionsForRole,
} from "@/lib/navigation/financial-nav";

describe("financial nav role filter", () => {
  it("hides invoices and payments from staff", () => {
    assert.equal(canAccessFinancialNavHref("staff", "/invoices"), false);
    assert.equal(canAccessFinancialNavHref("staff", "/payments"), false);
    assert.equal(canAccessFinancialNavHref("staff", "/contracts"), true);
  });

  it("keeps invoices and payments for owner/manager/coordinator", () => {
    for (const role of ["owner", "manager", "coordinator"] as const) {
      assert.equal(canAccessFinancialNavHref(role, "/invoices"), true, role);
      assert.equal(canAccessFinancialNavHref(role, "/payments"), true, role);
    }
  });

  it("filters Financials section for staff but keeps Contracts", () => {
    const filtered = filterNavSectionsForRole(NAV_SECTIONS, "staff");
    const financials = filtered.find((s) => s.id === "financials");
    assert.ok(financials);
    assert.deepEqual(
      financials!.items.map((i) => i.href),
      ["/contracts"],
    );
  });

  it("keys the filter off the stable id, not the label", () => {
    // Renaming the section must not disable the staff restriction.
    const renamed = NAV_SECTIONS.map((s) =>
      s.id === "financials" ? { ...s, label: "Money" } : s,
    );
    const financials = filterNavSectionsForRole(renamed, "staff")
      .find((s) => s.id === "financials");
    assert.ok(financials);
    assert.deepEqual(financials!.items.map((i) => i.href), ["/contracts"]);
  });

  it("leaves every other section untouched", () => {
    const filtered = filterNavSectionsForRole(NAV_SECTIONS, "staff");
    assert.deepEqual(
      filtered.filter((s) => s.id !== "financials").map((s) => s.id),
      NAV_SECTIONS.filter((s) => s.id !== "financials").map((s) => s.id),
    );
  });

  it("does not change Financials for coordinator", () => {
    const filtered = filterNavSectionsForRole(NAV_SECTIONS, "coordinator");
    const financials = filtered.find((s) => s.id === "financials");
    assert.ok(financials);
    assert.ok(financials!.items.some((i) => i.href === "/invoices"));
    assert.ok(financials!.items.some((i) => i.href === "/payments"));
  });
});
