/**
 * Lead → Tour identity consistency.
 *
 * Tours attached to a Lead must display the live Lead identity
 * (leadDisplayName), and Lead edits must sync tour_appointments.contact_name
 * so reminders / confirmation copy / Luv do not keep the creation-time name.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { leadDisplayName } from "@/lib/leads/constants";
import {
  resolveTourContactDisplayName,
  tourContactNameFromLeadIdentity,
} from "@/lib/tours/contact-display";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function updateLeadInfoBody(): string {
  const repo = source("lib/leads/repository.ts");
  const start = repo.indexOf("export async function updateLeadInfo");
  const end = repo.indexOf("export async function setPlannedEventSpace", start + 1);
  assert.ok(start >= 0 && end > start, "updateLeadInfo slice");
  return repo.slice(start, end);
}

describe("tour contact display — live Lead identity", () => {
  it("prefers live Lead identity over a stale contact_name snapshot", () => {
    const display = resolveTourContactDisplayName({
      contactName: "j r",
      lead: {
        first_name: "Joy",
        last_name: "Bannister",
        partner_first_name: "Brian",
        partner_last_name: "Robicheaux",
      },
    });
    assert.equal(display, "Joy Bannister & Brian Robicheaux");
    assert.equal(
      display,
      leadDisplayName("Joy", "Bannister", "Brian", "Robicheaux"),
    );
  });

  it("includes partner last name in the canonical display", () => {
    const display = resolveTourContactDisplayName({
      contactName: "Joy Bannister",
      lead: {
        first_name: "Joy",
        last_name: "Bannister",
        partner_first_name: "Brian",
        partner_last_name: "Robicheaux",
      },
    });
    assert.equal(display, "Joy Bannister & Brian Robicheaux");
    assert.doesNotMatch(display!, /^Joy Bannister & Brian$/);
  });

  it("renames without a partner use the new primary name", () => {
    assert.equal(
      resolveTourContactDisplayName({
        contactName: "j r",
        lead: { first_name: "Joy", last_name: "Bannister" },
      }),
      "Joy Bannister",
    );
  });

  it("falls back to contact_name when no usable Lead is attached", () => {
    assert.equal(
      resolveTourContactDisplayName({ contactName: "Walk-in Guest", lead: null }),
      "Walk-in Guest",
    );
    assert.equal(
      resolveTourContactDisplayName({
        contactName: "Walk-in Guest",
        lead: { first_name: "", last_name: "", partner_first_name: null },
      }),
      "Walk-in Guest",
    );
  });

  it("snapshot writer uses the same canonical leadDisplayName", () => {
    assert.equal(
      tourContactNameFromLeadIdentity({
        firstName: "Joy",
        lastName: "Bannister",
        partnerFirstName: "Brian",
        partnerLastName: "Robicheaux",
      }),
      "Joy Bannister & Brian Robicheaux",
    );
    assert.equal(
      tourContactNameFromLeadIdentity({ firstName: "Joy", lastName: "Bannister" }),
      "Joy Bannister",
    );
  });
});

describe("tour contact display — service seams", () => {
  const toursService = source("lib/tours/service.ts");

  it("enrichAppointmentContact prefers live Lead over stored contact_name", () => {
    const start = toursService.indexOf("function enrichAppointmentContact");
    const end = toursService.indexOf("export async function getTourAppointments", start + 1);
    const fn = toursService.slice(start, end);
    assert.match(fn, /resolveTourContactDisplayName/);
    assert.doesNotMatch(fn, /if \(!appt\.contactName && r\.leads\)/);
  });

  it("Tours list and lead-panel queries join partner_last_name", () => {
    assert.match(
      toursService,
      /leads\(first_name,last_name,partner_first_name,partner_last_name\)/,
    );
    const leadPanel = toursService.slice(
      toursService.indexOf("export async function getTourAppointmentsForLead"),
      toursService.indexOf("export type TourArchiveActionResult"),
    );
    assert.match(leadPanel, /TOUR_LIST_SELECT|partner_last_name/);
    assert.match(leadPanel, /enrichAppointmentContact/);
    assert.doesNotMatch(leadPanel, /\.select\("\*"\)/);
  });

  it("calendar tour titles use resolveTourContactDisplayName with partner last", () => {
    assert.match(
      toursService,
      /leads\(first_name, last_name, partner_first_name, partner_last_name\)/,
    );
    assert.match(toursService, /resolveTourContactDisplayName\(\{ contactName: t\.contact_name, lead \}\)/);
    assert.doesNotMatch(
      toursService,
      /partner_first_name \? ` & \$\{lead\.partner_first_name\}`/,
    );
  });
});

describe("Lead identity edit → tour_appointments.contact_name sync", () => {
  it("updateLeadInfo syncs contact_name for that lead only, scoped by venue", () => {
    const fn = updateLeadInfoBody();
    assert.match(fn, /tourContactNameFromLeadIdentity/);
    assert.match(fn, /\.from\("tour_appointments"\)/);
    assert.match(fn, /\.update\(\{\s*contact_name:\s*tourContactName\s*\}/);
    assert.match(fn, /\.eq\("lead_id", leadId\)/);
    assert.match(fn, /\.eq\("venue_id", venueId\)/);
  });

  it("does not create, delete, or reschedule tours on identity edit", () => {
    const fn = updateLeadInfoBody();
    assert.doesNotMatch(fn, /\.from\("tour_appointments"\)[\s\S]*\.insert\(/);
    assert.doesNotMatch(fn, /\.from\("tour_appointments"\)[\s\S]*\.delete\(/);
    assert.doesNotMatch(fn, /scheduled_at/);
    assert.doesNotMatch(fn, /book_tour_for_lead/);
    assert.doesNotMatch(fn, /reschedule_tour/);
    assert.doesNotMatch(fn, /task_reminders/);
    assert.doesNotMatch(fn, /sendEmail/);
  });

  it("keeps existing client and relationship identity sync alongside tours", () => {
    const fn = updateLeadInfoBody();
    assert.match(fn, /linkedClientIdentityPatch/);
    assert.match(fn, /relationshipContactPatch/);
    assert.match(fn, /tourContactNameFromLeadIdentity/);
  });

  it("does not introduce a manual Tour name editor", () => {
    const tourList = source("components/tours/tour-list.tsx");
    assert.doesNotMatch(tourList, /Edit Tour Name|editTourName|contactName.*onChange/i);
  });
});
