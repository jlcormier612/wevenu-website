import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  captureContractBrandingSnapshot,
  resolveContractBrandPresentation,
  type ContractBrandingSnapshot,
} from "@/lib/contracts/branding";
import { resolvePdfBrandColors } from "@/lib/collateral/pdf-brand";
import type { InvoiceBrandingSnapshot } from "@/lib/invoices/types";
import type { Venue } from "@/lib/venue/types";

function venueStub(overrides: Partial<Venue> = {}): Venue {
  return {
    name: "Brand A Venue",
    businessName: "Brand A LLC",
    email: "a@example.com",
    phone: "555-0001",
    website: "https://brand-a.example",
    addressLine1: "1 A Street",
    addressLine2: null,
    logoUrl: "https://example.com/a.png",
    primaryColor: "#AA0000",
    secondaryColor: "#00AA00",
    accentColor: "#0000AA",
    neutralColor: "#EEEEEE",
    ...overrides,
  } as Venue;
}

describe("contract branding snapshot capture", () => {
  it("captures only fields Contract renderers consume", () => {
    const snap = captureContractBrandingSnapshot(venueStub());
    assert.deepEqual(Object.keys(snap).sort(), [
      "accentColor",
      "addressLine1",
      "addressLine2",
      "businessName",
      "email",
      "logoUrl",
      "name",
      "neutralColor",
      "phone",
      "primaryColor",
      "secondaryColor",
      "website",
    ]);
    assert.equal(snap.primaryColor, "#AA0000");
    assert.equal(snap.name, "Brand A Venue");
    // City/state are Invoice-print fields, not Contract PDF/sign consumers.
    assert.equal("city" in snap, false);
  });

  it("required color and identity fields are present", () => {
    const snap = captureContractBrandingSnapshot(venueStub());
    for (const key of [
      "name", "primaryColor", "secondaryColor", "accentColor", "neutralColor",
    ] as const) {
      assert.ok(snap[key], `${key} required`);
    }
  });
});

describe("contract branding snapshot resolve", () => {
  it("prefers snapshot when present (Brand A survives Brand B venue)", () => {
    const snapA = captureContractBrandingSnapshot(venueStub());
    const venueB = venueStub({
      name: "Brand B Venue",
      primaryColor: "#BBBBBB",
      secondaryColor: "#CCCCCC",
      accentColor: "#DDDDDD",
      neutralColor: "#FFFFFF",
      logoUrl: "https://example.com/b.png",
    });
    const resolved = resolveContractBrandPresentation(snapA, venueB);
    assert.equal(resolved?.primaryColor, "#AA0000");
    assert.equal(resolved?.name, "Brand A Venue");
    assert.equal(resolved?.logoUrl, "https://example.com/a.png");
  });

  it("falls back to live venue when no snapshot (backward compat)", () => {
    const venue = venueStub({ primaryColor: "#112233", name: "Live Venue" });
    const resolved = resolveContractBrandPresentation(null, venue);
    assert.equal(resolved?.primaryColor, "#112233");
    assert.equal(resolved?.name, "Live Venue");
  });

  it("new contract path uses current brand when snapshot is captured from current venue", () => {
    const brandB = venueStub({
      name: "Brand B Venue",
      primaryColor: "#BBBBBB",
    });
    const snap = captureContractBrandingSnapshot(brandB);
    assert.equal(snap.primaryColor, "#BBBBBB");
    assert.equal(snap.name, "Brand B Venue");
  });

  it("PDF brand resolution uses snapshot colors when present", () => {
    const snap: ContractBrandingSnapshot = captureContractBrandingSnapshot(venueStub());
    const venueB = venueStub({ primaryColor: "#000000", secondaryColor: "#111111" });
    const brandFields = resolveContractBrandPresentation(snap, venueB);
    const colors = resolvePdfBrandColors(brandFields ?? venueB);
    assert.equal(colors.primary, "#AA0000");
    assert.equal(colors.secondary, "#00AA00");
  });

  it("PDF brand resolution without snapshot uses live venue", () => {
    const venue = venueStub({ primaryColor: "#ABCDEF", secondaryColor: "#FEDCBA" });
    const brandFields = resolveContractBrandPresentation(undefined, venue);
    const colors = resolvePdfBrandColors(brandFields ?? venue);
    assert.equal(colors.primary, "#ABCDEF");
    assert.equal(colors.secondary, "#FEDCBA");
  });
});

describe("invoice branding snapshot unchanged", () => {
  it("InvoiceBrandingSnapshot still includes city/state presentation fields", () => {
    // Smoke: Invoice snapshot shape is intentionally broader than Contract's.
    const invoiceSnap: InvoiceBrandingSnapshot = {
      name: "Inv",
      businessName: null,
      logoUrl: null,
      primaryColor: "#1",
      secondaryColor: "#2",
      accentColor: "#3",
      neutralColor: "#4",
      email: null,
      phone: null,
      website: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      stateRegion: null,
      postalCode: null,
      country: null,
    };
    assert.equal(invoiceSnap.city, null);
    assert.ok("stateRegion" in invoiceSnap);
  });
});
