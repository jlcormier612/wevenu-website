/**
 * Hello to Cheers — Starter Brochure (BR-01).
 *
 * Editorial shell only. Packages and FAQs are resolved live at render time
 * from the venue's own catalog/guide — never copied into the brochure row.
 * Share token exists by existing architecture but is not emailed/shared on seed.
 */
export type BrochureStarterMasterKey = "BR-01";

export type BrochureStarterMaster = {
  key: BrochureStarterMasterKey;
  name: string;
  welcomeText: string;
  includePackages: boolean;
  includeFaqs: boolean;
  closingText: string;
};

export const BROCHURE_STARTER_MASTERS: readonly BrochureStarterMaster[] = [
  {
    key: "BR-01",
    name: "Venue Overview",
    welcomeText:
      "Welcome — this is a starting brochure from Hello to Cheers. Customize the wording, then share it when you're ready. Packages and FAQs you choose to include come from your venue's Library (only published FAQs appear).",
    includePackages: true,
    // Live FAQ render already filters to published — starters seed unpublished.
    includeFaqs: true,
    closingText:
      "Ready to learn more? Reach out to our team to schedule a tour or ask about available dates.",
  },
] as const;

export function getBrochureStarterMaster(key: string): BrochureStarterMaster | undefined {
  return BROCHURE_STARTER_MASTERS.find((m) => m.key === key);
}

export function shouldSkipBrochureStarterProvision(opts: {
  masterKey: string;
  masterName: string;
  existingByKey: Set<string>;
  existingNames: Set<string>;
}): "skip_key" | "skip_name" | "create" {
  if (opts.existingByKey.has(opts.masterKey)) return "skip_key";
  if (opts.existingNames.has(opts.masterName)) return "skip_name";
  return "create";
}
