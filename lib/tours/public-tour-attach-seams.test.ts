import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("public tour attach seams", () => {
  it("staff scheduling still uses book_tour_for_lead", () => {
    const service = read("lib/tours/service.ts");
    const staff = service.slice(service.indexOf("export async function scheduleTourForLead"));
    assert.match(staff, /book_tour_for_lead/);
    assert.doesNotMatch(staff.slice(0, staff.indexOf("export async function rescheduleTour")), /book_public_tour_for_lead/);
  });

  it("valid originating context books onto the existing Lead without ingest_lead", () => {
    const service = read("lib/tours/service.ts");
    assert.match(service, /book_public_tour_for_lead/);
    assert.match(service, /attachedExistingLead: true/);
    const attachFn = service.slice(service.indexOf("async function bookPublicTourOntoExistingLead"));
    assert.doesNotMatch(attachFn.slice(0, attachFn.indexOf("export async function bookTour")), /ingestLead|ingest_lead/);
    const bookTour = service.slice(service.indexOf("export async function bookTour"));
    assert.match(bookTour, /attach\.action === "attach"/);
    assert.match(service, /advanceAttachedLeadToTourScheduled/);
  });

  it("invalid originating context is rejected before create", () => {
    const service = read("lib/tours/service.ts");
    assert.match(service, /attach\.action === "reject"/);
    const rpc = read("supabase/migrations/20261412400000_book_public_tour_for_lead.sql");
    assert.match(rpc, /p_embed_key/);
    assert.match(rpc, /and venue_id = v_venue\.id/);
    assert.match(rpc, /lead_not_open/);
    assert.match(rpc, /grant execute on function public\.book_public_tour_for_lead/);
    assert.match(rpc, /to service_role/);
    assert.match(rpc, /revoke all on function public\.book_public_tour_for_lead/);
  });

  it("origin token is opaque HMAC query o, not an unsigned leadId", () => {
    const origin = read("lib/tours/origin-context.ts");
    assert.match(origin, /createHmac\("sha256"/);
    assert.match(origin, /timingSafeEqual/);
    const link = read("lib/tours/public-link.ts");
    assert.match(link, /publicTourSchedulingPathForLead/);
    assert.match(link, /\?o=/);
    const book = read("app/book/[key]/page.tsx");
    assert.match(book, /tourOriginToken/);
    const form = read("components/form/inquiry-form.tsx");
    assert.match(form, /originToken/);
    const route = read("app/api/tours/book/route.ts");
    assert.match(route, /originToken/);
    const panel = read("components/leads/tour-panel.tsx");
    assert.match(panel, /Copy scheduling link/);
    assert.match(panel, /getLeadPublicTourSchedulingUrlAction/);
  });

  it("does not revive find_lead_by_email or globally change ingest_lead", () => {
    const attach = read("lib/tours/public-tour-attach.ts");
    assert.doesNotMatch(attach, /find_lead_by_email/);
    const inquire = read("app/api/public/inquire/route.ts");
    assert.match(inquire, /create_public_lead/);
    const pipeline = read("lib/lead-intake/pipeline.ts");
    assert.match(pipeline, /lead_created/);
    const attachBook = read("lib/tours/service.ts");
    const onto = attachBook.slice(
      attachBook.indexOf("async function bookPublicTourOntoExistingLead"),
      attachBook.indexOf("export async function bookTour"),
    );
    assert.doesNotMatch(onto, /lead_created/);
    const sides = read("lib/tours/booked-side-effects.ts");
    assert.match(sides, /attachedExistingLead/);
    assert.match(sides, /A new lead has been created in Hello to Cheers/);
  });

  it("calendar/settings/QR/setup public widgets stay venue-wide without originating context", () => {
    const settings = read("components/settings/tour-settings-section.tsx");
    const calendar = read("app/(app)/calendar/page.tsx");
    const qr = read("app/qr/[code]/route.ts");
    const setup = read("components/setup-hub/lead-capture-stage.tsx");
    assert.match(settings, /publicTourSchedulingPath\(s\.tourEmbedKey\)/);
    assert.doesNotMatch(settings, /publicTourSchedulingPathForLead/);
    assert.match(calendar, /publicTourSchedulingPath\(tourSettings\.tourEmbedKey\)/);
    assert.match(qr, /publicTourSchedulingPath/);
    assert.match(setup, /publicTourSchedulingPath\(tourSettings\.tourEmbedKey\)/);
  });
});
