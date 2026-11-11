import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  REQUEST_CLIENT_SEARCH_LIMIT,
  requestClientMatchesQuery,
  requestClientSubtitle,
  toRequestClientOption,
  type RequestClientSearchRow,
} from "@/lib/requests/client-search";

function row(partial: Partial<RequestClientSearchRow> = {}): RequestClientSearchRow {
  return {
    id: "c1",
    first_name: "Ava",
    last_name: "Allen",
    partner_first_name: "Blake",
    partner_last_name: "Brooks",
    email: "ava@example.com",
    event_type: "wedding",
    event_date: "2028-08-12",
    ...partial,
  };
}

describe("request client search matching", () => {
  it("matches full and partial primary names", () => {
    assert.equal(requestClientMatchesQuery(row(), "Ava Allen"), true);
    assert.equal(requestClientMatchesQuery(row(), "ava"), true);
    assert.equal(requestClientMatchesQuery(row(), "llen"), true);
  });

  it("matches partner name in a combined couple record", () => {
    assert.equal(requestClientMatchesQuery(row(), "Blake"), true);
    assert.equal(requestClientMatchesQuery(row(), "brooks"), true);
  });

  it("rejects non-matching queries", () => {
    assert.equal(requestClientMatchesQuery(row(), "Zachary"), false);
    assert.equal(requestClientMatchesQuery(row(), ""), false);
  });

  it("builds a display name and distinguishing subtitle", () => {
    const option = toRequestClientOption(row());
    assert.match(option.name, /Ava/);
    assert.match(option.name, /Blake|Brooks/);
    assert.equal(requestClientSubtitle(option), "Wedding · Aug 12, 2028");
  });

  it("distinguishes similar names via event date when present", () => {
    const a = toRequestClientOption(row({ id: "a", event_date: "2028-06-01" }));
    const b = toRequestClientOption(row({ id: "b", event_date: "2029-09-15" }));
    assert.notEqual(requestClientSubtitle(a), requestClientSubtitle(b));
  });

  it("caps results so the browser never receives the full client list", () => {
    assert.equal(REQUEST_CLIENT_SEARCH_LIMIT, 12);
    assert.ok(REQUEST_CLIENT_SEARCH_LIMIT < 50);
  });
});

describe("request client search wiring", () => {
  it("service search is venue-scoped and limited", () => {
    const src = readFileSync(resolve("lib/requests/service.ts"), "utf8");
    assert.match(src, /export async function searchRequestClients/);
    assert.match(src, /\.eq\("venue_id", venue\.id\)/);
    assert.match(src, /REQUEST_CLIENT_SEARCH_LIMIT/);
    assert.match(src, /partner_first_name\.ilike/);
  });

  it("picker uses the server action and never maps over a preloaded clients list", () => {
    const picker = readFileSync(resolve("components/requests/request-client-picker.tsx"), "utf8");
    const manager = readFileSync(resolve("components/requests/request-manager.tsx"), "utf8");
    assert.match(picker, /searchRequestClientsAction/);
    assert.match(picker, /Search for a client by name/);
    assert.match(picker, /No clients found\. Try another name\./);
    assert.match(picker, /searchSeqRef/);
    assert.match(picker, /ArrowDown/);
    assert.match(picker, /Try again/);
    assert.match(manager, /RequestClientPicker/);
    assert.doesNotMatch(
      manager,
      /<select[^>]*>[\s\S]*Select client…[\s\S]*clients\.map/,
    );
  });

  it("changing client only updates clientId — other form fields stay in state", () => {
    const manager = readFileSync(resolve("components/requests/request-manager.tsx"), "utf8");
    assert.match(
      manager,
      /setForm\(\(f\) => \(\{ \.\.\.f, clientId: option\?\.id \?\? "" \}\)\)/,
    );
    assert.match(manager, /disabled=\{creating \|\| !form\.clientId \|\| !form\.title\.trim\(\)\}/);
  });
});
