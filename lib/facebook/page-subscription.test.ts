import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  parseSubscribedAppsResult,
  resolveOwnedPage,
  shouldUnsubscribePage,
  shouldUnsubscribePreviousPage,
  subscribePageToLeadgen,
  subscribedAppsPath,
  unsubscribePageFromLeadgen,
} from "@/lib/facebook/page-subscription";

const ACCOUNTS = [
  { id: "page-a", name: "Venue A", accessToken: "token-a" },
  { id: "page-b", name: "Venue B", accessToken: "token-b" },
];

describe("resolveOwnedPage", () => {
  it("accepts a Page the authorizing user actually manages", () => {
    const result = resolveOwnedPage(ACCOUNTS, "page-b");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.page.name, "Venue B");
      assert.equal(result.page.accessToken, "token-b");
    }
  });

  it("rejects a Page ID that is not on this Facebook account", () => {
    const result = resolveOwnedPage(ACCOUNTS, "page-other-venue");
    assert.deepEqual(result, {
      ok: false,
      message: "That Page isn't available for this Facebook account.",
    });
  });

  it("rejects an empty Page ID", () => {
    const result = resolveOwnedPage(ACCOUNTS, "  ");
    assert.equal(result.ok, false);
  });
});

describe("unsubscribe safety (app-wide Page subscription)", () => {
  it("unsubscribes only when no connected venue still uses the Page", () => {
    assert.equal(shouldUnsubscribePage(0), true);
  });

  it("does not unsubscribe when another venue is still connected to the Page", () => {
    assert.equal(shouldUnsubscribePage(1), false);
    assert.equal(shouldUnsubscribePage(3), false);
  });

  it("unsubscribes the previous Page only when switching to a different Page", () => {
    assert.equal(shouldUnsubscribePreviousPage("page-a", "page-b"), true);
    assert.equal(shouldUnsubscribePreviousPage("page-a", "page-a"), false);
    assert.equal(shouldUnsubscribePreviousPage(null, "page-b"), false);
  });
});

describe("parseSubscribedAppsResult", () => {
  it("treats HTTP success as subscribed", () => {
    assert.deepEqual(parseSubscribedAppsResult(true, { success: true }), { ok: true });
    assert.deepEqual(parseSubscribedAppsResult(true, {}), { ok: true });
  });

  it("does not treat a Graph error body as a healthy subscription", () => {
    const result = parseSubscribedAppsResult(false, {
      error: { message: "(#200) Requires pages_manage_metadata permission" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /pages_manage_metadata/);
    }
  });

  it("does not treat success:false as connected", () => {
    const result = parseSubscribedAppsResult(true, { success: false });
    assert.equal(result.ok, false);
  });
});

describe("subscribePageToLeadgen / unsubscribePageFromLeadgen", () => {
  it("POSTs subscribed_fields=leadgen to /{page-id}/subscribed_apps", async () => {
    let calledUrl = "";
    let calledMethod = "";
    const result = await subscribePageToLeadgen("page-a", "token-a", async (input, init) => {
      calledUrl = String(input);
      calledMethod = String(init?.method ?? "");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    assert.equal(result.ok, true);
    assert.equal(calledMethod, "POST");
    const url = new URL(calledUrl);
    assert.equal(url.pathname.endsWith(subscribedAppsPath("page-a")), true);
    assert.equal(url.searchParams.get("subscribed_fields"), "leadgen");
    assert.equal(url.searchParams.get("access_token"), "token-a");
  });

  it("returns Meta's error instead of claiming success", async () => {
    const result = await subscribePageToLeadgen("page-a", "token-a", async () => {
      return new Response(JSON.stringify({ error: { message: "Invalid OAuth access token." } }), { status: 400 });
    });
    assert.deepEqual(result, { ok: false, error: "Invalid OAuth access token." });
  });

  it("DELETEs /{page-id}/subscribed_apps on unsubscribe", async () => {
    let calledMethod = "";
    let calledUrl = "";
    const result = await unsubscribePageFromLeadgen("page-a", "token-a", async (input, init) => {
      calledUrl = String(input);
      calledMethod = String(init?.method ?? "");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    assert.equal(result.ok, true);
    assert.equal(calledMethod, "DELETE");
    assert.equal(new URL(calledUrl).searchParams.get("subscribed_fields"), null);
  });
});

describe("B1 wiring in the Facebook connection lifecycle", () => {
  it("selectFacebookPage subscribes before persisting connected, using a server-owned Page token", () => {
    const source = readFileSync(resolve("lib/facebook/service.ts"), "utf8");
    const subscribeAt = source.indexOf("subscribePageToLeadgen(");
    const persistAt = source.indexOf("setSelectedPage(");
    const ownedAt = source.indexOf("resolveOwnedPage(");
    assert.ok(subscribeAt > 0, "selectFacebookPage must call subscribePageToLeadgen");
    assert.ok(persistAt > 0, "selectFacebookPage must persist via setSelectedPage");
    assert.ok(ownedAt > 0, "page ownership must be resolved server-side from /me/accounts");
    assert.ok(subscribeAt < persistAt, "must not mark connected before Page leadgen subscription succeeds");
  });

  it("disconnect unsubscribes only after checking remaining venues on the Page", () => {
    const source = readFileSync(resolve("lib/facebook/service.ts"), "utf8");
    assert.match(source, /countConnectedVenuesForPage/);
    assert.match(source, /shouldUnsubscribePage/);
    assert.match(source, /unsubscribePageFromLeadgen/);
    assert.match(source, /disconnectConnection/);
  });

  it("Settings UI does not send Page access tokens to the server action", () => {
    const ui = readFileSync(resolve("components/settings/facebook-connect-section.tsx"), "utf8");
    const actions = readFileSync(resolve("app/(app)/settings/facebook-actions.ts"), "utf8");
    assert.match(ui, /selectFacebookPageAction\(\{ pageId: page\.id \}\)/);
    assert.doesNotMatch(ui, /pageAccessToken/);
    assert.doesNotMatch(actions, /pageAccessToken/);
    assert.match(actions, /selectFacebookPage\(input\)/);
  });

  it("listFacebookPages does not return Page access tokens to the browser", () => {
    const source = readFileSync(resolve("lib/facebook/service.ts"), "utf8");
    assert.match(source, /pages: pages\.accounts\.map\(\(p\) => \(\{ id: p\.id, name: p\.name \}\)\)/);
  });
});
