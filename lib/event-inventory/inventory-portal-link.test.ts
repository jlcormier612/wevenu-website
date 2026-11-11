import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  inventoryReviewUrl,
  isInventoryPortalView,
  pickInventoryPortalSession,
} from "@/lib/event-inventory/inventory-portal-link";

describe("inventory portal share links", () => {
  it("never picks a financial token for inventory deep links", () => {
    const sessions = [
      { accessToken: "fin", accessLevel: "financial" },
      { accessToken: "cpl", accessLevel: "couple" },
    ];
    assert.equal(pickInventoryPortalSession(sessions)?.accessToken, "cpl");
    assert.equal(
      pickInventoryPortalSession([{ accessToken: "fin", accessLevel: "financial" }]),
      null,
    );
    assert.equal(
      pickInventoryPortalSession([{ accessToken: "plan", accessLevel: "planning" }])?.accessToken,
      "plan",
    );
  });

  it("builds a query+hash URL that survives fragment-stripping email clients", () => {
    const url = inventoryReviewUrl("https://app.sandbox.hellotocheers.com", "tok/with?chars");
    assert.match(url, /\/p\/tok%2Fwith%3Fchars\?view=inventory#inventory$/);
    assert.equal(isInventoryPortalView("inventory"), true);
    assert.equal(isInventoryPortalView("choices"), false);
  });

  it("notifyInventoryShared uses the picker and never falls back to sessions[0]", () => {
    const service = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");
    const page = readFileSync(resolve("app/(portal)/p/[token]/page.tsx"), "utf8");
    assert.match(service, /pickInventoryPortalSession/);
    assert.match(service, /inventoryReviewUrl/);
    assert.match(service, /createPortalSession\(event\.clientId, "Couple", "couple"\)/);
    assert.doesNotMatch(service, /sessions\.find\(\(s\) => s\.accessLevel !== "financial"\)/);
    assert.doesNotMatch(service, /sessions\[0\]/);
    assert.doesNotMatch(service, /\/p\/\$\{session\.accessToken\}#inventory/);
    assert.match(page, /isInventoryPortalView/);
    assert.match(page, /inventoryView/);
  });
});
