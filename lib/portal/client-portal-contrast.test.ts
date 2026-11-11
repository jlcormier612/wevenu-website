import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { contrastRatio, inkOn } from "@/lib/theme/public-form-surface";

const ROOT = join(__dirname, "../..");

describe("client portal contrast — questionnaire + documents", () => {
  it("questionnaire form uses theme tokens and brand-safe submit ink (no hardcoded gray text)", () => {
    const form = readFileSync(join(ROOT, "components/form/couple-family-questionnaire-form.tsx"), "utf8");
    assert.doesNotMatch(form, /text-gray-/);
    assert.doesNotMatch(form, /border-gray-/);
    assert.doesNotMatch(form, /bg-gray-/);
    assert.match(form, /text-foreground/);
    assert.match(form, /text-muted-foreground/);
    assert.match(form, /border-input/);
    assert.match(form, /bg-background/);
    assert.match(form, /inkOn\(primary\)/);
    assert.match(form, /placeholder:text-muted-foreground/);
  });

  it("submit ink meets WCAG AA on light and dark brand primaries", () => {
    const lightBrand = "#FF4FA3";
    const darkBrand = "#5D6F5D";
    const onLight = inkOn(lightBrand);
    const onDark = inkOn(darkBrand);
    assert.ok((contrastRatio(onLight, lightBrand) ?? 0) >= 4.5);
    assert.ok((contrastRatio(onDark, darkBrand) ?? 0) >= 4.5);
  });

  it("documents upload controls use readable foreground and accessible checkbox/button treatment", () => {
    const docs = readFileSync(join(ROOT, "components/portal/couple-documents-section.tsx"), "utf8");
    assert.doesNotMatch(docs, /text-gray-500/);
    assert.doesNotMatch(docs, /hover:text-gray-700/);
    assert.match(docs, /Event insurance/);
    assert.match(docs, /Share with venue/);
    assert.match(docs, /data-testid="portal-upload-document"/);
    assert.match(docs, /aria-label="Event insurance"/);
    assert.match(docs, /accent-primary/);
    assert.match(docs, /text-foreground/);
    assert.match(docs, /border-border bg-background text-foreground/);
  });
});
