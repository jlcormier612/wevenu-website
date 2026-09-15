import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client playbook release rematerializes missing event tasks", () => {
  it("exports ensureClientPlaybookTasksMaterialized and calls it from release", () => {
    const src = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
    assert.match(src, /export async function ensureClientPlaybookTasksMaterialized/);
    const release = src.slice(src.indexOf("export async function releasePlaybookApplication"));
    assert.match(release, /ensureClientPlaybookTasksMaterialized/);
  });
});

describe("Portal messages mark-read is view-gated", () => {
  it("badge fetch uses markRead=0; conversation view marks read", () => {
    const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
    const route = readFileSync(resolve("app/api/portal/messages/route.ts"), "utf8");
    const messages = readFileSync(resolve("components/portal/message-section.tsx"), "utf8");
    assert.match(shell, /markRead=0/);
    assert.match(shell, /countUnreadVenueMessages/);
    assert.match(route, /markRead/);
    assert.match(shell, /onConversationViewed=/);
    assert.match(messages, /onConversationViewed/);
  });
});

describe("Portal customer-facing tasks omit verification fixtures", () => {
  it("filters event_tasks through isInternalVerificationIdentity", () => {
    const src = readFileSync(resolve("lib/portal/service.ts"), "utf8");
    assert.match(src, /isInternalVerificationIdentity/);
    assert.match(src, /extraName: String\(r\.title/);
  });
});
