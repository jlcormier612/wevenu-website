import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pageIdsFromGranularScopes } from "@/lib/facebook/page-discovery";

describe("pageIdsFromGranularScopes", () => {
  it("collects Page target IDs from pages_* and leads_retrieval scopes", () => {
    const ids = pageIdsFromGranularScopes([
      { scope: "pages_show_list", target_ids: [111, 222] },
      { scope: "pages_manage_metadata", target_ids: [222] },
      { scope: "leads_retrieval", target_ids: [333] },
      { scope: "email", target_ids: [999] },
    ]);
    assert.deepEqual(ids.sort(), ["111", "222", "333"]);
  });

  it("returns empty when no page-related granular scopes exist", () => {
    assert.deepEqual(pageIdsFromGranularScopes([{ scope: "public_profile" }]), []);
    assert.deepEqual(pageIdsFromGranularScopes(undefined), []);
  });
});
