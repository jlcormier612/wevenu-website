import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const root = path.join(__dirname);

describe("CRM team member profile editor (founder-review)", () => {
  it("exposes personal name/contact fields and keeps auth email read-only when linked", () => {
    const page = readFileSync(path.join(root, "[id]/page.tsx"), "utf8");
    assert.match(page, /name="firstName"/);
    assert.match(page, /name="lastName"/);
    assert.match(page, /name="department"/);
    assert.match(page, /Personal information/);
    assert.match(page, /Professional information/);
    assert.match(page, /authLinkedEmail/);
    assert.match(page, /cannot be changed[\s\S]*from the CRM profile editor/);
  });

  it("update action never rewrites ACL login email and syncs display name only", () => {
    const actions = readFileSync(path.join(root, "actions.ts"), "utf8");
    assert.match(actions, /composeDisplayName/);
    assert.match(actions, /getByTeamMemberId/);
    assert.match(actions, /displayName: name/);
    assert.match(actions, /authLinkedEmail/);
    assert.doesNotMatch(actions, /auth\.admin|updateUserById|auth\.updateUser/);
  });

  it("Jennifer Marshall remains the intentional bootstrap seed name", () => {
    const seed = readFileSync(
      path.join(root, "../../../lib/program4/seed.ts"),
      "utf8",
    );
    assert.match(seed, /id: "tm_jen"/);
    assert.match(seed, /name: "Jennifer Marshall"/);
    assert.match(seed, /email: "jennifer@hellotocheers\.com"/);
  });
});
