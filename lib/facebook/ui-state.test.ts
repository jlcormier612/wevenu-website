import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { FacebookConnection, FacebookLeadForm } from "@/lib/facebook/types";
import {
  facebookEnabledFormCount,
  facebookIsDelivering,
  facebookUiState,
} from "@/lib/facebook/ui-state";

function connection(overrides: Partial<FacebookConnection> = {}): FacebookConnection {
  return {
    venueId: "venue-1",
    pageId: "page-1",
    pageName: "Hello to Cheers",
    status: "connected",
    lastHealthCheckAt: null,
    lastHealthCheckOk: null,
    lastError: null,
    connectedAt: "2026-08-29T03:00:00.000Z",
    ...overrides,
  };
}

function form(overrides: Partial<FacebookLeadForm> = {}): FacebookLeadForm {
  return { id: "row-1", formId: "form-1", formName: "Spring Open House", isEnabled: true, ...overrides };
}

describe("facebookUiState", () => {
  it("treats a missing connection as not connected", () => {
    assert.equal(facebookUiState(null, []), "not_connected");
  });

  it("treats an explicitly disconnected row as not connected", () => {
    assert.equal(facebookUiState(connection({ status: "disconnected" }), []), "not_connected");
  });

  it("reports needs_page_selection when Meta is authorized but no Page is bound", () => {
    assert.equal(
      facebookUiState(connection({ status: "needs_page_selection", pageId: null, pageName: null }), []),
      "needs_page_selection",
    );
  });

  it("reports error so the venue is told to reconnect", () => {
    assert.equal(facebookUiState(connection({ status: "error" }), [form()]), "error");
  });

  // The defect this module exists to prevent. selectFacebookPage sets
  // status='connected' on Page binding alone, but the webhook and the hourly
  // reconcile both require an enabled form row, so this state delivers zero
  // leads and must not read as "Connected".
  it("never reports delivering when a Page is bound but no forms exist", () => {
    assert.equal(facebookUiState(connection(), []), "needs_forms");
    assert.equal(facebookIsDelivering(connection(), []), false);
  });

  it("never reports delivering when every form is turned off", () => {
    const forms = [form({ isEnabled: false }), form({ id: "row-2", formId: "form-2", isEnabled: false })];
    assert.equal(facebookUiState(connection(), forms), "needs_forms");
    assert.equal(facebookIsDelivering(connection(), forms), false);
  });

  it("reports delivering once at least one form is enabled", () => {
    const forms = [form({ isEnabled: false }), form({ id: "row-2", formId: "form-2", isEnabled: true })];
    assert.equal(facebookUiState(connection(), forms), "delivering");
    assert.equal(facebookIsDelivering(connection(), forms), true);
  });

  it("ignores enabled forms when the connection itself is unusable", () => {
    // A disabled/errored connection cannot deliver regardless of form state.
    assert.equal(facebookIsDelivering(connection({ status: "error" }), [form()]), false);
    assert.equal(facebookIsDelivering(connection({ status: "disconnected" }), [form()]), false);
    assert.equal(
      facebookIsDelivering(connection({ status: "needs_page_selection", pageId: null }), [form()]),
      false,
    );
  });
});

// The state model above is only useful if the card actually renders from it.
// These guard the sandbox state we observed on 2026-08-29: status='connected',
// Page bound and subscribed, zero facebook_lead_forms rows.
describe("facebook card renders from the derived state", () => {
  const source = readFileSync(resolve("components/settings/facebook-connect-section.tsx"), "utf8");

  it("derives the badge from facebookUiState, not from connection.status", () => {
    assert.match(source, /facebookUiState\(connection, leadForms\)/);
    assert.doesNotMatch(source, /connection\??\.status === "connected"/);
  });

  it("shows the green Connected badge only while delivering", () => {
    assert.match(source, /\{isDelivering && <Badge variant="success">Connected<\/Badge>\}/);
    const greens = source.match(/<Badge variant="success"/g) ?? [];
    assert.equal(greens.length, 1, "success is the only green badge and belongs to isDelivering");
  });

  it("shows Action needed instead of green when a Page is bound with zero enabled forms", () => {
    assert.match(source, /\{needsForms && <Badge variant="warning">Action needed<\/Badge>\}/);
    assert.match(source, /const needsForms = uiState === "needs_forms"/);
  });

  it("states plainly that leads will not arrive until a form is chosen", () => {
    assert.match(source, /no Lead Ads forms are connected yet/);
    assert.match(source, /Leads will not arrive until you choose at least one form/);
  });

  it("gives the venue a direct control from Action needed into form selection", () => {
    assert.match(source, /onClick=\{\(\) => setShowPicker\(true\)\}>\s*Choose Lead Ads forms/);
    assert.match(source, /initialStep=\{connection\?\.pageId \? "form" : "page"\}/);
  });

  it("explains the zero-forms-on-Page case rather than implying setup is done", () => {
    assert.match(source, /No Lead Ads forms were found for this Page yet/);
  });

  it("does not offer a separate Instagram connection", () => {
    assert.doesNotMatch(source, /Connect Instagram|instagram_basic|Connect with Instagram/);
  });
});

describe("Facebook Connect URL wiring on Settings integrations", () => {
  it("passes a server-built connectUrl like Stripe/QuickBooks (avoids client server-action hang)", () => {
    const page = readFileSync(resolve("app/(app)/settings/integrations/page.tsx"), "utf8");
    assert.match(page, /buildFacebookOAuthUrl/);
    assert.match(page, /connectUrl=\{buildFacebookOAuthUrl\(venue\.id\)\}/);
  });
});

describe("facebookEnabledFormCount", () => {
  it("counts only enabled forms", () => {
    assert.equal(facebookEnabledFormCount([]), 0);
    assert.equal(facebookEnabledFormCount([form({ isEnabled: false })]), 0);
    assert.equal(
      facebookEnabledFormCount([form(), form({ id: "row-2", formId: "form-2", isEnabled: false })]),
      1,
    );
  });
});
