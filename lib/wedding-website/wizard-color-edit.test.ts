import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyColorRoleEdit,
  resolveColorStorySaveRoles,
} from "@/lib/wedding-website/wizard-color-edit";

const seeded = {
  colorPrimary: "#111111",
  colorSecondary: "#222222",
  colorAccent: "#333333",
  colorNeutral: "#444444",
  colorBackground: "#555555",
  colorText: "#666666",
};

describe("applyColorRoleEdit", () => {
  it("seeds all six roles from the curated story when diverging on first edit", () => {
    const next = applyColorRoleEdit({
      current: {
        colorPrimary: "",
        colorSecondary: "",
        colorAccent: "",
        colorNeutral: "",
        colorBackground: "",
        colorText: "",
      },
      seeded,
      role: "colorAccent",
      nextHex: "#FF0000",
    });
    assert.equal(next.colorPrimary, "#111111");
    assert.equal(next.colorSecondary, "#222222");
    assert.equal(next.colorAccent, "#FF0000");
    assert.equal(next.colorNeutral, "#444444");
    assert.equal(next.colorBackground, "#555555");
    assert.equal(next.colorText, "#666666");
  });

  it("preserves existing custom values for untouched roles", () => {
    const next = applyColorRoleEdit({
      current: {
        colorPrimary: "#AAAAAA",
        colorSecondary: "#BBBBBB",
        colorAccent: "#CCCCCC",
        colorNeutral: "#DDDDDD",
        colorBackground: "#EEEEEE",
        colorText: "#FFFFFF",
      },
      seeded,
      role: "colorPrimary",
      nextHex: "#0000FF",
    });
    assert.equal(next.colorPrimary, "#0000FF");
    assert.equal(next.colorSecondary, "#BBBBBB");
    assert.equal(next.colorText, "#FFFFFF");
  });
});

describe("resolveColorStorySaveRoles", () => {
  it("fills missing custom roles from the curated seed for persistence", () => {
    const roles = resolveColorStorySaveRoles({
      custom: { colorPrimary: "#ABCDEF" },
      seeded,
    });
    assert.equal(roles.colorPrimary, "#ABCDEF");
    assert.equal(roles.colorSecondary, "#222222");
    assert.equal(roles.colorText, "#666666");
  });
});
