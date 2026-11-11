import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

function read(rel: string) {
  return readFileSync(rel, "utf8");
}

describe("Wave G1 — CollectionBackLink on deeper editors", () => {
  it("contract / message / pipeline / inventory edit pages expose destination-named back links", () => {
    const contract = read("app/(app)/contracts/templates/[id]/edit/page.tsx");
    const message = read("app/(app)/communication/templates/[id]/edit/page.tsx");
    const pipeline = read("app/(app)/library/pipeline-templates/[id]/edit/page.tsx");
    const inventory = read("app/(app)/library/inventory/[id]/edit/page.tsx");

    assert.match(
      contract,
      /CollectionBackLink[\s\S]*href="\/contracts\/templates"[\s\S]*label="Contract Templates"/,
    );
    assert.match(
      message,
      /CollectionBackLink[\s\S]*href=\{returnTo \?\? "\/communication\/templates"\}[\s\S]*label="Message Templates"/,
    );
    assert.match(
      pipeline,
      /CollectionBackLink[\s\S]*href="\/library\/pipeline-templates"[\s\S]*label="Pipeline Templates"/,
    );
    assert.match(
      inventory,
      /CollectionBackLink[\s\S]*href="\/library\/inventory"[\s\S]*label="Inventory"/,
    );

    for (const [src, headerNeedle] of [
      [contract, "<PageHeader"],
      [message, "<PageHeader"],
      [pipeline, "<PageHeader"],
      [inventory, "<PageHeader"],
    ] as const) {
      const back = src.indexOf("CollectionBackLink");
      const header = src.indexOf(headerNeedle);
      assert.ok(back >= 0, "CollectionBackLink must exist");
      assert.ok(header > back, "back link must render above page header");
    }
  });

  it("playbook / floor / timeline / questionnaire editors use CollectionBackLink", () => {
    const playbook = read("app/(app)/library/playbooks/[id]/page.tsx");
    const floor = read("app/(app)/library/floor-plan-templates/[id]/page.tsx");
    const timeline = read("app/(app)/library/timeline-templates/[id]/page.tsx");
    const questionnaire = read("components/questionnaire-templates/questionnaire-authoring-workspace.tsx");

    assert.match(
      playbook,
      /CollectionBackLink[\s\S]*href="\/library\/playbooks"[\s\S]*label="Planning Templates"/,
    );
    assert.match(
      floor,
      /CollectionBackLink[\s\S]*href="\/library\/floor-plan-templates"[\s\S]*label="Floor Plan Templates"/,
    );
    assert.match(
      timeline,
      /CollectionBackLink[\s\S]*href="\/library\/timeline-templates"[\s\S]*label="Timeline Templates"/,
    );
    assert.match(
      questionnaire,
      /CollectionBackLink[\s\S]*href="\/library\/questionnaire-templates"[\s\S]*label="Questionnaire Templates"/,
    );
    assert.doesNotMatch(playbook, /ArrowLeft/);
    assert.doesNotMatch(floor, /ArrowLeft/);
    assert.doesNotMatch(timeline, /ArrowLeft/);
  });
});

describe("Wave G1 — merge chips, booking chips, Required, floor empty, notifications", () => {
  const css = read("app/globals.css");

  it("merge-field chips are white with blush hover and wired in contract + message editors", () => {
    assert.match(css, /\.htc-staff \.htc-merge-field-chip \{[\s\S]*?background:\s*#ffffff/);
    assert.match(
      css,
      /\.htc-staff \.htc-merge-field-chip:hover[\s\S]*?background:\s*var\(--htc-soft-blush\)/,
    );
    const contractForm = read("components/contracts/template-form.tsx");
    const messageForm = read("components/communication/template-form.tsx");
    const builder = read("components/contracts/contract-builder.tsx");
    assert.match(contractForm, /htc-merge-field-chip/);
    assert.match(messageForm, /htc-merge-field-chip/);
    assert.match(builder, /htc-merge-field-chip/);
    assert.doesNotMatch(contractForm, /MERGE_FIELDS\.map[\s\S]*?bg-muted\/30/);
    assert.doesNotMatch(messageForm, /MESSAGE_MERGE_FIELDS\.map[\s\S]*?bg-muted\/30/);
  });

  it("booking summary space chips are white working cards", () => {
    const event = read("components/events/event-detail.tsx");
    assert.match(event, /booking-component-[\s\S]*?bg-card|bg-card[\s\S]*?booking-component-/);
    assert.doesNotMatch(event, /booking-component-[\s\S]*?bg-background\/60|bg-background\/60[\s\S]*?booking-component-/);
  });

  it("client/event Vendors Required uses blush attention, not charcoal fill", () => {
    const directory = read("components/events/vendors/venue-vendor-directory-summary.tsx");
    const section = read("components/events/vendors/event-vendors-section.tsx");
    assert.match(directory, /htc-badge-attention/);
    assert.doesNotMatch(directory, /bg-foreground text-background/);
    assert.match(section, /htc-badge-attention/);
    assert.doesNotMatch(section, /rounded-full bg-foreground[\s\S]*?Required/);
  });

  it("Floor Plans empty state uses calm-blue guidance", () => {
    const workspace = read("components/events/floor-plan-workspace.tsx");
    assert.match(
      workspace,
      /floor-plan-empty-no-working[\s\S]*?htc-surface-guidance|htc-surface-guidance[\s\S]*?floor-plan-empty-no-working/,
    );
    assert.doesNotMatch(
      workspace,
      /floor-plan-empty-no-working[\s\S]*?border-dashed|border-dashed[\s\S]*?floor-plan-empty-no-working/,
    );
  });

  it("notification bell rows are white cards with blush hover on beige panel", () => {
    assert.match(css, /\.htc-staff \.htc-notification-row \{/);
    assert.match(
      css,
      /\.htc-staff \.htc-notification-row:hover[\s\S]*?background:\s*var\(--htc-soft-blush\)/,
    );
    const bell = read("components/shell/notification-bell.tsx");
    assert.match(bell, /htc-notification-row/);
    assert.match(bell, /bg-card/);
    assert.doesNotMatch(bell, /divide-y divide-border\/50/);
    assert.doesNotMatch(bell, /hover:bg-muted\/40/);
  });
});
