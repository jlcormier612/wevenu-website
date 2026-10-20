/**
 * Launch-certification regressions: declared Import Data scope must match
 * what row mappers persist, and UI copy must not promise unsupported work
 * (linked calendar Events; package line items).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { COUPLE_FIELDS, LEAD_FIELDS, PACKAGE_FIELDS } from "@/lib/import/types";
import { rowToClientInput, rowToLeadInput, rowToPackageInput } from "@/lib/import/utils";

const wizardSrc = readFileSync(
  new URL("../../components/settings/import-wizard.tsx", import.meta.url),
  "utf8",
);
const packageServiceSrc = readFileSync(
  new URL("../packages/service.ts", import.meta.url),
  "utf8",
);
const importActionsSrc = readFileSync(
  new URL("../../app/(app)/settings/import/actions.ts", import.meta.url),
  "utf8",
);

describe("Import Data scope honesty", () => {
  it("does not claim client imports create linked calendar Events", () => {
    assert.doesNotMatch(wizardSrc, /clients with linked events/i);
    assert.match(wizardSrc, /Calendar Events are not created here/i);
    assert.match(wizardSrc, /Event dates stay on the client/i);
  });

  it("states package import is shell-only (no package_items)", () => {
    assert.match(wizardSrc, /Included line items and inventory links are not imported/i);
    assert.match(wizardSrc, /Package shell only/i);
    // Import path creates packages via createPackage(input) without items API
    assert.match(importActionsSrc, /createPackage\(/);
    assert.doesNotMatch(importActionsSrc, /package_items|addPackageItem|createPackageItem/);
    assert.match(packageServiceSrc, /insertPackage/);
  });

  it("maps partner email and lead guest count into persisted inputs", () => {
    assert.ok(COUPLE_FIELDS.some((f) => f.key === "partnerEmail"));
    assert.ok(LEAD_FIELDS.some((f) => f.key === "guestCount"));
    assert.ok(PACKAGE_FIELDS.every((f) => !/item|composition|inventory/i.test(f.key)));

    const client = rowToClientInput(
      {
        "Partner 1 First Name": "A",
        "Partner 1 Last Name": "B",
        Email: "a@example.invalid",
        "Partner 2 Email": "p@example.invalid",
      },
      {
        firstName: "Partner 1 First Name",
        lastName: "Partner 1 Last Name",
        email: "Email",
        partnerEmail: "Partner 2 Email",
        phone: null,
        partnerFirstName: null,
        partnerLastName: null,
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
      },
    );
    assert.equal(client.partnerEmail, "p@example.invalid");

    const lead = rowToLeadInput(
      { "First Name": "L", "Last Name": "D", "Guest Count": "85", Email: "l@example.invalid" },
      {
        firstName: "First Name",
        lastName: "Last Name",
        email: "Email",
        phone: null,
        eventDate: null,
        eventType: null,
        guestCount: "Guest Count",
        estimatedBudget: null,
        source: null,
        inquiryMessage: null,
      },
    );
    assert.equal(lead.guestCount, "85");

    const pkg = rowToPackageInput(
      { "Package Name": "Gold", Description: "Nice", "Base Price": "$1,200.00", Category: "Wedding" },
      {
        name: "Package Name",
        description: "Description",
        basePrice: "Base Price",
        category: "Category",
      },
    );
    assert.equal(pkg.name, "Gold");
    assert.equal(pkg.basePrice, "1200");
    assert.equal("items" in pkg, false);
  });
});
