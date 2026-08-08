import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SECTION_AUDIENCES,
  isSectionVisible,
  normalizeSectionAudiences,
  normalizeSectionOverrides,
  projectGuideForAudience,
  resolveContent,
  resolveFaqAnswer,
  resolveFaqsForAudience,
} from "@/lib/venue-guide/audience";

describe("normalizeSectionAudiences", () => {
  it("returns defaults for null/empty", () => {
    assert.deepEqual(normalizeSectionAudiences(null), DEFAULT_SECTION_AUDIENCES);
    assert.deepEqual(normalizeSectionAudiences({}), DEFAULT_SECTION_AUDIENCES);
  });

  it("merges valid overrides and ignores junk", () => {
    const result = normalizeSectionAudiences({
      accommodations: "both",
      parking: "vendors",
      faqs: "not-a-real-audience",
      unknownKey: "clients",
    });
    assert.equal(result.accommodations, "both");
    assert.equal(result.parking, "vendors");
    assert.equal(result.faqs, "both");
    assert.equal(result.things, "clients");
  });
});

describe("isSectionVisible", () => {
  it("defaults match today's vendor-hiding behavior", () => {
    assert.equal(isSectionVisible("accommodations", "clients"), true);
    assert.equal(isSectionVisible("accommodations", "vendors"), false);
    assert.equal(isSectionVisible("things", "vendors"), false);
    assert.equal(isSectionVisible("parking", "vendors"), true);
    assert.equal(isSectionVisible("policies", "clients"), true);
  });

  it("respects stored audiences", () => {
    const audiences = { ...DEFAULT_SECTION_AUDIENCES, parking: "vendors" as const };
    assert.equal(isSectionVisible("parking", "clients", audiences), false);
    assert.equal(isSectionVisible("parking", "vendors", audiences), true);
  });
});

describe("resolveContent", () => {
  const overrides = { parking: { vendors: "Load-in via north gate" } };

  it("clients always get main copy", () => {
    assert.equal(
      resolveContent("parking", "clients", "Guest lot A", overrides),
      "Guest lot A",
    );
  });

  it("vendors prefer non-empty override then fall back to main", () => {
    assert.equal(
      resolveContent("parking", "vendors", "Guest lot A", overrides),
      "Load-in via north gate",
    );
    assert.equal(
      resolveContent("parking", "vendors", "Guest lot A", { parking: { vendors: "  " } }),
      "Guest lot A",
    );
    assert.equal(
      resolveContent("policies", "vendors", "No sparklers", {}),
      "No sparklers",
    );
  });
});

describe("FAQ audience helpers", () => {
  const faqs = [
    { question: "Sparklers?", answer: "No", audience: "both" as const },
    {
      question: "Load-in window?",
      answer: "See coordinator",
      audience: "vendors" as const,
    },
    {
      question: "Hotel shuttle?",
      answer: "Yes for guests",
      audience: "both" as const,
      answer_for_vendors: "Vendors use the service road",
    },
    { question: "Guest dress?", answer: "Cocktail", audience: "clients" as const },
  ];

  it("filters by audience and resolves dual answers", () => {
    const clientFaqs = resolveFaqsForAudience(faqs, "clients");
    assert.deepEqual(
      clientFaqs.map((f) => f.question),
      ["Sparklers?", "Hotel shuttle?", "Guest dress?"],
    );
    assert.equal(
      clientFaqs.find((f) => f.question === "Hotel shuttle?")?.answer,
      "Yes for guests",
    );

    const vendorFaqs = resolveFaqsForAudience(faqs, "vendors");
    assert.deepEqual(
      vendorFaqs.map((f) => f.question),
      ["Sparklers?", "Load-in window?", "Hotel shuttle?"],
    );
    assert.equal(
      vendorFaqs.find((f) => f.question === "Hotel shuttle?")?.answer,
      "Vendors use the service road",
    );
  });

  it("resolveFaqAnswer defaults to main", () => {
    assert.equal(
      resolveFaqAnswer({ question: "Q", answer: "A" }, "vendors"),
      "A",
    );
  });
});

describe("projectGuideForAudience", () => {
  const raw = {
    parkingInfo: "Guest parking",
    transportation: "Uber drop-off",
    nearbyAccommodations: "Hotel row",
    hotelBlocks: [{ name: "Marriott" }],
    rainPlan: "Ballroom",
    policies: "No flames",
    ceremonyInstructions: "Arrive 30m early",
    thingsToDo: "Try the cafe",
    faqs: [
      { question: "Pets?", answer: "No pets" },
      { question: "Dock?", answer: "Use dock B", audience: "vendors" as const },
    ],
    importantContacts: [{ name: "Sam", role: "Coordinator" }],
    sectionAudiences: null,
    sectionOverrides: {
      parking: { vendors: "Vendor lot + loading dock" },
      policies: { vendors: "Insurance COI required" },
    },
  };

  it("projects client view with main copy and client-default sections", () => {
    const view = projectGuideForAudience(raw, "clients");
    assert.ok(view);
    assert.equal(view.parkingInfo, "Guest parking");
    assert.equal(view.policies, "No flames");
    assert.equal(view.nearbyAccommodations, "Hotel row");
    assert.equal(view.hotelBlocks.length, 1);
    assert.equal(view.thingsToDo, "Try the cafe");
    assert.equal(view.faqs.length, 1);
    assert.equal(view.parkingUsesVendorOverride, false);
  });

  it("projects vendor view hiding hotels/things and using overrides", () => {
    const view = projectGuideForAudience(raw, "vendors");
    assert.ok(view);
    assert.equal(view.parkingInfo, "Vendor lot + loading dock");
    assert.equal(view.policies, "Insurance COI required");
    assert.equal(view.transportation, "Uber drop-off");
    assert.equal(view.nearbyAccommodations, null);
    assert.deepEqual(view.hotelBlocks, []);
    assert.equal(view.thingsToDo, null);
    assert.equal(view.faqs.length, 2);
    assert.equal(view.parkingUsesVendorOverride, true);
  });

  it("normalizes overrides object", () => {
    assert.deepEqual(
      normalizeSectionOverrides({ parking: { vendors: "X" }, junk: 1 }),
      { parking: { vendors: "X" } },
    );
  });
});
