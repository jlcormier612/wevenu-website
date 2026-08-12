/**
 * Work Package D5C — the real Event Order / BEO PDF. Reuses D4's exact
 * pattern (@react-pdf/renderer, server-side, no headless browser) — not a
 * second PDF system. Renders the venue's own already-committed structured
 * data (sections/lines/total) into a professional, human-readable
 * document; never a database export, never an admin table.
 *
 * Lesson carried forward from D4: a page-level `lineHeight` style was
 * found to corrupt @react-pdf/renderer's pagination math for `fixed`
 * absolutely-positioned elements (the footer silently vanished on full
 * pages). This module never sets lineHeight at the page level — only on
 * the specific text blocks that need it — from the start.
 */
import * as React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { resolvePdfBrandColors } from "@/lib/collateral/pdf-brand";
import type { EventOrderWithDetails } from "@/lib/event-orders/types";
import type { Venue } from "@/lib/venue/types";
import { formatMoney } from "@/lib/event-orders/constants";

export type EventOrderPdfContext = {
  eventName: string;
  eventDate: string | null; // ISO date
  guestCount: number | null;
  spaceName: string | null;
  clientName: string | null;
};

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10, fontFamily: "Helvetica", color: "#2A2622" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1.5 },
  // Work Package D8 — same fix as lib/contracts/pdf.ts, preemptively
  // applied here too: neither header column had a width bound, so a long
  // couple/event name in the status line could overflow left into the
  // venue name exactly like the real, live-reproduced Contract PDF bug.
  venueBlock: { maxWidth: "48%" },
  logo: { width: 44, height: 44, objectFit: "contain", marginBottom: 6 },
  venueName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  venueMeta: { fontSize: 8.5, color: "#6B6459", marginTop: 2 },
  titleBlock: { alignItems: "flex-end", maxWidth: "48%" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right" },
  statusLine: { fontSize: 9, color: "#6B6459", marginTop: 3 },
  sectionHead: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, color: "#928C7F", marginTop: 18, marginBottom: 8 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  overviewItem: { minWidth: 120 },
  overviewLabel: { fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#928C7F" },
  overviewValue: { fontSize: 10.5, marginTop: 2 },
  orderSectionName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#E5E0D4" },
  lineDescription: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  lineQty: { width: 40, fontSize: 9.5, color: "#6B6459", textAlign: "right" },
  lineAmount: { width: 70, fontSize: 10, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#2A2622" },
  totalLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginRight: 12 },
  totalAmount: { fontSize: 12, fontFamily: "Helvetica-Bold", width: 70, textAlign: "right" },
  emptyNote: { fontSize: 9.5, color: "#928C7F", fontFamily: "Times-Italic", marginTop: 4 },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#928C7F", borderTopWidth: 0.5, borderTopColor: "#E5E0D4", paddingTop: 6 },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function LineRow({ description, quantity, amount }: { description: string; quantity: number; amount: number }) {
  return React.createElement(View, { style: styles.lineRow },
    React.createElement(Text, { style: styles.lineDescription }, description),
    React.createElement(Text, { style: styles.lineQty }, `×${quantity}`),
    React.createElement(Text, { style: styles.lineAmount }, formatMoney(amount)),
  );
}

function EventOrderPdfDocument({ eventOrder, venue, ctx }: { eventOrder: EventOrderWithDetails; venue: Venue; ctx: EventOrderPdfContext }) {
  const brand = resolvePdfBrandColors(venue);
  const venueDisplayName = venue.name || venue.businessName || "Your Venue";
  const addressLine = [venue.addressLine1, venue.addressLine2].filter(Boolean).join(", ");
  const contactLine = [venue.email, venue.phone, venue.website].filter(Boolean).join("  ·  ");
  const unsectioned = eventOrder.lines.filter((l) => !l.sectionId);
  const sectionHeadStyle = [styles.sectionHead, { color: brand.secondary, borderBottomWidth: 1, borderBottomColor: brand.secondary, paddingBottom: 4 }];

  return React.createElement(Document, { title: `Event Order — ${ctx.eventName}`, author: venueDisplayName },
    React.createElement(Page, { size: "LETTER", style: styles.page },
      React.createElement(View, { style: [styles.header, { borderBottomColor: brand.primary }] },
        React.createElement(View, { style: styles.venueBlock },
          venue.logoUrl ? React.createElement(Image, { src: venue.logoUrl, style: styles.logo }) : null,
          React.createElement(Text, { style: styles.venueName }, venueDisplayName),
          addressLine ? React.createElement(Text, { style: styles.venueMeta }, addressLine) : null,
        ),
        React.createElement(View, { style: styles.titleBlock },
          React.createElement(Text, { style: styles.title }, "Event Order"),
          React.createElement(Text, { style: styles.statusLine }, ctx.eventName),
        ),
      ),

      React.createElement(Text, { style: sectionHeadStyle }, "Event Overview"),
      React.createElement(View, { style: styles.overviewGrid },
        React.createElement(View, { style: styles.overviewItem },
          React.createElement(Text, { style: styles.overviewLabel }, "Date"),
          React.createElement(Text, { style: styles.overviewValue }, fmtDate(ctx.eventDate)),
        ),
        ctx.guestCount != null ? React.createElement(View, { style: styles.overviewItem },
          React.createElement(Text, { style: styles.overviewLabel }, "Guest Count"),
          React.createElement(Text, { style: styles.overviewValue }, String(ctx.guestCount)),
        ) : null,
        ctx.spaceName ? React.createElement(View, { style: styles.overviewItem },
          React.createElement(Text, { style: styles.overviewLabel }, "Space"),
          React.createElement(Text, { style: styles.overviewValue }, ctx.spaceName),
        ) : null,
        ctx.clientName ? React.createElement(View, { style: styles.overviewItem },
          React.createElement(Text, { style: styles.overviewLabel }, "Client"),
          React.createElement(Text, { style: styles.overviewValue }, ctx.clientName),
        ) : null,
      ),

      React.createElement(Text, { style: sectionHeadStyle }, "Order Details"),
      eventOrder.sections.length === 0 && eventOrder.lines.length === 0
        ? React.createElement(Text, { style: styles.emptyNote }, "Nothing added yet.")
        : null,
      ...eventOrder.sections.map((section) => {
        const lines = eventOrder.lines.filter((l) => l.sectionId === section.id);
        return React.createElement(View, { key: section.id },
          React.createElement(Text, { style: styles.orderSectionName }, section.name),
          lines.length === 0
            ? React.createElement(Text, { style: styles.emptyNote }, "No items in this section.")
            : lines.map((l) => React.createElement(LineRow, { key: l.id, description: l.description, quantity: l.quantity, amount: l.amount })),
        );
      }),
      unsectioned.length > 0
        ? React.createElement(View, null,
            eventOrder.sections.length > 0 ? React.createElement(Text, { style: styles.orderSectionName }, "General") : null,
            ...unsectioned.map((l) => React.createElement(LineRow, { key: l.id, description: l.description, quantity: l.quantity, amount: l.amount })),
          )
        : null,

      React.createElement(View, { style: styles.totalRow },
        React.createElement(Text, { style: styles.totalLabel }, "Total"),
        React.createElement(Text, { style: styles.totalAmount }, formatMoney(eventOrder.total)),
      ),

      React.createElement(View, { style: styles.footer, fixed: true },
        React.createElement(Text, null, contactLine || venueDisplayName),
        React.createElement(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }),
      ),
    ),
  );
}

/** Renders the exact given, currently-locked Event Order into a PDF buffer. Never called for anything but a finalized ("Ready") Event Order's current content. */
export async function generateEventOrderPdf(eventOrder: EventOrderWithDetails, venue: Venue, ctx: EventOrderPdfContext): Promise<Buffer> {
  return renderToBuffer(React.createElement(EventOrderPdfDocument, { eventOrder, venue, ctx }) as never);
}
