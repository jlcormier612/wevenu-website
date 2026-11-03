/**
 * Phase 11D — formal color-distribution surface roles + relationship pilot seams.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Phase 11D — color distribution rules document", () => {
  const rules = read("docs/design/HTC-COLOR-DISTRIBUTION-RULES.md");

  it("defines palette and Rules A–G", () => {
    assert.match(rules, /# HTC Color Distribution Rules/);
    assert.match(rules, /Rule A — White is the default working surface/);
    assert.match(rules, /Rule B — Linen is the operational surface/);
    assert.match(rules, /Rule C — Eucalyptus is selective/);
    assert.match(rules, /Rule D — Calm blue is for genuinely informational content/);
    assert.match(rules, /Rule E — Botanical green is an accent/);
    assert.match(rules, /Rule F — Blush remains intentional/);
    assert.match(rules, /Rule G — Preserve semantic meaning/);
    assert.match(rules, /#F8F7F3/);
    assert.match(rules, /#F3F0E9/);
    assert.match(rules, /#DCE8E0/);
    assert.match(rules, /#EAF1F7/);
  });
});

describe("Phase 11D — shared surface utilities", () => {
  const css = read("app/globals.css");

  it("defines working / operational / summary / guidance utilities on staff scope", () => {
    assert.match(css, /\.htc-staff \.htc-surface-working/);
    assert.match(
      css,
      /\.htc-staff \.htc-surface-operational \{[\s\S]*?background:\s*var\(--htc-linen\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-surface-summary[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-surface-guidance \{[\s\S]*?background:\s*var\(--htc-calm-blue\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-surface-guidance-compact \{[\s\S]*?background:\s*var\(--htc-calm-blue\)/,
    );
  });

  it("wires lead personal-link guidance to calm-blue tokens", () => {
    assert.match(
      css,
      /\.htc-staff \.htc-lead-tour-personal-link \{[\s\S]*?background:\s*var\(--htc-calm-blue\)/,
    );
    assert.doesNotMatch(
      css.slice(css.indexOf(".htc-staff .htc-lead-tour-personal-link {")),
      /background:\s*#eaf1f7/i,
    );
  });
});

describe("Phase 11D — relationship workspace pilot wiring", () => {
  const leadDetail = read("components/leads/lead-detail.tsx");
  const spacePrefs = read("components/leads/space-preference-fields.tsx");
  const eventDetail = read("components/events/event-detail.tsx");

  it("Lead Sales & availability and Space preferences use linen operational surfaces", () => {
    assert.match(leadDetail, /data-testid="lead-sales-availability"/);
    assert.match(leadDetail, /htc-surface-operational/);
    assert.doesNotMatch(
      leadDetail.slice(
        leadDetail.indexOf('data-testid="lead-sales-availability"'),
        leadDetail.indexOf('data-testid="lead-sales-availability"') + 220,
      ),
      /bg-muted\/20/,
    );
    assert.match(spacePrefs, /htc-surface-operational/);
    assert.match(spacePrefs, /data-testid="lead-space-preferences"/);
  });

  it("Lead Contact remains a white Card workspace", () => {
    assert.match(leadDetail, /data-testid="lead-contact-card"/);
    assert.match(leadDetail, /<Card className="h-full" data-testid="lead-contact-card">/);
  });

  it("Booking summary is eucalyptus; Team assignment is linen; Questionnaires keep white + calm guidance", () => {
    assert.match(eventDetail, /data-testid="event-booking-summary"/);
    assert.match(eventDetail, /htc-surface-summary/);
    assert.doesNotMatch(
      eventDetail.slice(
        eventDetail.indexOf("function EventHeroCard"),
        eventDetail.indexOf("data-testid=\"event-booking-summary\"") + 180,
      ),
      /bg-primary\/5/,
    );
    assert.match(eventDetail, /data-testid="event-staff-assignment"/);
    assert.match(
      eventDetail.slice(
        eventDetail.indexOf('data-testid="event-staff-assignment"') - 120,
        eventDetail.indexOf('data-testid="event-staff-assignment"') + 80,
      ),
      /htc-surface-operational/,
    );
    assert.match(eventDetail, /data-testid="event-questionnaires-card"/);
    assert.match(eventDetail, /htc-surface-guidance-compact/);
    assert.match(eventDetail, /data-testid="event-questionnaires-guidance"/);
    assert.match(eventDetail, /data-testid="event-inventory-event-order-card"/);
  });

  it("Booking summary height follows content — not stretched to the right column", () => {
    const region = eventDetail.slice(
      eventDetail.indexOf('data-testid="client-booking-staff-region"'),
      eventDetail.indexOf('data-testid="client-staffing-column"') + 80,
    );
    assert.match(region, /items-start/);
    assert.doesNotMatch(region, /items-stretch/);
    const hero = eventDetail.slice(
      eventDetail.indexOf("function EventHeroCard"),
      eventDetail.indexOf('data-testid="event-booking-summary"') + 220,
    );
    assert.match(hero, /self-start/);
    assert.doesNotMatch(hero, /\bh-full\b/);
    assert.doesNotMatch(hero, /lg:h-full/);
  });

  it("Lead Space Preferences uses linen operational surface in editable and read-only paths", () => {
    assert.match(spacePrefs, /if \(readOnly\)/);
    const readOnlyBlock = spacePrefs.slice(
      spacePrefs.indexOf("if (readOnly)"),
      spacePrefs.indexOf("if (relevant.length === 0)"),
    );
    assert.match(readOnlyBlock, /htc-surface-operational/);
    assert.match(readOnlyBlock, /data-testid="lead-space-preferences"/);
    assert.match(spacePrefs, /htc-surface-operational w-full min-w-0 px-3 py-2\.5/);
  });
});
