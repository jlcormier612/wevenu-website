import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  classifyVendorMatch,
  resolveConfirmedVendorAction,
  vendorImportFingerprint,
  type IncomingVendor,
  type VendorMatchRecord,
} from "@/lib/import/vendor-match";
import { resolveImportMatchAction } from "@/lib/import/venue-controlled-match";

function vendor(overrides: Partial<IncomingVendor> = {}): IncomingVendor {
  return {
    businessName: "Bloom & Co",
    email: "hello@bloom.test",
    phone: "555-0200",
    websiteUrl: "https://bloom.test",
    contactName: "Avery Bloom",
    sourceVendorId: null,
    ...overrides,
  };
}

function record(incoming: IncomingVendor, extra: Partial<VendorMatchRecord> = {}): VendorMatchRecord {
  return {
    vendorId: extra.vendorId ?? "vendor-1",
    relationshipId: extra.relationshipId ?? "rel-1",
    connectedToThisVenue: extra.connectedToThisVenue ?? true,
    businessName: incoming.businessName,
    email: incoming.email ?? null,
    phone: incoming.phone ?? null,
    websiteUrl: incoming.websiteUrl ?? null,
    contactName: incoming.contactName ?? null,
    isClaimed: extra.isClaimed ?? false,
    sourceVendorId: incoming.sourceVendorId ?? null,
    importFingerprint: extra.importFingerprint ?? vendorImportFingerprint(incoming),
    fileRow: extra.fileRow ?? null,
  };
}

describe("classifyVendorMatch", () => {
  it("auto-skips only a proven unchanged venue relationship retry", () => {
    const original = vendor({ sourceVendorId: "V-1" });
    const match = classifyVendorMatch(original, [record(original)]);
    assert.equal(match.alreadyImported, true);
    assert.equal(match.needsReview, false);
  });

  it("holds same email with a different business name", () => {
    const existing = vendor({ businessName: "Bloom & Co" });
    const incoming = vendor({ businessName: "Bloom Catering" });
    const match = classifyVendorMatch(incoming, [record(existing)]);
    assert.equal(match.needsReview, true);
    assert.match(match.inquiryNotes.join(" "), /email/i);
    assert.equal(resolveImportMatchAction(match, null), "held");
  });

  it("holds same business name with a different email", () => {
    const existing = vendor({ email: "hello@bloom.test" });
    const incoming = vendor({ email: "office@bloom.test" });
    const match = classifyVendorMatch(incoming, [record(existing)]);
    assert.equal(match.needsReview, true);
    assert.match(match.inquiryNotes.join(" "), /business name/i);
  });

  it("asks before linking a global vendor that is not connected to this venue", () => {
    const existing = vendor();
    const match = classifyVendorMatch(existing, [record(existing, { connectedToThisVenue: false, relationshipId: null })]);
    assert.equal(match.needsReview, true);
    assert.equal(match.connectedToThisVenue, false);
    assert.equal(match.alreadyImported, false);
    assert.match(match.inquiryNotes.join(" "), /not yet connected/i);
  });

  it("holds when two global vendors are equally plausible", () => {
    const incoming = vendor({ businessName: "Bloom", email: "shared@vendors.test" });
    const a = record({ ...incoming, businessName: "Bloom North" }, { vendorId: "v-a", connectedToThisVenue: false });
    const b = record({ ...incoming, businessName: "Bloom South" }, { vendorId: "v-b", connectedToThisVenue: false });
    const match = classifyVendorMatch(incoming, [a, b]);
    assert.equal(match.ambiguous, true);
    assert.equal(match.matchedVendorId, null);
    assert.equal(match.needsReview, true);
  });

  it("does not treat a claimed profile as writable", () => {
    const existing = vendor({ phone: "555-0200" });
    const incoming = vendor({ phone: "555-0299" });
    const match = classifyVendorMatch(incoming, [record(existing, { isClaimed: true })]);
    assert.match(match.inquiryNotes.join(" "), /claimed/i);
    assert.equal(match.needsReview, true);
  });

  it("holds Same Vendor when the match is ambiguous or the vendor disappeared", () => {
    const incoming = vendor({ businessName: "Bloom", email: "shared@vendors.test" });
    const a = record({ ...incoming, businessName: "Bloom North" }, { vendorId: "v-a", connectedToThisVenue: false });
    const b = record({ ...incoming, businessName: "Bloom South" }, { vendorId: "v-b", connectedToThisVenue: false });
    const match = classifyVendorMatch(incoming, [a, b]);
    assert.equal(resolveConfirmedVendorAction(match, "use_existing"), "held");
    assert.equal(resolveConfirmedVendorAction(classifyVendorMatch(incoming, []), "use_existing"), "held");
  });

  it("holds a matching source Vendor ID when details changed", () => {
    const existing = vendor({ sourceVendorId: "V-1", contactName: "Avery Bloom" });
    const incoming = vendor({ sourceVendorId: "V-1", contactName: "Updated Contact" });
    const match = classifyVendorMatch(incoming, [record(existing)]);
    assert.equal(match.needsReview, true);
    assert.equal(match.changedSinceImport, true);
    assert.equal(match.alreadyImported, false);
  });
});

describe("HQ and self-service Vendor import share venue-controlled matching", () => {
  const hq = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
  const selfServe = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
  const wizard = readFileSync(resolve("components/settings/import-wizard.tsx"), "utf8");
  const hqVendors = hq.slice(
    hq.indexOf("export async function importVendorsForVenueAction"),
    hq.indexOf("export async function importInventoryForVenueAction"),
  );
  const csvVendors = selfServe.slice(
    selfServe.indexOf("export async function importVendorsAction"),
    selfServe.indexOf("export async function importInventoryAction"),
  );

  it("uses the shared vendor classifier instead of automatic email skip", () => {
    assert.match(hqVendors, /classifyVendorMatch/);
    assert.match(csvVendors, /classifyVendorMatch/);
    assert.doesNotMatch(hqVendors, /findActiveDuplicateVendorForVenue/);
    assert.doesNotMatch(csvVendors, /findActiveDuplicateVendor\(/);
  });

  it("offers Same Vendor, Different Vendor, and Don't import", () => {
    assert.match(wizard, /Same Vendor/);
    assert.match(wizard, /Different Vendor/);
  });
});
