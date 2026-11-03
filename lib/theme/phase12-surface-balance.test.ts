/**
 * Phase 12 — surface layering / hospitality color balance regressions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Phase 12 — color distribution rules layering", () => {
  const rules = read("docs/design/HTC-COLOR-DISTRIBUTION-RULES.md");

  it("documents Rule H surface layering and Rule I Active indicators", () => {
    assert.match(rules, /Rule H — Surface layering/);
    assert.match(rules, /When a parent surface is tinted, nested content should usually be white/);
    assert.match(rules, /Linen is supporting, not dominant/);
    assert.match(rules, /Eucalyptus is the signature, not the wallpaper/);
    assert.match(rules, /Rule I — Active indicators/);
    assert.match(rules, /\.htc-group-shell/);
    assert.match(rules, /\.htc-badge-active/);
  });
});

describe("Phase 12 — shared utilities", () => {
  const css = read("app/globals.css");

  it("defines linen group shell with white nested cards", () => {
    assert.match(css, /\.htc-staff \.htc-group-shell \{[\s\S]*?background:\s*var\(--htc-linen\)/);
    assert.match(
      css,
      /\.htc-staff \.htc-group-shell \[data-slot="card"\][\s\S]*?background:\s*#ffffff/,
    );
  });

  it("defines restrained eucalyptus Active badge", () => {
    assert.match(
      css,
      /\.htc-staff \.htc-badge-active[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(css, /\.htc-staff \.htc-badge-active[\s\S]*?color:\s*var\(--heading\)/);
  });

  it("keeps AutomationsHelp calm-blue instructional treatment", () => {
    assert.match(
      css,
      /\.htc-staff section\.htc-automations-help \{[\s\S]*?background-color:\s*var\(--htc-calm-blue\)/,
    );
  });
});

describe("Phase 12 — Automations", () => {
  const page = read("app/(app)/communication/series/page.tsx");
  const list = read("components/communication/series-list.tsx");
  const help = read("components/communication/automations-help.tsx");
  const form = read("components/communication/series-form.tsx");
  const view = read("components/communication/series-view.tsx");

  it("list page uses white primary heading with botanical side strip", () => {
    assert.match(page, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.doesNotMatch(page, /htc-hospitality-intro htc-hospitality-intro-accent/);
    assert.match(page, /data-htc-phase12="automations"/);
  });

  it("help panel wires calm-blue classes (not gray muted fill)", () => {
    assert.match(help, /htc-automations-help/);
    assert.match(help, /htc-automations-help-header/);
    assert.doesNotMatch(help, /bg-muted\/30/);
  });

  it("Sales/Client groups use linen shell with white nested cards", () => {
    assert.match(list, /htc-group-shell/);
    assert.match(list, /htc-group-shell-body/);
    assert.match(list, /htc-badge-active/);
  });

  it("Active badges use eucalyptus treatment; Paused stays muted", () => {
    assert.match(list, /htc-badge-active/);
    assert.match(list, /variant=\{s\.status === "active" \? "outline" : "muted"\}/);
    assert.match(view, /htc-badge-active/);
  });

  it("What will happen preview uses calm guidance", () => {
    assert.match(form, /htc-surface-guidance/);
    assert.match(form, /What will happen\?/);
  });
});

describe("Phase 12 — Dashboard Coming up balance", () => {
  const page = read("app/(app)/dashboard/page.tsx");

  it("Coming up is white working surface, not linen slab", () => {
    assert.match(page, /title="Coming up"[\s\S]*?className="htc-surface-working"/);
    assert.doesNotMatch(page, /title="Coming up"[\s\S]*?--htc-linen/);
  });

  it("preserves Focus eucalyptus and does not recolor Snapshot families here", () => {
    assert.match(page, /headerBand="eucalyptus"/);
    assert.match(page, /BusinessSnapshotSection/);
  });
});

describe("Phase 12 — broader staff framing", () => {
  it("Requests and Task Center use white primary heading with botanical strip", () => {
    const requests = read("app/(app)/requests/page.tsx");
    const tasks = read("app/(app)/tasks/page.tsx");
    assert.match(requests, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(tasks, /htc-hospitality-heading htc-hospitality-intro-accent/);
  });

  it("Vendor empty states stay white working, not linen slabs", () => {
    const vendors = read("components/vendors/vendor-list.tsx");
    assert.match(vendors, /bg-card py-16 text-center/);
    assert.doesNotMatch(vendors, /bg-\[var\(--htc-linen\)\] py-16/);
  });

  it("EO template example uses calm guidance", () => {
    const eo = read("app/(app)/library/event-order-templates/page.tsx");
    assert.match(eo, /htc-surface-guidance/);
    assert.match(eo, /eo-templates-landing-example/);
  });
});

describe("Phase 12 — Phase 11D relationship workspace preserved", () => {
  it("does not strip Lead/Booking surface roles", () => {
    const lead = read("components/leads/lead-detail.tsx");
    const prefs = read("components/leads/space-preference-fields.tsx");
    const event = read("components/events/event-detail.tsx");
    assert.match(lead, /htc-surface-operational/);
    assert.match(lead, /lead-sales-availability/);
    assert.match(prefs, /htc-surface-operational/);
    assert.match(event, /htc-surface-summary|event-booking-summary/);
  });
});

describe("Phase 12 final — Task Center responsive header", () => {
  const page = read("app/(app)/tasks/page.tsx");

  it("stacks intro title/description above counts on mobile; horizontal on desktop", () => {
    assert.match(page, /data-testid="task-center-intro"/);
    assert.match(page, /htc-task-center-intro/);
    assert.match(page, /flex flex-col gap-2\.5 sm:flex-row sm:items-start sm:justify-between/);
    assert.match(page, /data-testid="task-center-intro-counts"/);
    assert.match(page, /sm:items-end/);
  });
});

describe("Phase 12 final — Task Center overdue readability", () => {
  const css = read("app/globals.css");
  const tasks = read("components/tasks/task-center.tsx");

  it("defines darkened overdue ink / banner without remapping global --destructive", () => {
    assert.match(css, /\.htc-staff \.htc-task-overdue-ink \{[\s\S]*?--htc-dusty-rose/);
    assert.match(css, /\.htc-staff \.htc-task-overdue-banner \{/);
    assert.match(css, /\.htc-staff \.htc-task-overdue-count \{/);
    assert.doesNotMatch(css, /\.htc-staff \s*\{[\s\S]*?--destructive:\s*#/);
  });

  it("wires overdue banner and labels to scoped overdue classes", () => {
    assert.match(tasks, /htc-task-overdue-banner/);
    assert.match(tasks, /htc-task-overdue-ink/);
    assert.match(tasks, /htc-task-overdue-count/);
  });
});

describe("Phase 12 final — Lead date-hold mobile layout", () => {
  const holds = read("components/availability/date-holds-section.tsx");
  const lead = read("components/leads/lead-detail.tsx");

  it("stacks Sales owner above Date hold on mobile", () => {
    assert.match(
      lead,
      /data-testid="lead-owner-hold-row"[\s\S]*?flex-col gap-3 sm:flex-row/,
    );
  });

  it("lets compact hold status and Place hold wrap/stack without nowrap collision", () => {
    assert.match(holds, /data-testid="date-hold-compact-band"/);
    assert.match(holds, /flex-col gap-2 sm:basis-0 sm:flex-row/);
    assert.match(holds, /className="h-8 w-full shrink-0 whitespace-nowrap sm:w-auto"/);
    assert.match(holds, /data-testid="date-hold-place"/);
  });
});
