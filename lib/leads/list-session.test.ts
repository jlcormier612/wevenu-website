import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLeadsListSession,
  isLeadDetailPath,
  leadsShellHrefFromSession,
  parseLeadsListSession,
  serializeLeadsListSession,
  shouldRestoreProgressiveSession,
} from "@/lib/leads/list-session";

describe("Leads list session (Wave 1 working context)", () => {
  it("detects lead detail paths without matching list/new/pipeline", () => {
    assert.equal(isLeadDetailPath("/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080"), true);
    assert.equal(isLeadDetailPath("/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080/edit"), true);
    assert.equal(isLeadDetailPath("/leads"), false);
    assert.equal(isLeadDetailPath("/leads?eventType=wedding"), false);
    assert.equal(isLeadDetailPath("/leads/new"), false);
    assert.equal(isLeadDetailPath("/leads/pipeline"), false);
  });

  it("restores shell Leads href from session only when leaving a detail path", () => {
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
        defaultHref: "/leads",
        sessionHref: "/leads?eventType=wedding&sort=oldest",
      }),
      "/leads?eventType=wedding&sort=oldest",
    );
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/dashboard",
        defaultHref: "/leads",
        sessionHref: "/leads?eventType=wedding",
      }),
      "/leads",
    );
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
        defaultHref: "/leads",
        sessionHref: null,
      }),
      "/leads",
    );
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/leads",
        search: "?eventType=wedding",
        defaultHref: "/leads",
        sessionHref: "/leads?stage=tour",
      }),
      "/leads?eventType=wedding",
    );
  });

  it("restores progressive rows only when fingerprint and server prefix match", () => {
    const session = buildLeadsListSession({
      href: "/leads?eventType=wedding",
      fingerprint: "||wedding|newest|all|active",
      leadIds: ["a", "b", "c", "d"],
      scrollY: 240,
      now: Date.now(),
    });
    assert.equal(
      shouldRestoreProgressiveSession({
        session,
        urlFingerprint: "||wedding|newest|all|active",
        serverFirstIds: ["a", "b"],
        pageSize: 20,
      }),
      true,
    );
    assert.equal(
      shouldRestoreProgressiveSession({
        session,
        urlFingerprint: "||wedding|newest|all|active",
        serverFirstIds: ["z", "b"],
        pageSize: 20,
      }),
      false,
      "new lead at top must invalidate progressive restore",
    );
    assert.equal(
      shouldRestoreProgressiveSession({
        session,
        urlFingerprint: "q||wedding|newest|all|active",
        serverFirstIds: ["a", "b"],
        pageSize: 20,
      }),
      false,
    );
  });

  it("round-trips session JSON and rejects detail hrefs", () => {
    const session = buildLeadsListSession({
      href: "/leads?stage=tour",
      fingerprint: "|tour||newest|all|active",
      leadIds: ["x"],
      scrollY: 0,
      now: Date.now(),
    });
    const parsed = parseLeadsListSession(serializeLeadsListSession(session));
    assert.deepEqual(parsed, session);
    assert.equal(
      parseLeadsListSession(
        serializeLeadsListSession({
          ...session,
          href: "/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
        }),
      ),
      null,
    );
  });
});
