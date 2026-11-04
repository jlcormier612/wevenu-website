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
  const edit = read("app/(app)/communication/series/[id]/edit/page.tsx");
  const create = read("app/(app)/communication/series/new/page.tsx");
  const enrollments = read("components/communication/series-enrollments.tsx");
  const css = read("app/globals.css");

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

  it("Wave F edit/new use working cards with eucalyptus headers", () => {
    assert.match(css, /\.htc-staff \.htc-working-card \{[\s\S]*?background:\s*#ffffff/);
    assert.match(
      css,
      /\.htc-staff \.htc-working-card > \[data-slot="card-header"\][\s\S]*?background(?:-color)?:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(css, /\.htc-staff \.htc-working-row:hover \{[\s\S]*?--htc-soft-blush/);
    assert.match(edit, /data-htc-phase12="automations-edit"/);
    assert.match(edit, /htc-working-card/);
    assert.match(edit, /htc-hospitality-page/);
    assert.match(create, /data-htc-phase12="automations-new"/);
    assert.match(create, /htc-working-card/);
    assert.match(create, /htc-hospitality-page/);
  });

  it("Wave F keeps one calm-blue orientation; save-scope is quiet copy", () => {
    assert.match(edit, /<AutomationsHelp/);
    assert.match(create, /<AutomationsHelp/);
    assert.match(form, /Saving changes applies to people who enter this automation after you save/);
    assert.doesNotMatch(form, /htc-surface-guidance-compact/);
    assert.match(form, /htc-record-link[\s\S]*Edit message|Edit message[\s\S]*htc-record-link/);
    assert.match(form, /htc-badge-active/);
    assert.match(enrollments, /htc-working-row/);
    assert.match(enrollments, /htc-badge-active/);
  });
});

describe("Phase 12 — Dashboard Coming up balance", () => {
  const page = read("app/(app)/dashboard/page.tsx");

  it("Coming up is calm-blue guidance surface, not linen slab", () => {
    assert.match(page, /title="Coming up"[\s\S]*?className="htc-surface-guidance"/);
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
    assert.match(eo, /LibraryDependencyNote/);
    assert.match(eo, /tone="calm"/);
    assert.match(eo, /eo-templates-landing-example/);
  });

  it("Wave F deeper editors use working-card chrome", () => {
    const pages = [
      "app/(app)/communication/templates/[id]/edit/page.tsx",
      "app/(app)/contracts/templates/[id]/edit/page.tsx",
      "app/(app)/library/pipeline-templates/[id]/edit/page.tsx",
      "app/(app)/vendors/[id]/edit/page.tsx",
      "app/(app)/clients/[id]/edit/page.tsx",
      "app/(app)/leads/[id]/edit/page.tsx",
      "app/(app)/events/[id]/edit/page.tsx",
    ];
    for (const rel of pages) {
      const src = read(rel);
      assert.match(src, /htc-working-card/, rel);
      assert.match(src, /htc-hospitality-page/, rel);
      assert.match(src, /htc-hospitality-heading htc-hospitality-intro-accent/, rel);
    }
  });
});

describe("Phase 12 — Phase 11D relationship workspace preserved", () => {
  it("does not strip Lead/Booking surface roles (Rule K slot map)", () => {
    const lead = read("components/leads/lead-detail.tsx");
    const prefs = read("components/leads/space-preference-fields.tsx");
    const event = read("components/events/event-detail.tsx");
    assert.match(lead, /lead-sales-availability[\s\S]*htc-surface-working|htc-surface-working[\s\S]*lead-sales-availability/);
    assert.match(prefs, /htc-surface-summary/);
    assert.match(event, /htc-surface-summary-pale|event-booking-summary/);
    assert.match(event, /htc-surface-working/);
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

  it("Not protected uses attention chip — not muted gray wash; booking uses Active", () => {
    assert.match(holds, /htc-badge-attention/);
    assert.match(holds, /htc-badge-active/);
    assert.match(holds, /protection\.source === "booking"/);
    assert.doesNotMatch(
      holds.slice(holds.indexOf("htc-badge-attention") - 80, holds.indexOf("htc-badge-attention") + 120),
      /bg-muted\/50/,
    );
  });
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
