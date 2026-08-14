/**
 * Work Package D4 — the actual Contract PDF. Confirmed repeatedly across
 * this whole engagement (BA1/BA3/D2): no PDF generation existed anywhere
 * in this app before this file — every "print"/"export" elsewhere is
 * still HTML + the browser's print dialog. This is the one real
 * generator, built specifically for the signed-contract final
 * representation, using @react-pdf/renderer (server-side, no headless
 * browser dependency). Not a generalized PDF framework for every asset —
 * that's explicitly out of this phase's scope (Step 51).
 *
 * Honesty note carried into the rendered PDF and this module's own
 * naming: this documents what was actually agreed and signed (a real,
 * immutable artifact once finalized), but the underlying signature
 * capture is a typed name + consent checkbox, not a cryptographic
 * signature or identity-verified e-signature. Nothing here claims
 * "legally binding," "certified signature," or "tamper-proof" — see
 * docs/contract-lifecycle-implementation.md for exactly what is and
 * isn't true.
 */
import * as React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import { resolvePdfBrandColors } from "@/lib/collateral/pdf-brand";
import { resolveContractBrandPresentation } from "@/lib/contracts/branding";
import type { Contract } from "@/lib/contracts/types";
import type { Venue } from "@/lib/venue/types";

// A serif/sans pairing chosen for this document's own credibility — not
// venue-customizable. BA1 confirmed no venue typography field exists
// anywhere in the schema; Step 29's typography requirement is honored
// exactly as instructed ("where the architecture supports it") by not
// pretending a customization point exists that doesn't.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  // lineHeight is deliberately NOT set here (only on contentText, which needs
  // it) — a page-level lineHeight was found during D4 validation to corrupt
  // @react-pdf/renderer's pagination math for `fixed` absolutely-positioned
  // elements (the footer silently vanished on every full page, and rendered
  // at the wrong position on a short one). Confirmed by direct bisection
  // against real generated PDFs; see docs/contract-lifecycle-implementation.md.
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10.5, fontFamily: "Helvetica", color: "#2A2622" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, paddingBottom: 16, borderBottomWidth: 1.5 },
  // Work Package D8 — a real bug caught by rendering with a realistic long
  // client name: neither header column had a width bound, so react-pdf
  // never wrapped the title text — it just overflowed left, straight over
  // the venue name. Both columns now get an explicit maxWidth so long
  // content wraps onto a second line within its own column instead of
  // colliding with its sibling.
  venueBlock: { maxWidth: "48%" },
  logo: { width: 44, height: 44, objectFit: "contain", marginBottom: 6 },
  venueName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  venueMeta: { fontSize: 8.5, color: "#6B6459", marginTop: 2 },
  titleBlock: { alignItems: "flex-end", maxWidth: "48%" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right" },
  statusLine: { fontSize: 9, color: "#6B6459", marginTop: 3 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20, gap: 24 },
  metaItem: { minWidth: 140 },
  metaLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#928C7F" },
  metaValue: { fontSize: 10.5, marginTop: 2 },
  sectionRule: { borderBottomWidth: 1, marginBottom: 10, marginTop: 4, paddingBottom: 4 },
  sectionHead: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  contentBlock: { marginTop: 4 },
  contentText: { fontSize: 10.5, lineHeight: 1.6 },
  signatureBlock: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#D8D2C4" },
  signatureTitle: { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, color: "#928C7F", marginBottom: 8 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between" },
  signatureName: { fontSize: 12, fontFamily: "Times-Italic" },
  signatureMeta: { fontSize: 8.5, color: "#6B6459", marginTop: 3 },
  disclaimer: { fontSize: 7.5, color: "#928C7F", marginTop: 14 },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#928C7F", borderTopWidth: 0.5, borderTopColor: "#E5E0D4", paddingTop: 6 },
});

/**
 * Work Package D6 — a real bug caught by rendering an actual PDF: this
 * function is used for both `contract.eventDate` (a date-only "YYYY-MM-DD"
 * string, which `new Date(iso)` parses as UTC midnight — displaying it in
 * a timezone west of UTC rolls it back a day) and `contract.createdAt`/
 * `signedAt` (full timestamps, unaffected). A signed contract PDF was
 * showing two different event dates on the same page: the header
 * metadata (this function, off by one) and the body content (merged via
 * lib/contracts/constants.ts's formatContractDate, which parses y/m/d
 * directly and was correct). Same guard `lib/event-orders/pdf.ts` already
 * uses correctly for its own date-only field.
 */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ContractPdfDocument({ contract, venue }: { contract: Contract; venue: Venue }) {
  // Prefer branding frozen at release; pre-existing contracts without a
  // snapshot fall back to live venue branding (no silent backfill).
  const brandFields = resolveContractBrandPresentation(contract.brandingSnapshot, venue);
  const brand = resolvePdfBrandColors(brandFields ?? venue);
  const venueDisplayName = brandFields?.businessName || brandFields?.name || venue.name || venue.businessName || "Your Venue";
  const addressLine = [
    brandFields?.addressLine1 ?? venue.addressLine1,
    brandFields?.addressLine2 ?? venue.addressLine2,
  ].filter(Boolean).join(", ");
  const contactLine = [
    brandFields?.email ?? venue.email,
    brandFields?.phone ?? venue.phone,
    brandFields?.website ?? venue.website,
  ].filter(Boolean).join("  ·  ");
  const logoUrl = brandFields?.logoUrl ?? venue.logoUrl;

  return (
    React.createElement(Document, { title: contract.title, author: venueDisplayName },
      React.createElement(Page, { size: "LETTER", style: styles.page },
        React.createElement(View, { style: [styles.header, { borderBottomColor: brand.primary }] },
          React.createElement(View, { style: styles.venueBlock },
            logoUrl ? React.createElement(Image, { src: logoUrl, style: styles.logo }) : null,
            React.createElement(Text, { style: styles.venueName }, venueDisplayName),
            addressLine ? React.createElement(Text, { style: styles.venueMeta }, addressLine) : null,
          ),
          React.createElement(View, { style: styles.titleBlock },
            React.createElement(Text, { style: styles.title }, contract.title),
            React.createElement(Text, { style: styles.statusLine },
              contract.status === "signed" ? "Signed Agreement" : "Contract"),
          ),
        ),

        React.createElement(View, { style: styles.metaGrid },
          contract.clientName ? React.createElement(View, { style: styles.metaItem },
            React.createElement(Text, { style: styles.metaLabel }, "Client"),
            React.createElement(Text, { style: styles.metaValue }, contract.clientName),
          ) : null,
          contract.eventDate ? React.createElement(View, { style: styles.metaItem },
            React.createElement(Text, { style: styles.metaLabel }, "Event Date"),
            React.createElement(Text, { style: styles.metaValue }, fmtDate(contract.eventDate)),
          ) : null,
          React.createElement(View, { style: styles.metaItem },
            React.createElement(Text, { style: styles.metaLabel }, "Prepared"),
            React.createElement(Text, { style: styles.metaValue }, fmtDate(contract.createdAt)),
          ),
        ),

        React.createElement(View, { style: [styles.sectionRule, { borderBottomColor: brand.secondary }] },
          React.createElement(Text, { style: [styles.sectionHead, { color: brand.secondary }] }, "Agreement"),
        ),

        React.createElement(View, { style: styles.contentBlock },
          React.createElement(Text, { style: styles.contentText }, contract.content),
        ),

        // Work Package D8 — a real bug caught by rendering with a
        // realistic, longer contract body: the "SIGNATURE" heading landed
        // alone at the bottom of one page while the signer name/date/
        // disclaimer it belongs to flowed to the next — an orphaned
        // heading, the same class of bug already fixed for Brochures
        // (lib/brochures/pdf.ts). `wrap: false` keeps the whole block
        // (heading + content) together, moved to the next page as one
        // unit if it doesn't fit — safe here since the block is short.
        contract.signedAt ? React.createElement(View, { style: styles.signatureBlock, wrap: false },
          React.createElement(Text, { style: [styles.signatureTitle, { color: brand.secondary }] }, "Signature"),
          React.createElement(View, { style: styles.signatureRow },
            React.createElement(View, null,
              React.createElement(Text, { style: styles.signatureName }, contract.signerName || "—"),
              React.createElement(Text, { style: styles.signatureMeta }, `Signed ${fmtDate(contract.signedAt)}`),
            ),
          ),
          React.createElement(Text, { style: styles.disclaimer },
            "This signature was captured as a typed name with explicit consent, not a cryptographic or identity-verified electronic signature."),
        ) : null,

        React.createElement(View, { style: styles.footer, fixed: true },
          React.createElement(Text, null, contactLine || venueDisplayName),
          React.createElement(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }),
        ),
      ),
    )
  );
}

/** Renders the exact given Contract content into a PDF buffer. Never called for anything but the currently-locked, signed content at finalize time. */
export async function generateContractPdf(contract: Contract, venue: Venue): Promise<Buffer> {
  return renderToBuffer(React.createElement(ContractPdfDocument, { contract, venue }) as never);
}
