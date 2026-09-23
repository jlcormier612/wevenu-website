import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Customer-action notification prefs — wiring + idempotency contract.
 * Source of truth: 20261407100000_customer_action_notification_preferences.sql
 */
const MIGRATION = resolve(
  "supabase/migrations/20261407100000_customer_action_notification_preferences.sql",
);
const UI = resolve("components/settings/notification-preferences-section.tsx");
const PREFS = resolve("lib/notifications/preferences.ts");
const API = resolve("app/api/notifications/preferences/route.ts");
const CONFIRM = resolve("supabase/migrations/20261313000000_tour_confirmation.sql");
const TOUR_SERVICE = resolve("lib/tours/service.ts");

describe("customer-action notification preferences", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const ui = readFileSync(UI, "utf8");
  const prefs = readFileSync(PREFS, "utf8");
  const api = readFileSync(API, "utf8");
  const confirm = readFileSync(CONFIRM, "utf8");
  const tourService = readFileSync(TOUR_SERVICE, "utf8");

  it("adds three preference columns defaulting ON", () => {
    assert.match(sql, /pref_tour_scheduled\s+boolean not null default true/);
    assert.match(sql, /pref_tour_confirmed\s+boolean not null default true/);
    assert.match(sql, /pref_proposal_accepted\s+boolean not null default true/);
  });

  it("exposes the three rows in Leads & clients UI with locked copy", () => {
    assert.match(ui, /key:\s+"prefTourScheduled"/);
    assert.match(ui, /label:\s+"Tour scheduled"/);
    assert.match(ui, /A new tour is scheduled with a client or lead\./);
    assert.match(ui, /key:\s+"prefTourConfirmed"/);
    assert.match(ui, /label:\s+"Tour confirmed"/);
    assert.match(ui, /A client or lead confirms their scheduled tour\./);
    assert.match(ui, /key:\s+"prefProposalAccepted"/);
    assert.match(ui, /label:\s+"Proposal accepted"/);
    assert.match(ui, /A client accepts a proposal\./);
  });

  it("persists through preferences defaults + API POST params", () => {
    assert.match(prefs, /prefTourScheduled:\s+true/);
    assert.match(prefs, /prefTourConfirmed:\s+true/);
    assert.match(prefs, /prefProposalAccepted:\s+true/);
    assert.match(api, /p_pref_tour_scheduled/);
    assert.match(api, /p_pref_tour_confirmed/);
    assert.match(api, /p_pref_proposal_accepted/);
  });

  it("tour_scheduled fires only on INSERT of a scheduled appointment", () => {
    assert.match(sql, /after insert on public\.tour_appointments/);
    assert.match(sql, /'tour_scheduled'/);
    assert.match(sql, /New tour scheduled —/);
    assert.doesNotMatch(
      sql.slice(sql.indexOf("_trigger_tour_scheduled_notification")),
      /confirmation_requested/,
    );
  });

  it("tour_confirmed fires on status transition to confirmed, not on request send", () => {
    assert.match(sql, /notify_tour_confirmed/);
    assert.match(sql, /after update of status on public\.tour_appointments/);
    assert.match(sql, /OLD\.status = 'confirmed' or NEW\.status <> 'confirmed'/);
    assert.match(sql, /Tour confirmed —/);
    // Sending confirmation request never changes status.
    assert.match(tourService, /never changes status/);
    assert.match(confirm, /confirmation_requested_at/);
    assert.doesNotMatch(
      confirm.slice(confirm.indexOf("create or replace function public.confirm_tour_by_token")),
      /create_venue_notification/,
    );
  });

  it("confirm_tour_by_token is idempotent (alreadyConfirmed before second write)", () => {
    const fn = confirm.slice(confirm.indexOf("create or replace function public.confirm_tour_by_token"));
    assert.match(fn, /alreadyConfirmed', true/);
    const earlyReturn = fn.indexOf("alreadyConfirmed', true");
    const statusUpdate = fn.indexOf("set status = 'confirmed'");
    assert.ok(earlyReturn > 0 && statusUpdate > earlyReturn, "already-confirmed return must precede the status update");
  });

  it("proposal_accepted subjects use locked wording and keep early-return idempotency", () => {
    assert.match(sql, /Proposal accepted —/);
    assert.match(sql, /alreadyAccepted', true/);
    assert.match(sql, /alreadyApproved', true/);
    // Notification only after the accept/approve transition body.
    const accept = sql.slice(sql.indexOf("create or replace function public.accept_commercial_selection"));
    assert.ok(
      accept.indexOf("alreadyAccepted', true") < accept.indexOf("create_venue_notification"),
      "already-accepted must return before notification",
    );
  });

  it("does not invent a second notification framework", () => {
    assert.match(sql, /create_venue_notification/);
    assert.doesNotMatch(sql, /create table.*notification/i);
  });
});
