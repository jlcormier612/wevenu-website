/**
 * Vendor + couple empty/framing contrast — calm-blue documents, linen frames, notif hover.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("vendor surface contrast", () => {
  it("defines calm-blue document empties and linen framed empties under htc-vendor", () => {
    const css = read("app/globals.css");
    assert.match(css, /data-vendor-empty="documents"/);
    assert.match(css, /data-vendor-empty="framed"/);
    assert.match(css, /--htc-calm-blue/);
    assert.match(css, /--htc-linen/);
    assert.match(css, /data-vendor-notif-item/);
  });

  it("wires document library empty to calm blue", () => {
    const lib = read("components/vendor-app/vendor-library-section.tsx");
    assert.match(lib, /data-vendor-empty="documents"/);
    assert.match(lib, /No documents yet/);
  });

  it("frames events/messages/packages/faqs empties and event cards as working surfaces", () => {
    const events = read("components/vendor-app/vendor-events-list.tsx");
    const messages = read("components/vendor-app/vendor-messages-inbox.tsx");
    const packages = read("components/vendor-app/vendor-packages-manager.tsx");
    const faqs = read("components/vendor-app/vendor-faqs-manager.tsx");
    const workspace = read("components/vendor-app/vendor-event-workspace.tsx");
    const profile = read("components/vendor-app/vendor-profile-form.tsx");
    assert.match(events, /data-vendor-empty="framed"/);
    assert.match(messages, /data-vendor-empty="framed"/);
    assert.match(packages, /data-vendor-empty="framed"/);
    assert.match(faqs, /data-vendor-empty="framed"/);
    assert.match(workspace, /htc-surface-working/);
    assert.match(workspace, /htc-calm-blue/);
    assert.match(profile, /htc-surface-working/);
  });

  it("adds visible notification item hover hooks", () => {
    const bell = read("components/vendor-app/vendor-notification-bell.tsx");
    assert.match(bell, /data-vendor-notif-item/);
    assert.match(bell, /data-unread/);
  });
});

describe("couple portal empty guidance", () => {
  it("mirrors calm-blue guidance under .htc-portal and uses it on timeline/payment empties", () => {
    const css = read("app/globals.css");
    const timeline = read("components/portal/timeline-section.tsx");
    const payment = read("components/portal/payment-section.tsx");
    assert.match(css, /\.htc-portal \.htc-surface-guidance/);
    assert.match(timeline, /data-portal-empty="guidance"/);
    assert.match(payment, /data-portal-empty="guidance"/);
  });
});
