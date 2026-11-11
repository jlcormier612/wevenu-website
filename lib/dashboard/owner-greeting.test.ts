import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { resolveDashboardGreetingFirstName } from "./owner-greeting.ts";

describe("dashboard greeting — authenticated user first name", () => {
  it("uses the authenticated staff first name when known", () => {
    assert.equal(
      resolveDashboardGreetingFirstName({
        fullName: "Jennifer Cormier",
        venueName: "Jen's Fancy Venue",
      }),
      "Jennifer",
    );
  });

  it("returns null when no usable first name exists (safe generic greeting)", () => {
    assert.equal(resolveDashboardGreetingFirstName({ fullName: null }), null);
    assert.equal(resolveDashboardGreetingFirstName({ fullName: "" }), null);
    assert.equal(resolveDashboardGreetingFirstName({ fullName: "   " }), null);
  });

  it("does not use an email address as the displayed name", () => {
    assert.equal(
      resolveDashboardGreetingFirstName({
        fullName: "jennifer@hellotocheers.com",
        venueName: "Test Venue",
      }),
      null,
    );
    assert.equal(
      resolveDashboardGreetingFirstName({
        fullName: "jennifer@hellotocheers.com Jennifer",
        venueName: "Test Venue",
      }),
      null,
    );
  });

  it("does not derive a person name from the venue name", () => {
    assert.equal(
      resolveDashboardGreetingFirstName({
        fullName: "Sunrise Barn",
        venueName: "Sunrise Barn",
      }),
      null,
    );
    assert.equal(
      resolveDashboardGreetingFirstName({
        fullName: null,
        venueName: "Sunrise Barn",
      }),
      null,
    );
  });

  it("wires getDashboardData to authenticated staff, not preferred-owner rows", () => {
    const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
    assert.match(service, /resolveDashboardGreetingFirstName/);
    assert.match(service, /getCurrentStaffMember/);
    assert.doesNotMatch(service, /resolveDashboardOwnerFirstName/);
    assert.doesNotMatch(
      service,
      /\.eq\(\s*["']is_owner["']\s*,\s*true\s*\)\s*\n?\s*\.maybeSingle/,
    );
  });

  it("Greeting keeps time-of-day behavior and name personalization", () => {
    const greeting = readFileSync(resolve("components/dashboard/greeting.tsx"), "utf8");
    assert.match(greeting, /Good morning/);
    assert.match(greeting, /Good afternoon/);
    assert.match(greeting, /Good evening/);
    assert.match(greeting, /ownerFirstName \? `\$\{tod\}, \$\{ownerFirstName\}\.`/);
    assert.match(greeting, /: `\$\{tod\}\.`/);
  });
});
