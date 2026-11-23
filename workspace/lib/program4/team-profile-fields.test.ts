import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  composeDisplayName,
  initialsFromDisplayName,
  splitDisplayName,
} from "./team-profile-fields";

describe("team profile display name helpers", () => {
  it("splits and recomposes first/last without inventing a separate displayName field", () => {
    assert.deepEqual(splitDisplayName("Jennifer Marshall"), {
      firstName: "Jennifer",
      lastName: "Marshall",
    });
    assert.equal(composeDisplayName("Jennifer", "Cormier"), "Jennifer Cormier");
    assert.equal(initialsFromDisplayName("Jennifer Cormier"), "JC");
  });

  it("does not auto-rename a single-token seed name", () => {
    assert.deepEqual(splitDisplayName("Jennifer"), {
      firstName: "Jennifer",
      lastName: "",
    });
    assert.equal(composeDisplayName("Jennifer", ""), "Jennifer");
  });
});
