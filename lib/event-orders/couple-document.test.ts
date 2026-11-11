/**
 * Step 4 — couple Event Order document (/order/{token}) and the venue rows.
 * Run: npx tsx --test lib/event-orders/couple-document.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isPublicPath } from "@/integrations/supabase/proxy";
import { normalizeVenueNotificationHref } from "@/lib/notifications/venue-deep-links";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const service = read("lib/event-orders/couple-document.ts");
const view = read("components/event-orders/event-order-document-view.tsx");
const client = read("components/event-orders/event-order-document-client.tsx");
const share = read("lib/event-orders/representation.ts");
const core = read("lib/client-choices/apply-core.ts");
const migration = read("supabase/migrations/20261426600000_event_order_review_link.sql");

function approveBody(): string {
  const start = service.indexOf("export async function approveEventOrderDocument");
  return service.slice(start);
}

describe("standalone Event Order link", () => {
  it("is public like /offer and /sign, without opening other routes", () => {
    assert.equal(isPublicPath("/order/abc123"), true);
    assert.equal(isPublicPath("/orders"), false);
  });

  it("every Event Order has a unique secret token", () => {
    assert.match(migration, /add column if not exists review_token text/);
    assert.match(migration, /set not null/);
    assert.match(migration, /create unique index if not exists event_orders_review_token_key/);
  });

  it("only opens a shared copy, scoped by the token's own venue", () => {
    assert.match(service, /\.eq\("review_token", token\)/);
    assert.match(service, /if \(!order\?\.sharedAt \|\| !order\.eventId\) return null;/);
    assert.match(service, /getLatestShareSnapshot\(client, venueId, order\.id\)/);
  });

  it("the share email links /order/{token} and creates no portal session", () => {
    assert.match(share, /eventOrderDocumentUrl\(publicAppOrigin\(\), eventOrder\.reviewToken\)/);
    assert.doesNotMatch(share, /createPortalSession/);
    const wrapper = share.slice(share.indexOf("export async function shareEventOrderWithClient"));
    assert.ok(
      wrapper.indexOf("prepareCoupleChoicesForEventOrderShare") < wrapper.indexOf("shareEventOrderCore("),
      "choices are answerable on the link before it is emailed",
    );
  });
});

describe("Approve my Event Order", () => {
  it("records picks, applies them, refreshes the copy, then records approval — in that order", () => {
    const body = approveBody();
    const order = [
      "validateChoicesAnswers(row.definition, picked)",
      "submitDocumentChoices(scope, row, picked)",
      "applyChoicesToEventOrder(client, venueId, row, { submittedBy: \"client\" })",
      "repo.finalizeEventOrder(client, venueId, reopened.id, reopened.revision + 1)",
      "shareEventOrderCore(client, venue, reopened.id",
      "client_agreed_revision: current.revision",
      "create_venue_notification",
    ].map((needle) => {
      const at = body.indexOf(needle);
      assert.ok(at >= 0, `missing ${needle}`);
      return at;
    });
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("refreshing the couple's copy never re-emails them", () => {
    assert.match(approveBody(), /emailClient: false/);
  });

  it("double-click safe: status claim and revision-checked approval", () => {
    assert.match(service, /\.in\("status", \["sent", "in_progress", "changes_requested"\]\)\s*\.select\("id"\)/);
    assert.match(approveBody(), /\.eq\("revision", current\.revision\)/);
    assert.match(approveBody(), /if \(isApprovedNow\(scope\.order\)\) return \{ ok: true, already: true \};/);
  });

  it("never invoices, charges, or sends anything financial", () => {
    for (const src of [service, core]) {
      assert.doesNotMatch(src, /createInvoice|sendInvoice|createPaymentSchedule|createAmendedInvoice/);
    }
  });

  it("notifies the venue with a deep link to the Event Order document", () => {
    assert.match(service, /p_type: EVENT_ORDER_APPROVED_NOTIFICATION/);
    assert.match(service, /export const EVENT_ORDER_APPROVED_NOTIFICATION = "event_order_approved"/);
    const link = "/events/ev-1?tab=event-order#event-order-order";
    assert.match(service, /`\/events\/\$\{eventId\}\?tab=event-order#event-order-order`/);
    assert.equal(normalizeVenueNotificationHref(link, "event_order_approved"), link);
    assert.match(read("components/shell/notification-bell.tsx"), /event_order_approved:\s+"Open Event Order"/);
  });

  it("a venue edit after approval needs approval again", () => {
    assert.match(read("lib/event-orders/repository.ts"), /client_agreed_revision: null/);
    assert.match(service, /order\.clientAgreedRevision === order\.revision/);
  });
});

describe("couple page behavior", () => {
  it("Approve stays disabled until required choices are made", () => {
    assert.match(view, /validateChoicesAnswers\(definition, answers\)/);
    assert.match(view, /disabled=\{isPreview \|\| pending \|\| Boolean\(approveBlockedReason\)\}/);
    assert.match(view, /"Approve my Event Order"/);
  });

  it("choices sit inline in their matching section", () => {
    assert.match(view, /matchChoiceGroupsToSections\(/);
    assert.match(view, /placement\.bySectionId\.get\(section\.id\)/);
    assert.match(core, /sectionId: sectionFor\.get\(line\.groupId\) \?\? null/);
  });

  it("picks autosave so the couple can leave and come back", () => {
    assert.match(client, /saveEventOrderDocumentAnswersAction\(token, choicesId, answers\)/);
    assert.match(client, /AUTOSAVE_DELAY_MS/);
    assert.match(client, /await saving\.current;/);
  });

  it("venue Preview renders the same component and cannot approve", () => {
    const workflow = read("components/event-orders/event-commercial-workflow.tsx");
    assert.match(workflow, /<EventOrderDocumentView doc=\{preview\} mode="preview" \/>/);
    assert.match(view, /Preview does not send or approve anything/);
  });
});
