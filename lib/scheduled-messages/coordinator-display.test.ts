import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  formatCoordinatorDisplayName,
  pickOwnerStaffForCoordinator,
} from "@/lib/scheduled-messages/coordinator-display";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";

describe("coordinator display for email signatures", () => {
  it("formats owner name with title", () => {
    assert.equal(formatCoordinatorDisplayName("Jen Fancy", "Owner"), "Jen Fancy, Owner");
    assert.equal(formatCoordinatorDisplayName("Jennifer Fancy", "Owner"), "Jennifer Fancy, Owner");
    assert.equal(formatCoordinatorDisplayName("Jordan Blake", null), "Jordan Blake");
    assert.equal(formatCoordinatorDisplayName("", "Owner"), "");
  });

  it("prefers accepted linked owner over pending owner invite", () => {
    const pick = pickOwnerStaffForCoordinator([
      {
        full_name: "Ron Cormier",
        title: null,
        accepted_at: null,
        owner_invite_pending: true,
        user_id: null,
      },
      {
        full_name: "Jennifer Fancy",
        title: "Owner",
        accepted_at: "2026-09-22T00:27:26.23007+00:00",
        owner_invite_pending: false,
        user_id: "2fa73101-337b-4530-8c77-f3c272c5463e",
      },
    ]);
    assert.deepEqual(pick, { full_name: "Jennifer Fancy", title: "Owner" });
    assert.equal(
      formatCoordinatorDisplayName(pick!.full_name, pick!.title),
      "Jennifer Fancy, Owner",
    );
  });
});

describe("tour / starter email merge regression (Betty Rubble)", () => {
  const warmlyTemplate = [
    "Hi {{first_name}},",
    "",
    "We're looking forward to welcoming you.",
    "",
    "Warmly,",
    "{{coordinator_name}}",
    "{{venue_name}}",
  ].join("\n");

  it("greeting uses first name only — not full contact name", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientName: "Betty Rubble",
      clientFirstName: "Betty",
      clientLastName: "Rubble",
      coordinatorName: "Jennifer Fancy, Owner",
      eventDate: null,
    });
    const body = mergeContent(warmlyTemplate, data);
    assert.match(body, /^Hi Betty,/m);
    assert.doesNotMatch(body, /Hi Betty Rubble,/);
  });

  it("signature uses owner display once and venue name once — no duplicated venue", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientName: "Betty Rubble",
      clientFirstName: "Betty",
      clientLastName: "Rubble",
      coordinatorName: "Jennifer Fancy, Owner",
      eventDate: null,
    });
    const body = mergeContent(warmlyTemplate, data);
    assert.match(body, /Warmly,\nJennifer Fancy, Owner\nJen's Fancy Venue$/);
    const venueHits = body.match(/Jen's Fancy Venue/g) ?? [];
    assert.equal(venueHits.length, 1, "venue name must appear exactly once in signature block body");
  });

  it("a coordinator that is only the venue name does not repeat the venue", () => {
    const body = mergeContent(
      warmlyTemplate,
      buildMergeData({
        venueName: "Lulu Lodge",
        clientName: "Nicole Bethune",
        clientFirstName: "Nicole",
        clientLastName: "Bethune",
        coordinatorName: "Lulu Lodge",
        eventDate: null,
      }),
    );
    assert.match(body, /Warmly,\n\nLulu Lodge$/);
    assert.equal((body.match(/Lulu Lodge/g) ?? []).length, 1);
  });

  it("merge context owner lookup no longer uses bare maybeSingle on is_owner", () => {
    const src = readFileSync(resolve("lib/scheduled-messages/repository.ts"), "utf8");
    assert.match(src, /pickOwnerStaffForCoordinator/);
    assert.match(src, /formatCoordinatorDisplayName/);
    assert.doesNotMatch(
      src,
      /\.eq\("is_owner", true\)\.maybeSingle/,
    );
  });

  it("starter masters greet with first_name", () => {
    const src = readFileSync(resolve("lib/message-templates/starters.ts"), "utf8");
    assert.match(src, /Hi \{\{first_name\}\},/);
    assert.doesNotMatch(src, /Hi \{\{client_name\}\},/);
  });
});
