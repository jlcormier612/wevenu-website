/**
 * Required + In-house vendors — Option A.
 * Venue Network is_required → book_relationship assignment.
 * Setup Profile requiredVendorIds remains dead / not a source.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const bookSql = read(
  "supabase/migrations/20261413500000_book_relationship_assign_required_vendors.sql",
);
const bookFn = bookSql.slice(
  bookSql.indexOf("create or replace function public.book_relationship"),
  bookSql.indexOf("$$;", bookSql.indexOf("create or replace function public.book_relationship")),
);
const inherit = read("lib/event-setup/inherit.ts");
const setupSection = read("components/settings/setup-profiles-section.tsx");
const portal = read("components/portal/vendor-section.tsx");
const vendorForm = read("components/vendors/vendor-form.tsx");
const vendorList = read("components/vendors/vendor-list.tsx");
const eventVendors = read("components/events/vendors/event-vendors-section.tsx");
const categories = read("lib/vendors/required-categories.ts");
const categoriesPanel = read("components/vendors/required-vendor-categories-panel.tsx");
const bookClient = read("lib/booking-journey/book-client.ts");
const occupancySql = read(
  "supabase/migrations/20261413300000_book_relationship_confirmed_occupancy.sql",
);

describe("required vendor network flags", () => {
  it("Vendor relationship can be marked required and in-house; both can coexist", () => {
    assert.match(vendorForm, /isRequired/);
    assert.match(vendorForm, /isInHouse/);
    assert.match(vendorForm, /Required/);
    assert.match(vendorForm, /In-house/);
    assert.match(vendorList, /vendor\.isRequired/);
    assert.match(vendorList, /vendor\.isInHouse/);
    const repo = read("lib/vendors/repository.ts");
    assert.match(repo, /is_required: input\.isRequired === true/);
    assert.match(repo, /is_in_house: input\.isInHouse === true/);
  });
});

describe("required vendors are not Setup Profile requiredVendorIds", () => {
  it("book_relationship assigns from venue_vendor_relationships.is_required only", () => {
    assert.match(bookFn, /venue_vendor_relationships/);
    assert.match(bookFn, /is_required = true/);
    assert.match(bookFn, /status = 'active'/);
    assert.match(bookFn, /Required by venue/);
    // Comment may mention requiredVendorIds; executable SQL must not read template_refs.
    assert.doesNotMatch(bookFn, /template_refs/);
    assert.doesNotMatch(bookFn, /from public\.venue_setup_profiles/);
  });

  it("Setup Profile no longer presents the dead team-expects-to-book list", () => {
    assert.doesNotMatch(setupSection, /Vendors your team expects to book/);
    assert.match(setupSection, /Recommended vendors for the client/);
    assert.match(setupSection, /Required vendors are managed in your Vendor Network/);
    // Vendors step must not offer a checkbox list that writes requiredVendorIds.
    const vendorsStep = setupSection.slice(setupSection.indexOf('step === "vendors"'));
    assert.doesNotMatch(vendorsStep, /patchRefs\(\{ requiredVendorIds/);
    assert.match(vendorsStep, /recommendedVendorIds/);
  });

  it("recommended inheritance remains on recommendedVendorIds only", () => {
    assert.match(inherit, /applyInheritedVendorRecommendations/);
    assert.match(inherit, /recommendedVendorIds/);
    assert.doesNotMatch(inherit, /requiredVendorIds/);
    assert.doesNotMatch(inherit, /is_required/);
  });
});

describe("booking assigns required vendors transactionally", () => {
  it("assignment is inside book_relationship before return, gated on v_newly", () => {
    assert.match(bookFn, /if v_newly then[\s\S]*insert into public\.event_vendor_assignments/);
    assert.match(bookFn, /not exists \(\s*select 1 from public\.event_vendor_assignments x/);
    const returnIdx = bookFn.lastIndexOf("return jsonb_build_object");
    const insertIdx = bookFn.indexOf("insert into public.event_vendor_assignments");
    assert.ok(insertIdx > 0 && insertIdx < returnIdx);
  });

  it("inactive required vendors are not newly assigned", () => {
    assert.match(bookFn, /and vvr\.status = 'active'/);
  });

  it("required vendors do not block Booked or change occupancy validation", () => {
    assert.match(bookClient, /rpc\("book_relationship"/);
    assert.doesNotMatch(bookClient, /is_required|requiredVendor/);
    // Occupancy still confirmed in the prior book_relationship body.
    assert.match(occupancySql, /p_confirmed_occupancy/);
    assert.match(bookFn, /p_confirmed_occupancy/);
  });

  it("multiple required vendors insert as a set select", () => {
    assert.match(
      bookFn,
      /insert into public\.event_vendor_assignments[\s\S]*from public\.venue_vendor_relationships vvr/,
    );
  });
});

describe("client portal distinguishes required from recommended", () => {
  it("Required for Your Event section; no optional pick for required", () => {
    assert.match(portal, /Required for Your Event/);
    assert.match(portal, /portal-required-vendors/);
    assert.match(portal, /Required for your event/);
    assert.match(portal, /if \(rec\.isRequired\)/);
    assert.match(portal, /!viewingRec\.isRequired/);
    assert.match(portal, /filter\(\(r\) => !r\.isRequired\)/);
    assert.match(portal, /Recommended for You/);
  });

  it("In-house chip remains available via ProcessChips", () => {
    assert.match(portal, /rec\.isInHouse/);
    assert.match(portal, /In-house/);
  });
});

describe("staff event workspace and categories", () => {
  it("event assignments surface Required and In-house from network meta", () => {
    assert.match(eventVendors, /isRequired/);
    assert.match(eventVendors, /isInHouse/);
    assert.match(eventVendors, /Required/);
    assert.match(eventVendors, /In-house/);
  });

  it("required categories remain informational and separate", () => {
    assert.match(categories, /venue_required_vendor_categories/);
    assert.match(categoriesPanel, /Required categories/);
    assert.match(categoriesPanel, /not one named business/);
    assert.doesNotMatch(categories, /event_vendor_assignments/);
    assert.doesNotMatch(bookFn, /venue_required_vendor_categories/);
  });
});
