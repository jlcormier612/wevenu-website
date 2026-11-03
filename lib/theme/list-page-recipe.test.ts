/**
 * List-page recipe (Rule J) — Clients as canonical; Leads/Vendors/Automations/Tours align.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("List-page recipe — shared primitives", () => {
  const css = read("app/globals.css");
  const rules = read("docs/design/HTC-COLOR-DISTRIBUTION-RULES.md");
  const selected = read("lib/ui/selected-state.ts");

  it("documents Rule J platform consistency recipe", () => {
    assert.match(rules, /Rule J — Platform consistency recipe/);
    assert.match(rules, /htc-hospitality-heading/);
    assert.match(rules, /htc-badge-attention/);
    assert.match(rules, /\.htc-record-link/);
    assert.match(rules, /Bring-Your-Business/);
  });

  it("accent strip applies to white heading cards", () => {
    assert.match(css, /\.htc-staff \.htc-hospitality-heading\.htc-hospitality-intro-accent/);
    assert.match(
      css,
      /\.htc-hospitality-heading\.htc-hospitality-intro-accent \{[\s\S]*?border-left:\s*5px solid var\(--htc-botanical\)/,
    );
  });

  it("defines blush attention badge and table row hover", () => {
    assert.match(css, /\.htc-staff \.htc-badge-attention/);
    assert.match(
      css,
      /\.htc-badge-attention[\s\S]*?background:\s*var\(--htc-soft-blush\)/,
    );
    assert.match(
      css,
      /\.htc-hospitality-table \[data-slot="table-body"\] tr:hover \{[\s\S]*?htc-soft-blush/,
    );
  });

  it("exports shared attention chip classes", () => {
    assert.match(selected, /export const ATTENTION_CHIP/);
    assert.match(selected, /export const ATTENTION_CHIP_COUNT/);
    assert.match(selected, /htc-soft-blush/);
  });
});

describe("List-page recipe — priority pages", () => {
  it("core staff pages use white heading + botanical strip", () => {
    for (const page of [
      "app/(app)/clients/page.tsx",
      "app/(app)/leads/page.tsx",
      "app/(app)/vendors/page.tsx",
      "app/(app)/tours/page.tsx",
      "app/(app)/contracts/page.tsx",
      "app/(app)/payments/page.tsx",
      "app/(app)/tasks/page.tsx",
      "app/(app)/requests/page.tsx",
      "app/(app)/dashboard/page.tsx",
      "app/(app)/setup-hub/page.tsx",
      "app/(app)/settings/page.tsx",
      "app/(app)/settings/availability/page.tsx",
      "app/(app)/settings/business/page.tsx",
      "app/(app)/settings/team/page.tsx",
      "app/(app)/settings/import/page.tsx",
      "app/(app)/communication/series/page.tsx",
      "app/(app)/communication/series/new/page.tsx",
      "app/(app)/library/documents/page.tsx",
      "app/(app)/library/contracts/page.tsx",
      "app/(app)/library/playbooks/page.tsx",
      "app/(app)/library/inventory/page.tsx",
      "app/(app)/guide/page.tsx",
      "app/(app)/feedback/page.tsx",
      "app/(app)/help/page.tsx",
      "app/(app)/messaging/health/page.tsx",
      "components/offerings/offerings-page-client.tsx",
      "components/public-forms/public-forms-page-client.tsx",
      "components/qr-campaigns/qr-campaigns-page-client.tsx",
    ]) {
      const src = read(page);
      assert.match(src, /htc-hospitality-heading htc-hospitality-intro-accent/, page);
    }
  });

  it("Automations list uses white heading + strip (not eucalyptus intro fill)", () => {
    const page = read("app/(app)/communication/series/page.tsx");
    assert.match(page, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.doesNotMatch(page, /htc-hospitality-intro htc-hospitality-intro-accent/);
  });

  it("Setup Bring Your Business how-to / HoneyBook path uses calm guidance", () => {
    const byb = read("components/setup-hub/bring-your-business-choices.tsx");
    assert.match(byb, /htc-surface-guidance/);
    assert.match(byb, /HoneyBook/);
    assert.doesNotMatch(byb, /border-primary\/30 bg-primary\/5/);
  });

  it("Help integration tips and payment schedule explainers use calm guidance", () => {
    const help = read("components/help/integration-setup-guide.tsx");
    const invoicePicker = read("components/payments/invoice-picker-for-schedule.tsx");
    assert.match(help, /htc-surface-guidance/);
    assert.doesNotMatch(help, /bg-primary\/5/);
    assert.match(invoicePicker, /htc-surface-guidance/);
  });

  it("Task Center informational clear callout uses calm guidance not sky", () => {
    const tasks = read("components/tasks/task-center.tsx");
    assert.match(tasks, /htc-surface-guidance/);
    assert.doesNotMatch(tasks, /bg-sky-50/);
  });

  it("Clients Needs Attention and Leads New Inquiry use attention chips", () => {
    const clients = read("components/clients/client-list.tsx");
    const leads = read("components/leads/lead-list.tsx");
    assert.match(clients, /ATTENTION_CHIP/);
    assert.match(leads, /ATTENTION_CHIP/);
    assert.match(leads, /new_inquiry/);
  });

  it("Vendors Required is blush attention; View uses record link", () => {
    const vendors = read("components/vendors/vendor-list.tsx");
    assert.match(vendors, /htc-badge-attention/);
    assert.doesNotMatch(vendors, /bg-foreground text-background/);
    assert.match(vendors, /htc-record-link text-sm font-medium/);
  });

  it("Tours rows are separated cards with record-link names when lead-linked", () => {
    const css = read("app/globals.css");
    const tours = read("components/tours/tour-list.tsx");
    assert.match(css, /\.htc-staff \.htc-tours-list \{[\s\S]*?gap:\s*0\.65rem/);
    assert.match(css, /\.htc-staff \.htc-tours-row \{[\s\S]*?border-radius:\s*0\.75rem/);
    assert.match(tours, /className="htc-record-link"/);
    assert.match(tours, /data-tours-name=""/);
  });

  it("Wave A — calm-blue info shells and eucalyptus task group headers", () => {
    const css = read("app/globals.css");
    const vendors = read("components/vendors/required-vendor-categories-panel.tsx");
    const setupOverview = read("components/setup-hub/setup-hub-overview.tsx");
    const setupReady = read("components/setup-hub/setup-readiness.tsx");
    const tasks = read("components/tasks/task-center.tsx");
    const requests = read("components/requests/request-manager.tsx");
    const inbox = read("app/(app)/messaging/conversation-inbox.tsx");
    const docs = read("components/library/library-documents-manager.tsx");

    assert.match(vendors, /htc-surface-guidance/);
    assert.match(setupOverview, /htc-surface-guidance/);
    assert.match(setupOverview, /setup-hub-orientation/);
    assert.match(setupReady, /htc-surface-guidance/);
    assert.match(css, /\.htc-tours-section-empty \{[\s\S]*?background:\s*var\(--htc-calm-blue\)/);
    assert.match(css, /\[data-cal-schedule-empty\] \{[\s\S]*?background:\s*var\(--htc-calm-blue\)/);
    assert.match(css, /\.htc-task-event-group-header \{[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.match(tasks, /htc-task-event-group-header/);
    assert.match(tasks, /bg-card pl-8/);
    assert.match(docs, /htc-hospitality-toolbar/);
    assert.match(docs, /bg-card pl-9/);
    assert.match(requests, /htc-surface-working/);
    assert.match(requests, /htc-hospitality-table/);
    assert.match(inbox, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(inbox, /htc-record-link/);
    assert.match(inbox, /bg-card pl-8/);
  });

  it("Wave B — internal workspace guidance shells and title cards", () => {
    const questionnaires = read("components/events/questionnaire-family-panel.tsx");
    const eventSetup = read("components/events/event-setup-panel.tsx");
    const inventory = read("components/event-inventory/event-inventory-panel.tsx");
    const support = read("components/portal/portal-link-widget.tsx");
    const eo = read("components/event-orders/event-order-panel.tsx");
    const guide = read("components/guide/venue-guide-editor.tsx");
    const assetHeader = read("components/business-assets/asset-header.tsx");

    assert.match(questionnaires, /htc-surface-guidance/);
    assert.match(questionnaires, /questionnaire-delivery-guidance/);
    assert.match(questionnaires, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(eventSetup, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(eventSetup, /event-setup-orientation/);
    assert.match(eventSetup, /htc-surface-guidance/);
    assert.match(inventory, /inventory-share-instructions[\s\S]*htc-surface-guidance|htc-surface-guidance[\s\S]*inventory-share-instructions/);
    assert.match(inventory, /inventory-visibility-disclosure/);
    assert.match(inventory, /htc-surface-guidance/);
    assert.match(support, /htc-surface-guidance/);
    assert.match(support, /portal-support-access/);
    assert.match(eo, /eo-couple-choice-group/);
    assert.match(eo, /htc-surface-guidance/);
    assert.match(guide, /htc-venue-guide-orientation/);
    assert.match(guide, /htc-badge-active/);
    assert.match(assetHeader, /htc-record-link/);
  });

  it("Wave C — remaining staff guidance shells, empties, and Reports white title", () => {
    const reports = read("components/reporting/reports-layout-shell.tsx");
    const texting = read("components/settings/text-messaging-setup-section.tsx");
    const email = read("components/settings/email-intake-section.tsx");
    const stripe = read("components/settings/stripe-connect-section.tsx");
    const starter = read("components/library/starter-ownership-banner.tsx");
    const contracts = read("components/contracts/contract-list.tsx");
    const payments = read("components/payments/payment-schedule-list.tsx");
    const eo = read("components/event-orders/event-order-panel.tsx");
    const website = read("components/settings/website-forms-section.tsx");
    const leadCapture = read("app/(app)/setup-hub/lead-capture/page.tsx");

    assert.match(reports, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.doesNotMatch(reports, /htc-hospitality-intro htc-hospitality-intro-accent/);
    assert.match(texting, /texting-setup-orientation[\s\S]*htc-surface-guidance|htc-surface-guidance[\s\S]*texting-setup-orientation/);
    assert.match(email, /htc-surface-guidance/);
    assert.match(stripe, /htc-surface-guidance/);
    assert.match(starter, /htc-surface-guidance/);
    assert.match(contracts, /htc-surface-guidance/);
    assert.match(payments, /htc-surface-guidance/);
    assert.match(eo, /eo-overview/);
    assert.match(eo, /htc-record-link/);
    assert.match(eo, /bg-card px-4 py-3/);
    assert.match(website, /htc-surface-guidance/);
    assert.match(website, /htc-surface-working/);
    assert.match(leadCapture, /htc-hospitality-heading htc-hospitality-intro-accent/);
  });
});
