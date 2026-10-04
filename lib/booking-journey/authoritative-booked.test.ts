/**
 * Authoritative Booked membership — static contract.
 * Booked is only book_relationship / bookClient. Current/Past/Cancelled
 * are views. events.booked_at is historical evidence, not membership.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  classifyBookedMembership,
  isCurrentBookedMembership,
  isPastBookedMembership,
} from "@/lib/booking-journey/booked-membership";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const LATEST = "supabase/migrations/20261412100000_authoritative_booked_membership.sql";
const latest = read(LATEST);
const bookFn = latest.slice(
  latest.indexOf("create or replace function public.book_relationship"),
  latest.indexOf("$$;", latest.indexOf("create or replace function public.book_relationship")),
);
const TODAY = "2026-10-04";

describe("authoritative Booked membership helper", () => {
  it("current requires sales_stage booked, not cancelled, and today-or-later or missing date", () => {
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2027-05-01",
    }, TODAY), "current");
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: null,
    }, TODAY), "current");
    assert.equal(isCurrentBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: TODAY,
    }, TODAY), true);
  });

  it("past is still sales_stage booked with an earlier event date", () => {
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2026-09-01",
    }, TODAY), "past");
    assert.equal(isPastBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2026-09-01",
    }, TODAY), true);
  });

  it("won, booked_at-only, cancelled client/event, and archived are not Booked", () => {
    assert.equal(classifyBookedMembership({
      salesStage: "won",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2027-05-01",
    }, TODAY), null);
    assert.equal(classifyBookedMembership({
      salesStage: "new_inquiry",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2027-05-01",
    }, TODAY), null);
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "cancelled",
      eventStatus: "confirmed",
      eventDate: "2027-05-01",
    }, TODAY), null);
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "cancelled",
      eventDate: "2027-05-01",
    }, TODAY), null);
    assert.equal(classifyBookedMembership({
      salesStage: "booked",
      clientStatus: "confirmed",
      eventStatus: "confirmed",
      eventDate: "2027-05-01",
      archived: true,
    }, TODAY), null);
  });
});

describe("canonical writer and Booked shortcut removal", () => {
  it("Manual Mark as Booked uses bookClient", () => {
    const service = read("lib/leads/service.ts");
    const confirm = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));
    assert.match(confirm, /bookClient/);
    assert.match(confirm, /source: "manual"/);
    const actions = read("app/(app)/leads/[id]/actions.ts");
    assert.match(actions, /confirmPipelineBookedMove/);
  });

  it("advanceLeadSalesStageIfForward cannot enter Booked", () => {
    const service = read("lib/leads/service.ts");
    const fn = service.slice(
      service.indexOf("export async function advanceLeadSalesStageIfForward"),
      service.indexOf("export async function updateLeadPipelineStage"),
    );
    assert.match(fn, /Exclude<SalesStage, "booked">/);
    assert.match(fn, /Booked requires the canonical booking operation/);
    assert.doesNotMatch(fn, /allowBooked/);
    assert.doesNotMatch(fn, /updateLeadSalesStage\(leadId, target, \{ allowBooked/);
  });

  it("updateLeadSalesStage cannot write booked", () => {
    const service = read("lib/leads/service.ts");
    const fn = service.slice(
      service.indexOf("export async function updateLeadSalesStage"),
      service.indexOf("export async function updateLeadStatus"),
    );
    assert.match(fn, /stage === "booked"/);
    assert.match(fn, /Move to Booked requires confirmation/);
    assert.doesNotMatch(fn, /allowBooked/);
    assert.doesNotMatch(fn, /recordLifecycleBooking/);
  });

  it("book_relationship authorizes booked and creates a lead-less pipeline row", () => {
    assert.match(bookFn, /set_config\('htc.authorize_booked_stage', 'on', true\)/);
    assert.match(bookFn, /find_or_create_relationship/);
    assert.match(bookFn, /if v_lead_id is null then/);
    assert.match(bookFn, /insert into public\.leads/);
    assert.match(bookFn, /set lead_id = v_lead_id/);
    assert.match(latest, /leads_booked_stage_guard/);
    assert.match(latest, /sales_stage booked can only be written by book_relationship/);
  });

  it("cancellation updates event, client, and lead in one RPC", () => {
    const events = read("lib/events/service.ts");
    assert.match(events, /cancel_booked_event_relationship/);
    assert.match(latest, /create or replace function public.cancel_booked_event_relationship/);
    assert.match(latest, /set status = 'cancelled'/);
    assert.match(latest, /sales_stage = 'cancelled'/);
    assert.match(latest, /pipeline_stage_id = null/);
    assert.doesNotMatch(events, /leaveActiveBookedPipeline/);
    assert.doesNotMatch(latest, /booked_at = null/);
  });
});

describe("shared membership surfaces", () => {
  it("Leads Booked chip uses current membership and links to Clients All Bookings", () => {
    const page = read("app/(app)/leads/page.tsx");
    const list = read("components/leads/lead-list.tsx");
    assert.match(page, /loadBookedMembershipSets/);
    assert.match(page, /currentBookedCount=\{bookedMembership.currentClientIds.size\}/);
    assert.match(list, /currentBookedCount/);
    assert.match(list, /href="\/clients\?filter=all"/);
    assert.doesNotMatch(list, /stage === "booked" \|\| stage === "won"/);
    assert.doesNotMatch(list, /leads\.filter\(isBookedLead\)/);
  });

  it("Clients All Bookings uses the authoritative helper, not events.booked_at", () => {
    const page = read("app/(app)/clients/page.tsx");
    const canon = read("lib/booking-journey/canonical-booked.ts");
    const helper = read("lib/booking-journey/booked-membership.ts");
    assert.match(page, /getCanonicallyBookedClientIds/);
    assert.match(canon, /getAuthoritativeBookedClientIds/);
    assert.doesNotMatch(canon, /\.not\("booked_at"/);
    assert.match(helper, /sales_stage", "booked"/);
    assert.doesNotMatch(helper, /\.not\("booked_at"/);
  });

  it("Dashboard and portal current-booking consumers use the shared helper", () => {
    const dash = read("lib/dashboard/business-snapshot.ts");
    const portal = read("lib/activation/portal-open-milestone-service.ts");
    const invite = read("lib/activation/first-portal-invite-service.ts");
    assert.match(dash, /getCurrentBookedClientIds/);
    assert.doesNotMatch(dash, /getCanonicallyBookedClientIds/);
    assert.match(portal, /loadBookedMembershipSets/);
    assert.match(invite, /loadBookedMembershipSets/);
    assert.doesNotMatch(portal, /booked_at/);
    assert.doesNotMatch(invite, /booked_at/);
  });
});

describe("no direct Booked writers outside the canonical path", () => {
  it("application services do not write sales_stage booked except book_relationship", () => {
    const forbidden = /sales_stage:\s*["']booked["']/;
    const files = [
      "lib/leads/service.ts",
      "lib/leads/repository.ts",
      "lib/clients/service.ts",
      "lib/events/service.ts",
      "lib/events/repository.ts",
      "lib/booking-journey/book-client.ts",
      "lib/contracts/service.ts",
      "lib/payments/service.ts",
      "lib/commercial-selections/service.ts",
    ];
    for (const file of files) {
      assert.doesNotMatch(read(file), forbidden, file);
    }
    assert.match(read("lib/booking-journey/book-client.ts"), /rpc\("book_relationship"/);
  });

  it("no seed or _tmp script writes sales_stage booked directly", () => {
    const pattern = /sales_stage:\s*["']booked["']/;
    const scripts = readdirSync(resolve(root, "scripts")).filter((name) =>
      name.startsWith("_tmp-") && /\.(mts|mjs|ts|js)$/.test(name),
    );
    for (const name of scripts) {
      const src = read(`scripts/${name}`);
      assert.doesNotMatch(src, pattern, name);
    }
    const seedRoots = ["supabase/seed.sql", "supabase/seeds"];
    for (const rel of seedRoots) {
      const path = resolve(root, rel);
      try {
        const stat = readFileSync(path, "utf8");
        assert.doesNotMatch(stat, /sales_stage\s*=\s*'booked'/, rel);
      } catch {
        // optional path
      }
    }
  });
});

describe("native checkbox/radio token styling", () => {
  it("globals.css uses --primary and --ring for native controls", () => {
    const css = read("app/globals.css");
    assert.match(css, /input\[type="checkbox"\]/);
    assert.match(css, /input\[type="radio"\]/);
    assert.match(css, /accent-color:\s*var\(--primary\)/);
    assert.match(css, /outline:\s*2px solid var\(--ring\)/);
    assert.doesNotMatch(css, /accent-color:\s*#/);
  });

  it("does not alter the shared Checkbox component", () => {
    const box = read("components/ui/checkbox.tsx");
    assert.match(box, /data-\[checked\]:bg-primary/);
    assert.doesNotMatch(box, /accent-color/);
  });
});
