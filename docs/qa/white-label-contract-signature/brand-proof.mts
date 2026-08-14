/**
 * Prove conversation HTML wrapper includes venue primary + name (same helper as Send).
 * Usage: npx tsx docs/qa/white-label-contract-signature/brand-proof.mts
 */
import { wrapConversationMessageHtml } from "../../../lib/email/conversation-brand.ts";
import { resolvePdfBrandColors } from "../../../lib/collateral/pdf-brand.ts";

const venue = {
  name: process.env.QA_VENUE_NAME ?? "Sweet Daisy Barn & Farm",
  logoUrl: process.env.QA_VENUE_LOGO ?? null,
  primaryColor: process.env.QA_VENUE_PRIMARY ?? "#5D6F5D",
};
const body = process.env.QA_BODY ?? "QA white-label brand check — plain text body.";

const html = wrapConversationMessageHtml(
  { name: venue.name, logoUrl: venue.logoUrl, primaryColor: venue.primaryColor },
  body,
);

const pdf = resolvePdfBrandColors({
  primaryColor: "#ABCDEF",
  secondaryColor: "#112233",
  accentColor: "#445566",
});

// Venue names with & are HTML-escaped in the wrapper.
const escapedName = venue.name
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const result = {
  okPrimary: html.includes(venue.primaryColor),
  okName: html.includes(escapedName),
  okBody: html.includes(body.slice(0, 24)),
  okLogo: venue.logoUrl ? html.includes(String(venue.logoUrl)) : true,
  noHtc: !/hello\s*to\s*cheers/i.test(html),
  htmlLen: html.length,
  sample: html.slice(0, 280),
  pdf,
};

console.log(JSON.stringify(result));
process.exit(result.okPrimary && result.okName && result.okBody && result.noHtc ? 0 : 1);
