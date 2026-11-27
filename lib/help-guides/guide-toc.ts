/**
 * Shared “In this guide” TOC classification for integration setup Help articles.
 * Primary = major steps / primary sections shown when collapsed.
 * Secondary = detailed subsections kept in the article; listed only when expanded.
 */

export type GuideTocHeading = { id: string; text: string };

/** Major instructional steps and primary sections — shown in the compact TOC. */
export function isPrimaryGuideTocHeading(text: string): boolean {
  const t = text.trim();
  if (/^Step\s+\d+\s+[—–-]/i.test(t)) return true;
  if (/^Before you begin$/i.test(t)) return true;
  if (/^What you'?ll need$/i.test(t)) return true;
  if (/^Understanding your Meta accounts$/i.test(t)) return true;
  if (/^Option [AB]\s+[—–-]/i.test(t)) return true;
  if (/^What happens next\??$/i.test(t)) return true;
  if (/^What information syncs with QuickBooks\??$/i.test(t)) return true;
  if (/^Working with Hello to Cheers and QuickBooks together$/i.test(t)) return true;
  if (/^Checking your connection and sync activity$/i.test(t)) return true;
  if (/^Checking your texting status$/i.test(t)) return true;
  if (/^Managing your connected forms$/i.test(t)) return true;
  if (/^Managing your incoming inquiries$/i.test(t)) return true;
  if (/^Managing texting consent$/i.test(t)) return true;
  if (/^Updating your inquiry form$/i.test(t)) return true;
  if (/^Forwarding individual inquiries$/i.test(t)) return true;
  if (/^A few good texting practices$/i.test(t)) return true;
  if (/^Troubleshooting( your connection)?$/i.test(t)) return true;
  if (/^How it works$/i.test(t)) return true;
  if (/^Keep sharing\. Keep earning\.$/i.test(t)) return true;
  if (/^Track your referrals$/i.test(t)) return true;
  if (/^A few things to know$/i.test(t)) return true;
  if (/^Frequently asked questions$/i.test(t)) return true;
  if (/^Additional\b/i.test(t)) return true;
  if (/^Completing Google'?s verification in Hello to Cheers$/i.test(t)) return true;
  if (/^Bringing over existing inquiries$/i.test(t)) return true;
  return false;
}

export function splitGuideTocHeadings(headings: GuideTocHeading[]): {
  primary: GuideTocHeading[];
  secondary: GuideTocHeading[];
} {
  const primary: GuideTocHeading[] = [];
  const secondary: GuideTocHeading[] = [];
  for (const h of headings) {
    if (isPrimaryGuideTocHeading(h.text)) primary.push(h);
    else secondary.push(h);
  }
  // Safety: never collapse to an empty TOC when headings exist.
  if (primary.length === 0 && headings.length > 0) {
    return { primary: headings, secondary: [] };
  }
  return { primary, secondary };
}
