/**
 * Task category label ink must meet WCAG 2.2 AA on the surfaces where labels
 * actually render (light cards + dark staff sage panels).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TASK_CATEGORIES,
  categoryLabelInkDark,
  categoryLabelInkLight,
  categoryLabelStyle,
} from "@/lib/playbooks/constants";
import { contrastRatio } from "@/lib/theme/public-form-surface";

const LIGHT_SURFACES = ["#ffffff", "#f7f5f1", "#b9d1c2", "#fefefc"] as const;
/** Dark staff: forest background + heritage card (see app/globals.css .dark .htc-staff). */
const DARK_SURFACES = ["#4f5f4f", "#5d6f5d"] as const;

describe("task category label contrast", () => {
  it("every category labelInkLight clears 4.5:1 on light product surfaces", () => {
    for (const cat of TASK_CATEGORIES) {
      const ink = categoryLabelInkLight(cat.value);
      for (const bg of LIGHT_SURFACES) {
        const ratio = contrastRatio(ink, bg) ?? 0;
        assert.ok(
          ratio >= 4.5,
          `${cat.value} light ink ${ink} on ${bg}: ${ratio.toFixed(2)}:1`,
        );
      }
    }
  });

  it("every category labelInkDark clears 4.5:1 on dark staff sage surfaces", () => {
    for (const cat of TASK_CATEGORIES) {
      const ink = categoryLabelInkDark(cat.value);
      for (const bg of DARK_SURFACES) {
        const ratio = contrastRatio(ink, bg) ?? 0;
        assert.ok(
          ratio >= 4.5,
          `${cat.value} dark ink ${ink} on ${bg}: ${ratio.toFixed(2)}:1`,
        );
      }
    }
  });

  it("legacy decorative swatches used as text fail on dark heritage (banned pattern)", () => {
    // Planning was #4F5F4F (forest) on heritage card — the screenshot defect.
    const planningSwatch = TASK_CATEGORIES.find((c) => c.value === "planning")!.color;
    assert.equal(planningSwatch, "#4F5F4F");
    assert.ok((contrastRatio(planningSwatch, "#5d6f5d") ?? 0) < 4.5);
  });

  it("categoryLabelStyle wires light color + dark CSS variable override", () => {
    const props = categoryLabelStyle("planning");
    assert.equal(props.style.color, categoryLabelInkLight("planning"));
    assert.equal(props.style["--category-label-ink-dark"], categoryLabelInkDark("planning"));
    assert.match(props.className, /dark:!text-\[color:var\(--category-label-ink-dark\)\]/);
  });
});
