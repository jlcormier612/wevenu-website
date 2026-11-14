/**
 * Library Send page wires grouped commercial guidance.
 * Placed next to the Library Event Order Templates route so the existing
 * hospitality PR checks run on this commercial-readiness follow-up.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = join(process.cwd());

describe("Library Event Order Templates send completeness", () => {
  it("the Library page mounts the list that shows grouped send guidance", () => {
    const page = readFileSync(
      join(root, "app/(app)/library/event-order-templates/page.tsx"),
      "utf8",
    );
    const list = readFileSync(
      join(root, "components/event-order-templates/event-order-template-list.tsx"),
      "utf8",
    );
    assert.match(page, /EventOrderTemplateList/);
    assert.match(list, /EventOrderCompletenessGuidance/);
    assert.match(list, /eo-library-send-incomplete/);
  });
});
