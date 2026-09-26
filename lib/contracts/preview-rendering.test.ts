/**
 * Contract Preview / rendering forensic fix — branding, tokens, multi-signer party.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveContractBrandPresentation } from "@/lib/contracts/branding";
import { DEFERRED_MERGE_FIELD_KEYS, MERGE_FIELDS } from "@/lib/contracts/constants";
import { buildMergeData, mergeContent } from "@/lib/contracts/merge";
import {
  formatBalanceRemaining,
  formatCeremonyOrReceptionSummary,
  formatContractTotalAmount,
  formatRequiredClientPartyName,
  formatVenueAccessHours,
  MISSING_BALANCE_REMAINING,
  MISSING_CEREMONY_SUMMARY,
  MISSING_RECEPTION_SUMMARY,
  MISSING_VENDORS_ON_FILE,
  MISSING_VENUE_ACCESS_HOURS,
} from "@/lib/contracts/merge-extras";
import { applyRequiredSignerSignatureBlocks } from "@/lib/contracts/signature-blocks";
import { contractTemplatePreviewMergeData } from "@/lib/contracts/preview";
import {
  assertCustomerSafeContractContent,
  WEDDING_VENUE_AGREEMENT_CONTENT,
} from "@/lib/contracts/starters";
import { extractTokens } from "@/lib/shared-merge/tokens";
import { formatPackageSection } from "@/lib/commercial-selections/constants";

describe("contract branding presentation", () => {
  it("uses live venue branding when no snapshot (Preview path)", () => {
    const brand = resolveContractBrandPresentation(null, {
      name: "Jen's Fancy Venue",
      businessName: "Jen's Fancy Venue LLC",
      logoUrl: "https://cdn.example.com/logo.png",
      primaryColor: "#8B4557",
      secondaryColor: "#3D2C2E",
      accentColor: "#C4A484",
      neutralColor: "#F8F4F0",
    });
    assert.ok(brand);
    assert.equal(brand!.logoUrl, "https://cdn.example.com/logo.png");
    assert.equal(brand!.primaryColor, "#8B4557");
    assert.notEqual(brand!.primaryColor, "#5D6F5D");
  });

  it("does not invent HTC green when venue brand is provided", () => {
    const brand = resolveContractBrandPresentation(null, {
      name: "Jen's Fancy Venue",
      primaryColor: "#8B4557",
      secondaryColor: "#3D2C2E",
      accentColor: "#C4A484",
      neutralColor: "#F8F4F0",
      logoUrl: null,
    });
    assert.equal(brand!.primaryColor, "#8B4557");
  });
});

describe("deferred/operational token resolution", () => {
  it("resolves balance_remaining, venue_access_hours, ceremony_summary, reception_summary when present", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Wedding Venue Agreement",
      contractTotal: formatContractTotalAmount(25000)!,
      venueAccessHours: formatVenueAccessHours({
        setupTime: "14:00",
        startTime: "16:00",
        endTime: "22:00",
        teardownTime: "23:00",
      }),
      ceremonySummary: formatCeremonyOrReceptionSummary({
        label: "Ceremony",
        location: "Garden Terrace",
        startTime: "16:00",
      }),
      receptionSummary: formatCeremonyOrReceptionSummary({
        label: "Reception",
        location: "The Barn",
        startTime: "18:00",
      }),
      balanceRemaining: formatBalanceRemaining(20000),
    });

    assert.equal(data.contract_total, "$25,000.00");
    assert.equal(data.balance_remaining, "$20,000.00");
    assert.match(data.venue_access_hours!, /Setup/);
    assert.match(data.ceremony_summary!, /Garden Terrace/);
    assert.match(data.reception_summary!, /The Barn/);

    const body = mergeContent(
      "Total {{contract_total}}. Balance {{balance_remaining}}. Hours {{venue_access_hours}}. {{ceremony_summary}}. {{reception_summary}}.",
      data,
    );
    assert.doesNotMatch(body, /\{\{/);
    assert.match(body, /\$25,000\.00/);
    assert.match(body, /\$20,000\.00/);
  });

  it("never leaves raw tokens when source data is missing", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: null,
      eventType: null,
      guestCount: null,
      contractTitle: "Agreement",
    });
    assert.equal(data.venue_access_hours, MISSING_VENUE_ACCESS_HOURS);
    assert.equal(data.ceremony_summary, MISSING_CEREMONY_SUMMARY);
    assert.equal(data.reception_summary, MISSING_RECEPTION_SUMMARY);
    assert.equal(data.balance_remaining, MISSING_BALANCE_REMAINING);
    assert.equal(data.vendors_on_file, MISSING_VENDORS_ON_FILE);

    const body = mergeContent(
      "{{balance_remaining}} {{venue_access_hours}} {{ceremony_summary}} {{reception_summary}} {{vendors_on_file}}",
      data,
    );
    assert.doesNotMatch(body, /\{\{/);
    assert.doesNotMatch(body, /vendors_on_file/);
  });

  it("exposes the four fields in the Contract Builder picker", () => {
    const keys = MERGE_FIELDS.map((f) => f.key);
    for (const key of [
      "balance_remaining",
      "venue_access_hours",
      "ceremony_summary",
      "reception_summary",
    ]) {
      assert.ok(keys.includes(key), key);
    }
    assert.equal(keys.includes("vendors_on_file"), false);
  });
});

describe("vendors_on_file deferred token safety", () => {
  it("never leaves raw vendors_on_file in Preview materialization", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Wedding Venue Agreement",
    });
    const body = mergeContent(
      "VENDORS\nNo outside vendors.\n\n{{vendors_on_file}}\n\nFOOD",
      data,
    );
    assert.doesNotMatch(body, /\{\{vendors_on_file\}\}/);
    assert.doesNotMatch(body, /\{\{/);
    assert.match(body, /Vendors on file are not listed yet/);
  });

  it("Send safety passes after materializing legacy vendors_on_file content", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      requiredClientSignerNames: ["Rebecca Sunshine", "Brian Friendly"],
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Wedding Venue Agreement",
      packageSection: "Selected package / services:\n• Full Service Wedding\n\nPackage total: $25,000.00",
      contractTotal: "$25,000.00",
    });
    // Minimal customer-safe body after materialization (no starter policy placeholders).
    const authored =
      "This Agreement is between {{venue_name}} and {{client_name}}.\n" +
      "{{package_section}}\n{{contract_total}}\n{{vendors_on_file}}\n{{today_date}}";
    const merged = mergeContent(authored, data);
    assert.doesNotMatch(merged, /\{\{/);
    const safety = assertCustomerSafeContractContent(merged);
    assert.equal(safety.ok, true);
  });

  it("code starter does not contain vendors_on_file", () => {
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{vendors_on_file\}\}/);
    for (const key of DEFERRED_MERGE_FIELD_KEYS) {
      assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, new RegExp(`\\{\\{${key}\\}\\}`));
    }
  });

  it("starter tokens are only supported Smart Fields", () => {
    const supported = new Set(MERGE_FIELDS.map((f) => f.key));
    const tokens = extractTokens(WEDDING_VENUE_AGREEMENT_CONTENT);
    for (const t of tokens) {
      assert.ok(supported.has(t), `unsupported starter token {{${t}}}`);
    }
  });
});

describe("multi-signer client party identity", () => {
  it("one required signer → one client identity", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      requiredClientSignerNames: ["Rebecca Sunshine"],
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.client_name, "Rebecca Sunshine");
    const body = mergeContent(
      "This Agreement is between {{venue_name}} and {{client_name}}.",
      data,
    );
    assert.match(body, /Jen's Fancy Venue and Rebecca Sunshine/);
    assert.doesNotMatch(body, /Brian/);
  });

  it("two required signers → both client identities in party wording", () => {
    const names = ["Rebecca Sunshine", "Brian Friendly"];
    assert.equal(formatRequiredClientPartyName(names), "Rebecca Sunshine & Brian Friendly");
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      requiredClientSignerNames: names,
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.client_name, "Rebecca Sunshine & Brian Friendly");
    // first/last stay primary contact (not redefined globally for other workflows)
    assert.equal(data.first_name, "Rebecca");
    assert.equal(data.last_name, "Sunshine");

    const authored =
      "This Agreement is between {{venue_name}} and {{client_name}}.\n\n" +
      "SIGNATURES\nClient\n{{client_name}}\n\nSignature: ________________________________\nDate: ____________________________________";
    const merged = mergeContent(authored, data);
    const withSigs = applyRequiredSignerSignatureBlocks(merged, names);
    assert.match(withSigs, /Jen's Fancy Venue and Rebecca Sunshine & Brian Friendly/);
    assert.match(withSigs, /Client\nRebecca Sunshine\n\nSignature:/);
    assert.match(withSigs, /Client\nBrian Friendly\n\nSignature:/);
  });

  it("Send freeze with persisted names matches Preview two-signer materialization", () => {
    // Simulates sendContract passing requiredClientSignerNamesFromSigners(...)
    // when both relationship signers have null clientContactId.
    const persistedNames = ["Rebecca Sunshine", "Brian Friendly"];
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      requiredClientSignerNames: persistedNames,
      eventDate: "2027-06-26",
      eventType: "wedding",
      guestCount: 150,
      contractTitle: "Venue Rental Agreement — Rebecca Sunshine & Brian Friendly",
      packageSection:
        "Selected package / services:\n• Full Service Wedding\n\nPackage total: $25,000.00\nDeposit: $6,250.00\nRemaining: $18,750.00",
      contractTotal: "$25,000.00",
    });
    const authored =
      "This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.\n\n" +
      "{{package_section}}\n\nSIGNATURES\nClient\n{{client_name}}\n\nSignature: ________________________________\nDate: ____________________________________\n\nVenue\n{{venue_name}}";
    const frozen = applyRequiredSignerSignatureBlocks(mergeContent(authored, data), persistedNames);
    assert.match(frozen, /Jen's Fancy Venue and Rebecca Sunshine & Brian Friendly/);
    assert.match(frozen, /Client\nRebecca Sunshine\n\nSignature:/);
    assert.match(frozen, /Client\nBrian Friendly\n\nSignature:/);
    assert.match(frozen, /Venue\nJen's Fancy Venue/);
    assert.doesNotMatch(frozen, /\{\{/);
    // Contrast: primary-only fallback would look like this — must not equal freeze.
    const primaryOnly = applyRequiredSignerSignatureBlocks(
      mergeContent(
        authored,
        buildMergeData({
          venueName: "Jen's Fancy Venue",
          clientFirstName: "Rebecca",
          clientLastName: "Sunshine",
          requiredClientSignerNames: ["Rebecca Sunshine"],
          eventDate: "2027-06-26",
          eventType: "wedding",
          guestCount: 150,
          contractTitle: "Venue Rental Agreement — Rebecca Sunshine & Brian Friendly",
        }),
      ),
      ["Rebecca Sunshine"],
    );
    assert.match(primaryOnly, /and Rebecca Sunshine for/);
    assert.doesNotMatch(primaryOnly, /Brian Friendly/);
    assert.notEqual(frozen, primaryOnly);
  });

  it("does not invent a second person when only one signer is selected", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      requiredClientSignerNames: ["Rebecca Sunshine"],
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.client_name, "Rebecca Sunshine");
    assert.doesNotMatch(data.client_name, /&/);
  });

  it("without requiredSignerNames, client_name stays primary-only (backward compatible)", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Rebecca",
      clientLastName: "Sunshine",
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.client_name, "Rebecca Sunshine");
  });
});

describe("Preview sample merge includes resolved operational fields", () => {
  it("template preview sample has currency totals and no empty operational keys", () => {
    const sample = contractTemplatePreviewMergeData();
    assert.match(sample.contract_total!, /\$/);
    assert.match(sample.balance_remaining!, /\$/);
    assert.ok(sample.venue_access_hours);
    assert.ok(sample.ceremony_summary);
    assert.ok(sample.reception_summary);
    assert.match(sample.client_name!, /Buppy Robicheaux & Joy Robicheaux/);
  });
});

describe("package section currency formatting", () => {
  it("uses the same canonical currency format as contract_total", () => {
    const section = formatPackageSection("Full Service Wedding", 25000, [], {
      depositAmount: 6250,
    });
    assert.match(section, /Package total: \$25,000\.00/);
    assert.match(section, /Deposit: \$6,250\.00/);
    assert.match(section, /Remaining: \$18,750\.00/);
    assert.doesNotMatch(section, /\$25000\.00/);
    assert.doesNotMatch(section, /\$6250\.00/);
    assert.equal(formatContractTotalAmount(25000), "$25,000.00");
  });
});
