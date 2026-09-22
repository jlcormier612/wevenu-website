/**
 * Brand Colors rendering contract: configured colors must be consumed
 * (not merely exposed as unused CSS variables) on promised surfaces.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { publicFormSurfaceStyle } from "@/lib/theme/public-form-surface";
import { emailBrandFromVenue, renderBrandedEmailHtml } from "@/lib/email/venue-brand";
import { resolvePdfBrandColors } from "@/lib/collateral/pdf-brand";

const ROOT = resolve(__dirname, "../..");

const SAMPLE = {
  primary: "#FF1493",
  secondary: "#00BFFF",
  accent: "#FF00FF",
  neutral: "#FFF0F5",
};

describe("Brand Colors — brochure HTML consumes the venue palette", () => {
  const src = readFileSync(resolve(ROOT, "components/brochures/brochure-preview-view.tsx"), "utf8");

  it("sets and consumes Primary, Secondary, Accent, and Neutral", () => {
    assert.match(src, /--venue-primary/);
    assert.match(src, /--venue-secondary/);
    assert.match(src, /--venue-accent/);
    assert.match(src, /--venue-neutral/);
    assert.match(src, /backgroundColor:\s*"var\(--venue-neutral\)"/);
    assert.match(src, /borderBottomColor:\s*"var\(--venue-primary\)"/);
    assert.match(src, /color:\s*"var\(--venue-secondary\)"/);
    assert.match(src, /color:\s*"var\(--venue-accent\)"/);
    assert.match(src, /borderBottom:\s*"1px solid var\(--venue-secondary\)"/);
  });

  it("loads Neutral into BrochureRenderData (authenticated + public)", () => {
    const types = readFileSync(resolve(ROOT, "lib/brochures/types.ts"), "utf8");
    const service = readFileSync(resolve(ROOT, "lib/brochures/service.ts"), "utf8");
    assert.match(types, /neutralColor:\s*string/);
    assert.match(service, /neutralColor:\s*venue\.neutralColor/);
    assert.match(service, /neutral_color/);
  });

  it("does not hardcode Jen's Fancy swatches", () => {
    assert.doesNotMatch(src, /#FF1493|#00BFFF|#FF00FF|#FFF0F5/i);
  });
});

describe("Brand Colors — contract HTML consumes intended palette", () => {
  const src = readFileSync(resolve(ROOT, "components/contracts/contract-signing-artifact.tsx"), "utf8");

  it("consumes Primary, Secondary, Accent, and Neutral beyond unused CSS vars", () => {
    assert.match(src, /backgroundColor:\s*"var\(--venue-neutral\)"/);
    assert.match(src, /borderTopColor:\s*"var\(--venue-primary\)"/);
    assert.match(src, /color:\s*"var\(--venue-secondary\)"/);
    assert.match(src, /backgroundColor:\s*"var\(--venue-accent\)"/);
  });

  it("remains styling-only (no signing lifecycle changes)", () => {
    assert.doesNotMatch(src, /signContract|content_hash|awaiting.?venue/i);
  });
});

describe("Brand Colors — proposal renderer consumes venue palette", () => {
  const src = readFileSync(resolve(ROOT, "components/booking-journey/proposal-artifact.tsx"), "utf8");

  it("consumes Primary, Secondary, Accent, and Neutral", () => {
    assert.match(src, /--venue-primary/);
    assert.match(src, /backgroundColor:\s*"var\(--venue-neutral\)"/);
    assert.match(src, /borderBottom:.*var\(--venue-primary\)/);
    assert.match(src, /color:\s*"var\(--venue-secondary\)"/);
    assert.match(src, /color:\s*"var\(--venue-accent\)"/);
  });

  it("loads brand from offer token path and journey preview", () => {
    const offer = readFileSync(resolve(ROOT, "lib/booking-journey/offer.ts"), "utf8");
    const panel = readFileSync(resolve(ROOT, "components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.match(offer, /primary_color,\s*secondary_color,\s*accent_color,\s*neutral_color/);
    assert.match(offer, /offer\.brand\s*=/);
    assert.match(panel, /proposalViewFromSelection\(selection,\s*offerMessage,\s*journey\.brand\)/);
  });
});

describe("Brand Colors — public /book uses configured Neutral (not HTC cream)", () => {
  it("publicFormSurfaceStyle paints venue Neutral when provided", () => {
    const style = publicFormSurfaceStyle({
      primary: SAMPLE.primary,
      secondary: SAMPLE.secondary,
      accent: SAMPLE.accent,
      neutral: SAMPLE.neutral,
    });
    assert.equal(style.backgroundColor, SAMPLE.neutral);
    assert.notEqual(style.backgroundColor, "#F7F5F1");
    assert.equal((style as Record<string, string>)["--heading"], SAMPLE.secondary);
    assert.equal((style as Record<string, string>)["--ring"], SAMPLE.accent);
  });

  it("inquiry form and service wire accent + neutral from venue columns", () => {
    const form = readFileSync(resolve(ROOT, "components/form/inquiry-form.tsx"), "utf8");
    const service = readFileSync(resolve(ROOT, "lib/inquiry-form/service.ts"), "utf8");
    const types = readFileSync(resolve(ROOT, "lib/inquiry-form/types.ts"), "utf8");
    assert.match(types, /accentColor:\s*string/);
    assert.match(types, /neutralColor:\s*string/);
    assert.match(service, /accent_color,\s*neutral_color|neutral_color/);
    assert.match(form, /publicFormSurfaceStyle\(formBrand\)/);
    assert.match(form, /data-venue-brand="public-book"/);
    assert.match(form, /accent=\{accent\}/);
  });
});

describe("Brand Colors — email remains Primary-only", () => {
  it("email brand type and shell use only primaryColor", () => {
    const brand = emailBrandFromVenue({
      name: "Sample",
      primaryColor: SAMPLE.primary,
    });
    assert.equal(brand.primaryColor, SAMPLE.primary);
    assert.ok(!("secondaryColor" in brand));
    assert.ok(!("accentColor" in brand));
    assert.ok(!("neutralColor" in brand));
    const html = renderBrandedEmailHtml(brand, "<p>Hi</p>");
    assert.match(html, /#FF1493/);
    assert.doesNotMatch(html, /#00BFFF|#FF00FF|#FFF0F5/i);
  });

  const src = readFileSync(resolve(ROOT, "lib/email/venue-brand.ts"), "utf8");
  it("documents Primary-only ceiling", () => {
    assert.match(src, /Primary only/);
    assert.match(src, /Secondary \/ Accent \/ Neutral are not used/);
  });
});

describe("Brand Colors — PDF brochure Secondary does not regress; Neutral/Accent reach PDF", () => {
  it("resolvePdfBrandColors preserves all four roles", () => {
    const colors = resolvePdfBrandColors({
      primaryColor: SAMPLE.primary,
      secondaryColor: SAMPLE.secondary,
      accentColor: SAMPLE.accent,
      neutralColor: SAMPLE.neutral,
    });
    assert.deepEqual(colors, {
      primary: SAMPLE.primary,
      secondary: SAMPLE.secondary,
      accent: SAMPLE.accent,
      neutral: SAMPLE.neutral,
    });
  });

  it("brochure PDF still styles section heads with Secondary and uses Neutral/Accent", () => {
    const pdf = readFileSync(resolve(ROOT, "lib/brochures/pdf.ts"), "utf8");
    assert.match(pdf, /color:\s*brand\.secondary/);
    assert.match(pdf, /borderBottomColor:\s*brand\.secondary/);
    assert.match(pdf, /backgroundColor:\s*brand\.neutral/);
    assert.match(pdf, /color:\s*brand\.accent/);
  });
});

describe("Brand Colors — invoice Accent/Neutral do not regress; Secondary is consumed", () => {
  const src = readFileSync(resolve(ROOT, "components/invoices/invoice-print-document.tsx"), "utf8");

  it("keeps Accent amounts and Neutral section backgrounds", () => {
    assert.match(src, /background:\s*neutralColor/);
    assert.match(src, /color:\s*accentColor/);
  });

  it("renders Secondary on the Charges section head", () => {
    assert.match(src, /color:\s*secondaryColor/);
    assert.match(src, /Charges/);
  });
});

describe("Brand Colors — Wedding Website Color Story stays separate", () => {
  it("brochure/contract/proposal/inquiry do not import couple website color story", () => {
    const files = [
      "components/brochures/brochure-preview-view.tsx",
      "components/contracts/contract-signing-artifact.tsx",
      "components/booking-journey/proposal-artifact.tsx",
      "components/form/inquiry-form.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(ROOT, f), "utf8");
      assert.doesNotMatch(src, /color_story|ColorStory|couple_websites|color_primary/);
    }
  });
});

describe("Brand Colors — vendor hero Primary+Secondary unchanged", () => {
  it("vendor-venue-hero still gradients secondary → primary", () => {
    const src = readFileSync(resolve(ROOT, "components/vendor-app/vendor-venue-hero.tsx"), "utf8");
    assert.match(src, /linear-gradient/);
    assert.match(src, /secondaryColor/);
    assert.match(src, /primaryColor/);
  });
});

describe("Brand Colors — no second branding system introduced", () => {
  it("reuses venue columns / resolvePdfBrandColors / ContractBrandingSnapshot", () => {
    const brochure = readFileSync(resolve(ROOT, "components/brochures/brochure-preview-view.tsx"), "utf8");
    const contract = readFileSync(resolve(ROOT, "components/contracts/contract-signing-artifact.tsx"), "utf8");
    assert.match(contract, /ContractBrandingSnapshot/);
    assert.doesNotMatch(brochure, /createBrandTheme|BrandThemeProvider|secondBrand/);
    assert.doesNotMatch(contract, /createBrandTheme|BrandThemeProvider/);
  });
});
