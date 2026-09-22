import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { contrastRatio, inkOn, publicFormSurfaceStyle, readableInk } from "@/lib/theme/public-form-surface";

const ROOT = join(__dirname, "../..");

describe("public form contrast", () => {
  it("picks ink that meets 4.5:1 on sage and on a light pink brand", () => {
    const sage = "#5D6F5D";
    const pink = "#FF4FA3";
    const onSage = inkOn(sage);
    const onPink = inkOn(pink);
    assert.ok((contrastRatio(onSage, sage) ?? 0) >= 4.5);
    assert.ok((contrastRatio(onPink, pink) ?? 0) >= 4.5);
    assert.equal(onSage, "#ffffff");
    assert.equal(onPink, "#000000");
  });

  it("keeps a dark preferred ink and replaces a faint one", () => {
    assert.equal(readableInk("#4f5f4f", "#ffffff"), "#4f5f4f");
    assert.notEqual(readableInk("#d1d5db", "#ffffff"), "#d1d5db");
    assert.ok((contrastRatio(readableInk("#d1d5db", "#ffffff"), "#ffffff") ?? 0) >= 4.5);
  });

  it("locks the public inquiry form to the light surface and explicit slot ink", () => {
    const form = readFileSync(join(ROOT, "components/form/inquiry-form.tsx"), "utf8");
    assert.match(form, /data-theme-lock="light"/);
    assert.match(form, /publicFormSurfaceStyle/);
    assert.match(form, /inkOn\(primary\)/);
    assert.match(form, /text-muted-foreground/);
    assert.doesNotMatch(form, /text-gray-/);
    assert.doesNotMatch(form, /text-white\/70/);
    const slots = form.slice(form.indexOf("tourSlotsForDate.map"), form.indexOf("fieldErrors.tourSlot"));
    assert.match(slots, /color: inkOn\(primary\)/);
    assert.match(slots, /color: "var\(--foreground\)"/);
    assert.doesNotMatch(slots, /opacity-60/);
  });

  it("uses configured venue Neutral for the branded page surface when provided", () => {
    const style = publicFormSurfaceStyle({
      primary: "#FF1493",
      secondary: "#00BFFF",
      accent: "#FF00FF",
      neutral: "#FFF0F5",
    });
    assert.equal(style.backgroundColor, "#FFF0F5");
  });
});
