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
  const overrides = {
    parking: { vendors: "Load-in via north gate" },
    ceremony: { vendors: "Vendors enter via north door at T-90" },
    things: { vendors: "Power drop at dock B" },
  };

  it("clients always get main copy", () => {
    assert.equal(
      resolveContent("parking", "clients", "Guest lot A", overrides),
      "Guest lot A",
    );
    assert.equal(
      resolveContent("ceremony", "clients", "Arrive 30m early", overrides),
      "Arrive 30m early",
    );
  });

  it("vendors prefer non-empty override then fall back to main", () => {
    assert.equal(
      resolveContent("parking", "vendors", "Guest lot A", overrides),
      "Load-in via north gate",
    );
    assert.equal(
      resolveContent("ceremony", "vendors", "Arrive 30m early", overrides),
      "Vendors enter via north door at T-90",
    );
    assert.equal(
      resolveContent("things", "vendors", "Try the cafe", overrides),
      "Power drop at dock B",
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

  it("filters by audience and resolves dual answers (legacy fallback)", () => {
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

  it("prefers section_overrides.faqs.vendors when present", () => {
    const overrides = {
      faqs: {
        vendors: [
          { question: "Dock access?", answer: "Use dock B" },
          { question: "COI?", answer: "Required 14 days prior" },
        ],
      },
    };
    const vendorFaqs = resolveFaqsForAudience(faqs, "vendors", overrides);
    assert.deepEqual(vendorFaqs, [
      { question: "Dock access?", answer: "Use dock B" },
      { question: "COI?", answer: "Required 14 days prior" },
    ]);
    // Clients still see main list
    assert.equal(resolveFaqsForAudience(faqs, "clients", overrides).length, 3);
  });

  it("empty vendor FAQ list falls back to legacy filtering", () => {
    const vendorFaqs = resolveFaqsForAudience(faqs, "vendors", {
      faqs: { vendors: [] },
    });
    assert.equal(vendorFaqs.length, 3);
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
    sectionAudiences: {
      ...DEFAULT_SECTION_AUDIENCES,
      things: "both" as const,
    },
    sectionOverrides: {
      parking: { vendors: "Vendor lot + loading dock" },
      policies: { vendors: "Insurance COI required" },
      ceremony: { vendors: "Load-in at T-90 via north door" },
      things: { vendors: "Vendor power at dock B" },
      faqs: {
        vendors: [{ question: "Insurance?", answer: "Email COI to ops@" }],
      },
    },
  };

  it("projects client view with main copy and client-default sections", () => {
    const view = projectGuideForAudience(raw, "clients");
    assert.ok(view);
    assert.equal(view.parkingInfo, "Guest parking");
    assert.equal(view.policies, "No flames");
    assert.equal(view.ceremonyInstructions, "Arrive 30m early");
    assert.equal(view.thingsToDo, "Try the cafe");
    assert.equal(view.nearbyAccommodations, "Hotel row");
    assert.equal(view.hotelBlocks.length, 1);
    assert.equal(view.faqs.length, 1);
    assert.equal(view.faqs[0]?.question, "Pets?");
    assert.equal(view.parkingUsesVendorOverride, false);
  });

  it("projects vendor view hiding hotels and using overrides + vendor FAQ list", () => {
    const view = projectGuideForAudience(raw, "vendors");
    assert.ok(view);
    assert.equal(view.parkingInfo, "Vendor lot + loading dock");
    assert.equal(view.policies, "Insurance COI required");
    assert.equal(view.ceremonyInstructions, "Load-in at T-90 via north door");
    assert.equal(view.thingsToDo, "Vendor power at dock B");
    assert.equal(view.transportation, "Uber drop-off");
    assert.equal(view.nearbyAccommodations, null);
    assert.deepEqual(view.hotelBlocks, []);
    assert.deepEqual(view.faqs, [
      { question: "Insurance?", answer: "Email COI to ops@" },
    ]);
    assert.equal(view.parkingUsesVendorOverride, true);
  });

  it("normalizes overrides object including ceremony/things/faqs", () => {
    assert.deepEqual(
      normalizeSectionOverrides({
        parking: { vendors: "X" },
        ceremony: { vendors: "Y" },
        things: { vendors: "Z" },
        faqs: { vendors: [{ question: "Q", answer: "A" }] },
        junk: 1,
      }),
      {
        parking: { vendors: "X" },
        ceremony: { vendors: "Y" },
        things: { vendors: "Z" },
        faqs: { vendors: [{ question: "Q", answer: "A" }] },
      },
    );
  });
});
