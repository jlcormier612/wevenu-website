import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/** Strip block/line comments so mentions in safety notes don't fail the pin. */
function codeWithoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("dropdown identity rows avoid bare DropdownMenuLabel", () => {
  it("UserMenu does not import or render DropdownMenuLabel (Base UI #31)", () => {
    const code = codeWithoutComments(
      readFileSync(resolve("components/shell/user-menu.tsx"), "utf8"),
    );
    assert.doesNotMatch(code, /DropdownMenuLabel/);
    assert.match(code, /Sign out/);
    assert.match(code, /signOut/);
    assert.match(code, /\{email\}/);
  });

  it("Venue Guide FAQ starter menu does not import or render DropdownMenuLabel (Base UI #31)", () => {
    const code = codeWithoutComments(
      readFileSync(resolve("components/guide/venue-guide-editor.tsx"), "utf8"),
    );
    assert.doesNotMatch(code, /DropdownMenuLabel/);
    assert.match(code, /Hello to Cheers starters/);
  });
});
