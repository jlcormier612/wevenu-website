/**
 * Work Package D7B — the Brochure PDF. Third @react-pdf/renderer generator
 * in this codebase (after Contracts/D4, Event Orders/D5C) — same styling
 * constants, same header/footer pattern, same lineHeight gotcha avoided
 * (never set at the page level, only on specific text blocks — a
 * page-level lineHeight was found to corrupt pagination math for `fixed`
 * elements in both prior generators).
 *
 * Generated on-demand, never stored — a Brochure has no finalize/lock
 * concept (unlike a signed Contract or a finalized Event Order), so
 * "always render current data" is the correct behavior, not a gap.
 */
import * as React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import type { BrochureRenderData } from "@/lib/brochures/types";

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10.5, fontFamily: "Helvetica", color: "#2A2622" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, paddingBottom: 16, borderBottomWidth: 1.5 },
  // Work Package D8 — same fix as lib/contracts/pdf.ts (a real,
  // live-reproduced bug there): neither header column had a width bound,
  // so a long brochure name could overflow left into the venue name.
  venueBlock: { maxWidth: "48%" },
  logo: { width: 44, height: 44, objectFit: "contain", marginBottom: 6 },
  venueName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  venueMeta: { fontSize: 8.5, color: "#6B6459", marginTop: 2 },
  titleBlock: { alignItems: "flex-end", maxWidth: "48%" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right" },
  heroImage: { width: "100%", height: 220, objectFit: "cover", marginBottom: 20, borderRadius: 4 },
  sectionHead: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, color: "#928C7F", marginTop: 22, marginBottom: 8 },
  bodyText: { fontSize: 10.5, lineHeight: 1.6 },
  packageRow: { marginBottom: 14 },
  packageName: { fontSize: 11.5, fontFamily: "Helvetica-Bold" },
  packageDescription: { fontSize: 10, lineHeight: 1.5, color: "#4A453D", marginTop: 2 },
  packagePrice: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 3 },
  faqRow: { marginBottom: 12 },
  faqQuestion: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  faqAnswer: { fontSize: 10, lineHeight: 1.5, color: "#4A453D", marginTop: 2 },
  closingText: { fontSize: 10.5, lineHeight: 1.6, marginTop: 4 },
  contactLine: { fontSize: 10, marginTop: 8, color: "#4A453D" },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#928C7F", borderTopWidth: 0.5, borderTopColor: "#E5E0D4", paddingTop: 6 },
});

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "Pricing available from the venue";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function BrochurePdfDocument({ data }: { data: BrochureRenderData }) {
  const { brochure, venue, packages, faqs } = data;
  const brandColor = venue.primaryColor || "#5D6F5D";
  const venueDisplayName = venue.name || venue.businessName || "Your Venue";
  const contactLine = [venue.email, venue.phone, venue.website].filter(Boolean).join("  ·  ");
  const welcomeText = brochure.welcomeText || venue.story || "";

  return (
    React.createElement(Document, { title: brochure.name, author: venueDisplayName },
      React.createElement(Page, { size: "LETTER", style: styles.page },
        React.createElement(View, { style: [styles.header, { borderBottomColor: brandColor }] },
          React.createElement(View, { style: styles.venueBlock },
            venue.logoUrl ? React.createElement(Image, { src: venue.logoUrl, style: styles.logo }) : null,
            React.createElement(Text, { style: styles.venueName }, venueDisplayName),
          ),
          React.createElement(View, { style: styles.titleBlock },
            React.createElement(Text, { style: styles.title }, brochure.name),
          ),
        ),

        venue.heroImageUrl ? React.createElement(Image, { src: venue.heroImageUrl, style: styles.heroImage }) : null,

        // Work Package D7B — a real bug caught by rendering a live PDF:
        // "Next Steps" was appearing alone on one page with its own text
        // stranded on the next (an orphaned heading), and the contact line
        // was printed twice (once here, once in the fixed footer below).
        // `wrap: false` on each section keeps a short heading+body glued
        // together — moved to the next page as one unit if it doesn't fit,
        // never split leaving a bare heading behind. Packages/FAQs only
        // glue their heading to the first item (a long list is still
        // allowed to flow normally after that) so a big list never gets
        // force-pushed as one unbreakable block.
        welcomeText ? React.createElement(View, { wrap: false },
          React.createElement(Text, { style: styles.sectionHead }, "Welcome"),
          React.createElement(Text, { style: styles.bodyText }, welcomeText),
        ) : null,

        brochure.includePackages && packages.length > 0 ? React.createElement(View, null,
          React.createElement(View, { wrap: false },
            React.createElement(Text, { style: styles.sectionHead }, "Packages"),
            React.createElement(View, { style: styles.packageRow },
              React.createElement(Text, { style: styles.packageName }, packages[0].name),
              packages[0].description ? React.createElement(Text, { style: styles.packageDescription }, packages[0].description) : null,
              React.createElement(Text, { style: styles.packagePrice }, fmtMoney(packages[0].basePrice)),
            ),
          ),
          ...packages.slice(1).map((p, i) => React.createElement(View, { key: i, style: styles.packageRow, wrap: false },
            React.createElement(Text, { style: styles.packageName }, p.name),
            p.description ? React.createElement(Text, { style: styles.packageDescription }, p.description) : null,
            React.createElement(Text, { style: styles.packagePrice }, fmtMoney(p.basePrice)),
          )),
        ) : null,

        brochure.includeFaqs && faqs.length > 0 ? React.createElement(View, null,
          React.createElement(View, { wrap: false },
            React.createElement(Text, { style: styles.sectionHead }, "Frequently Asked Questions"),
            React.createElement(View, { style: styles.faqRow },
              React.createElement(Text, { style: styles.faqQuestion }, faqs[0].question),
              React.createElement(Text, { style: styles.faqAnswer }, faqs[0].answer),
            ),
          ),
          ...faqs.slice(1).map((f, i) => React.createElement(View, { key: i, style: styles.faqRow, wrap: false },
            React.createElement(Text, { style: styles.faqQuestion }, f.question),
            React.createElement(Text, { style: styles.faqAnswer }, f.answer),
          )),
        ) : null,

        brochure.closingText ? React.createElement(View, { wrap: false },
          React.createElement(Text, { style: styles.sectionHead }, "Next Steps"),
          React.createElement(Text, { style: styles.closingText }, brochure.closingText),
        ) : null,

        React.createElement(View, { style: styles.footer, fixed: true },
          React.createElement(Text, null, contactLine || venueDisplayName),
          React.createElement(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }),
        ),
      ),
    )
  );
}

export async function generateBrochurePdf(data: BrochureRenderData): Promise<Buffer> {
  return renderToBuffer(React.createElement(BrochurePdfDocument, { data }) as never);
}
