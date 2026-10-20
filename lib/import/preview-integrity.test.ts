import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  analyzeUnmappedColumns,
  catalogNameWithinFileKey,
  classifyImportPreview,
  normalizeImportAmount,
  normalizeImportDate,
  normalizeImportQuantity,
  normalizeImportVendorPricingTier,
  personEmailWithinFileKey,
  personNameKey,
  vendorWithinFileKey,
} from "@/lib/import/preview-integrity";

const csvImport = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
const quietImport = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");

describe("normalizeImportDate", () => {
  it("accepts ISO and common US dates", () => {
    assert.deepEqual(normalizeImportDate("2027-06-12"), { ok: true, value: "2027-06-12" });
    assert.deepEqual(normalizeImportDate("6/12/2027"), { ok: true, value: "2027-06-12" });
    assert.deepEqual(normalizeImportDate("06-12-2027"), { ok: true, value: "2027-06-12" });
    assert.deepEqual(normalizeImportDate(""), { ok: true, value: null });
  });

  it("rejects invalid calendar dates and unknown formats", () => {
    assert.equal(normalizeImportDate("2/30/2027").ok, false);
    assert.equal(normalizeImportDate("not-a-date").ok, false);
    assert.equal(normalizeImportDate("2027/06/12").ok, false);
  });
});

describe("normalizeImportVendorPricingTier", () => {
  it("maps dollar labels to canonical tiers and rejects garbage", () => {
    const dollars = normalizeImportVendorPricingTier("$$");
    assert.equal(dollars.ok, true);
    if (dollars.ok) assert.equal(dollars.value, "mid_range");
    const premium = normalizeImportVendorPricingTier("premium");
    assert.equal(premium.ok, true);
    if (premium.ok) assert.equal(premium.value, "premium");
    assert.equal(normalizeImportVendorPricingTier("").ok, true);
    assert.equal(normalizeImportVendorPricingTier("expensive").ok, false);
  });
});

describe("normalizeImportAmount and quantity", () => {
  it("parses currency and rejects negatives / garbage", () => {
    assert.deepEqual(normalizeImportAmount("$1,500.50"), { ok: true, value: "1500.5" });
    assert.deepEqual(normalizeImportAmount(""), { ok: true, value: "" });
    assert.equal(normalizeImportAmount("abc").ok, false);
    assert.equal(normalizeImportAmount("-5").ok, false);
  });

  it("requires whole-number quantities", () => {
    assert.deepEqual(normalizeImportQuantity(""), { ok: true, value: "0" });
    assert.deepEqual(normalizeImportQuantity("12"), { ok: true, value: "12" });
    assert.equal(normalizeImportQuantity("12.5").ok, false);
    assert.equal(normalizeImportQuantity("-1").ok, false);
  });
});

describe("within-file identity keys", () => {
  it("does not treat blank emails as a shared match key", () => {
    assert.equal(personEmailWithinFileKey(""), null);
    assert.equal(personEmailWithinFileKey("  "), null);
    assert.equal(personEmailWithinFileKey("Ada@Example.com"), "email:ada@example.com");
  });

  it("normalizes vendor and catalog names", () => {
    assert.equal(vendorWithinFileKey("Bloom & Co", ""), "biz:bloom & co");
    assert.equal(vendorWithinFileKey("X", "A@B.com"), "email:a@b.com");
    assert.equal(catalogNameWithinFileKey("  Round Table  "), "name:round table");
    assert.equal(personNameKey("Ada", "Lovelace"), "name:ada|lovelace");
  });
});

describe("analyzeUnmappedColumns", () => {
  it("separates unmapped columns with data from empty ones", () => {
    const headers = ["First Name", "Last Name", "Secret Notes", "Empty Col"];
    const mapping = { firstName: "First Name", lastName: "Last Name", email: null };
    const rows = [
      { "First Name": "Ada", "Last Name": "Lovelace", "Secret Notes": "VIP", "Empty Col": "" },
      { "First Name": "Grace", "Last Name": "Hopper", "Secret Notes": "", "Empty Col": "" },
    ];
    const report = analyzeUnmappedColumns(headers, mapping, rows);
    assert.deepEqual(report.withData, ["Secret Notes"]);
    assert.deepEqual(report.empty, ["Empty Col"]);
    assert.deepEqual(report.headers, ["Secret Notes", "Empty Col"]);
  });
});

describe("classifyImportPreview", () => {
  it("flags unmapped data and email within-file duplicates for clients", () => {
    const headers = ["First Name", "Last Name", "Email", "Extra"];
    const mapping = {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      partnerFirstName: null,
      partnerLastName: null,
      phone: null,
      eventDate: null,
      endDate: null,
      eventType: null,
      guestCount: null,
      ceremonyTime: null,
      receptionTime: null,
      setupTime: null,
      teardownTime: null,
      spaceName: null,
      internalNotes: null,
    };
    const rows = [
      { "First Name": "Ada", "Last Name": "L", "Email": "a@example.com", Extra: "keep?" },
      { "First Name": "Ada2", "Last Name": "L2", "Email": "a@example.com", Extra: "" },
      { "First Name": "No", "Last Name": "", "Email": "", Extra: "" },
    ];
    const summary = classifyImportPreview("couples", headers, mapping, rows);
    assert.ok(summary.unmapped.withData.includes("Extra"));
    assert.equal(summary.rows[1]?.disposition, "skip_within_file_duplicate");
    assert.equal(summary.rows[2]?.disposition, "skip_required");
    assert.ok(summary.readyCount >= 1);
  });

  it("warns on same name without email instead of skipping", () => {
    const headers = ["First Name", "Last Name", "Email"];
    const mapping = {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      partnerFirstName: null,
      partnerLastName: null,
      phone: null,
      eventDate: null,
      endDate: null,
      eventType: null,
      guestCount: null,
      ceremonyTime: null,
      receptionTime: null,
      setupTime: null,
      teardownTime: null,
      spaceName: null,
      internalNotes: null,
    };
    const rows = [
      { "First Name": "Sam", "Last Name": "Smith", Email: "" },
      { "First Name": "Sam", "Last Name": "Smith", Email: "" },
    ];
    const summary = classifyImportPreview("couples", headers, mapping, rows);
    assert.equal(summary.rows[0]?.disposition, "ready");
    assert.equal(summary.rows[1]?.disposition, "warn_ambiguous_name");
    assert.equal(summary.readyCount, 2);
    assert.equal(summary.warnCount, 1);
  });

  it("rejects bad dates and currency before commit classification", () => {
    const headers = ["First Name", "Last Name", "Email", "Event Date", "Budget"];
    const mapping = {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phone: null,
      eventDate: "Event Date",
      eventType: null,
      estimatedBudget: "Budget",
      source: null,
      inquiryMessage: null,
      partnerFirstName: null,
      partnerLastName: null,
      partnerEmail: null,
      endDate: null,
      guestCount: null,
      inquiryDate: null,
    };
    const rows = [
      {
        "First Name": "A",
        "Last Name": "B",
        Email: "a@x.com",
        "Event Date": "2/30/2027",
        Budget: "100",
      },
      {
        "First Name": "C",
        "Last Name": "D",
        Email: "c@x.com",
        "Event Date": "6/12/2027",
        Budget: "nope",
      },
      {
        "First Name": "E",
        "Last Name": "F",
        Email: "e@x.com",
        "Event Date": "6/12/2027",
        Budget: "$1,200",
      },
    ];
    const summary = classifyImportPreview("leads", headers, mapping, rows);
    assert.equal(summary.rows[0]?.disposition, "skip_invalid");
    assert.equal(summary.rows[1]?.disposition, "skip_invalid");
    assert.equal(summary.rows[2]?.disposition, "ready");
  });

  it("dedupes inventory and packages by normalized name within the file", () => {
    const headers = ["Item Name", "Quantity"];
    const mapping = {
      name: "Item Name",
      category: null,
      quantity: "Quantity",
      width: null,
      length: null,
      height: null,
      shape: null,
      color: null,
      printableName: null,
    };
    const rows = [
      { "Item Name": "Round Table", Quantity: "10" },
      { "Item Name": " round table ", Quantity: "5" },
    ];
    const summary = classifyImportPreview("inventory", headers, mapping, rows);
    assert.equal(summary.rows[1]?.disposition, "skip_within_file_duplicate");
  });
});

describe("CSV import actions — integrity wiring", () => {
  it("keeps historicalImport true on lead import", () => {
    assert.match(quietImport, /createLead\(\s*normalizedLead,\s*"import",\s*true\s*\)|createLead\(\s*row,\s*"import",\s*true\s*\)/);
  });

  it("applies within-file dedupe for couples, vendors, inventory, and packages", () => {
    assert.match(csvImport, /personEmailWithinFileKey/);
    assert.match(csvImport, /vendorWithinFileKey/);
    assert.match(csvImport, /catalogNameWithinFileKey/);
    assert.match(csvImport, /normalizeImportDate/);
    assert.match(csvImport, /normalizeImportQuantity/);
    assert.match(csvImport, /normalizeImportAmount/);
  });
});
