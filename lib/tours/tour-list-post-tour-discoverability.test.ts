/**
 * Tours list: post-tour notes/details remain discoverable.
 * Confirmation must stay distinct from completion; notes must not require a
 * dedicated /tours/[id] route or a whole-row click.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const list = readFileSync(resolve("components/tours/tour-list.tsx"), "utf8");
const css = readFileSync(resolve("app/globals.css"), "utf8");
const page = readFileSync(resolve("app/(app)/tours/page.tsx"), "utf8");

describe("Tours list post-tour discoverability", () => {
  it("keeps an obvious details/notes control that expands inline", () => {
    assert.match(list, /data-tours-details-toggle=""/);
    assert.match(list, /data-tours-details=""/);
    assert.match(list, /aria-expanded=\{detailsOpen\}/);
    assert.match(list, /Tour notes/);
    assert.match(list, /Record what happened/);
    assert.doesNotMatch(page, /\/tours\/\[/);
    assert.doesNotMatch(list, /href=\{`\/tours\/\$\{/);
    assert.doesNotMatch(list, /htc-tours-row"[^>]*onClick=/);
  });

  it("does not put contact email on the collapsed card secondary line", () => {
    const identity = list.slice(
      list.indexOf("htc-tours-row-content"),
      list.indexOf("htc-tours-row-actions"),
    );
    assert.doesNotMatch(identity, /data-tours-email/);
    assert.match(identity, /data-tours-meta/);
    const details = list.slice(list.indexOf("data-tours-details="));
    assert.match(details, /data-tours-email/);
    assert.match(details, /appt\.contactEmail/);
  });

  it("saves and redisplays notes without requiring completed-only tiny links", () => {
    assert.match(list, /data-tours-notes-form=""/);
    assert.match(list, /data-tours-notes-input=""/);
    assert.match(list, /data-tours-saved-notes/);
    assert.match(list, /setSavedNotes\(notes\)/);
    assert.match(list, /router\.refresh\(\)/);
    assert.match(list, /\/api\/tours\/outcome/);
  });

  it("opens notes after completed or no-show, not after confirmed", () => {
    const patch = list.slice(
      list.indexOf("async function patchStatus"),
      list.indexOf("async function handleStatus"),
    );
    assert.match(
      patch,
      /if \(newStatus === "completed" \|\| newStatus === "no_show"\) \{\s*setDetailsOpen\(true\);\s*setShowOutcomeForm\(true\);/,
    );
    assert.match(patch, /Tour marked confirmed/);
    assert.doesNotMatch(
      patch,
      /if \(newStatus === "confirmed"\) \{\s*setDetailsOpen\(true\)/,
    );
  });

  it("does not send outcome when saving notes on a non-post-tour appointment", () => {
    const save = list.slice(
      list.indexOf("async function handleSaveOutcome"),
      list.indexOf("async function handleMarkFollowUp"),
    );
    assert.match(save, /\.\.\.\(isPostTour \? \{ outcome: outcome \|\| null \} : \{\}\)/);
  });

  it("keeps confirmation actions distinct from status and details", () => {
    assert.match(list, /htc-tours-confirm-actions/);
    assert.match(list, /Mark as Confirmed/);
    assert.match(list, /Send Confirmation Request/);
    assert.match(list, /Confirmed is never a free-pick option/);
    assert.match(list, /htc-tours-status-select/);
    assert.match(list, /htc-tours-lead-link/);
    assert.match(list, /className="htc-record-link"/);
    assert.match(list, /href=\{`\/leads\/\$\{appt\.leadId\}`\}/);
    assert.doesNotMatch(list, /htc-tours-row"[^>]*onClick=/);
  });

  it("styles details toggle without using Calendar tour blue", () => {
    assert.match(css, /\.htc-tours-details-toggle/);
    assert.match(css, /\[data-tours-saved-notes\]/);
  });
});
