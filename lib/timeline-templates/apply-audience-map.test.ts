import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { mapTemplateAudiencesForVenueOwnedApply } from "@/lib/timeline-templates/apply";

describe("Timeline template apply — venue-owned audience mapping", () => {
  it("maps legacy template audience 'venue' to venue-private (empty)", () => {
    assert.deepEqual(mapTemplateAudiencesForVenueOwnedApply(["venue"]), []);
  });

  it("keeps valid venue-owned audiences (client, vendors)", () => {
    assert.deepEqual(mapTemplateAudiencesForVenueOwnedApply(["client", "vendors"]), ["client", "vendors"]);
    assert.deepEqual(mapTemplateAudiencesForVenueOwnedApply(["client", "venue"]), ["client"]);
  });

  it("leaves omitted audiences undefined so insert defaults apply", () => {
    assert.equal(mapTemplateAudiencesForVenueOwnedApply(undefined), undefined);
  });

  it("apply paths pass mapped audiences into addEntry / addClientEntry", () => {
    const src = readFileSync(resolve("lib/timeline-templates/apply.ts"), "utf8");
    assert.match(src, /mapTemplateAudiencesForVenueOwnedApply\(item\.audiences\)/);
    assert.match(src, /addEntry\(/);
    assert.match(src, /addClientEntry\(/);
  });
});
