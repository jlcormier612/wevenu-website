/**
 * Safely render every discovered customer-facing email builder / platform
 * template to HTML+text artifacts and flag known pale greys / CTA ink issues.
 * Does NOT send email.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { EMAIL_INK } from "@/lib/email/contrast-safe";
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import { buildDigestHtml, buildDigestSubject } from "@/lib/email/daily-digest";
import { buildTeamInviteHtml } from "@/lib/email/team-invite";
import {
  brandButtonHtml,
  emailBrandFromVenue,
  renderBrandedEmailHtml,
  renderEmailBrandPreviewHtml,
} from "@/lib/email/venue-brand";
import { buildVendorInviteHtml } from "@/lib/email/vendor-invite";
import { buildVendorAssignmentHtml } from "@/lib/email/vendor-assignment";
import { buildVendorRemovedHtml } from "@/lib/email/vendor-removed";
import { contrastRatio, inkOn } from "@/lib/theme/public-form-surface";
import { listEmailTemplates, renderEmailTemplate } from "@/shared/email/templates/registry";

const OUT = "docs/qa/product-contrast-audit/email-renders";
mkdirSync(OUT, { recursive: true });

type Row = {
  id: string;
  htmlBytes: number;
  textBytes: number;
  hasPaleFooter: boolean;
  sampleMutedOk: boolean;
  notes: string;
};

const brand = emailBrandFromVenue({
  name: "Jen's Fancy Venue",
  logo_url: "https://cdn.example.test/logo.png",
  primary_color: "#5D6F5D",
  email_signature: "Warmly,\nJen",
  email: "hello@fancy.example",
  phone: "+15555550100",
  email_footer_show_signature: true,
  email_footer_show_email: true,
  email_footer_show_phone: true,
});

const paleBrand = emailBrandFromVenue({
  name: "Pale Venue",
  primary_color: "#D8A7AA",
  email_signature: "Thanks",
  email: "hi@pale.example",
});

function save(id: string, html: string, text = "") {
  writeFileSync(join(OUT, `${id}.html`), html);
  if (text) writeFileSync(join(OUT, `${id}.txt`), text);
}

function analyze(id: string, html: string, text = ""): Row {
  const hasPaleFooter = /#9ca3af/i.test(html);
  const mutedRatio = contrastRatio(EMAIL_INK.muted, EMAIL_INK.card) ?? 0;
  save(id, html, text);
  return {
    id,
    htmlBytes: html.length,
    textBytes: text.length,
    hasPaleFooter,
    sampleMutedOk: mutedRatio >= 4.5,
    notes: hasPaleFooter ? "FAIL pale footer" : "ok",
  };
}

const rows: Row[] = [];

for (const t of listEmailTemplates()) {
  const r = renderEmailTemplate(t.id, {
    firstName: "Alex",
    venueName: "Fancy",
    activateUrl: "https://example.com/activate",
    amount: "$10.00",
    invoiceNumber: "INV-1",
    feedbackUrl: "https://example.com/feedback",
  });
  rows.push(analyze(`platform-${t.id}`, r.html, r.text));
}

rows.push(
  analyze(
    "venue-branded-shell",
    renderBrandedEmailHtml(brand, `<p style="color:${EMAIL_INK.body}">Hello from the venue.</p>`),
  ),
);
rows.push(analyze("venue-brand-preview", renderEmailBrandPreviewHtml(brand)));
rows.push(
  analyze(
    "venue-cta-heritage",
    renderBrandedEmailHtml(brand, brandButtonHtml(brand, "https://example.com/pay", "Pay now")),
  ),
);
rows.push(
  analyze(
    "venue-cta-pale",
    renderBrandedEmailHtml(paleBrand, brandButtonHtml(paleBrand, "https://example.com/pay", "Pay now")),
  ),
);
rows.push(
  analyze(
    "conversation-wrap",
    wrapConversationMessageHtml(
      brand,
      "Please review https://example.com/offer/token123 and reply when ready.",
    ),
  ),
);
rows.push(
  analyze(
    "team-invite",
    buildTeamInviteHtml({
      memberName: "Alex",
      venueName: "Fancy",
      acceptUrl: "https://example.com/join?t=1",
    }),
  ),
);
rows.push(
  analyze(
    "vendor-invite",
    buildVendorInviteHtml({
      vendorName: "Cuppity",
      venueName: "Fancy",
      acceptUrl: "https://example.com/vendor/accept",
    }),
  ),
);

rows.push(
  analyze(
    "vendor-assignment",
    buildVendorAssignmentHtml({
      vendorName: "Cuppity",
      venueName: "Fancy",
      eventLabel: "Alex & Sam — Oct 12",
      deepLinkUrl: "https://example.com/vendor",
    }),
  ),
);
rows.push(
  analyze(
    "vendor-removed",
    buildVendorRemovedHtml({
      vendorName: "Cuppity",
      venueName: "Fancy",
      eventLabel: "Alex & Sam — Oct 12",
    }),
  ),
)

const digestCtx = {
  venueName: "Fancy",
  todayFormatted: "Oct 23, 2026",
  subjectLine: "Your daily digest",
  urgentItems: [{ label: "Follow up", detail: "Lead needs reply", href: "https://example.com/leads/1" }],
  dueTodayItems: [],
  recentWins: [],
  luvObservation: null,
  appUrl: "https://app.sandbox.hellotocheers.com",
  unsubscribeUrl: "https://example.com/settings",
};
rows.push(analyze("daily-digest", buildDigestHtml(digestCtx), buildDigestSubject(digestCtx)));

const paleCtaInk = inkOn("#D8A7AA");
const paleOk = (contrastRatio(paleCtaInk, "#D8A7AA") ?? 0) >= 4.5;

const summary = {
  renderedAt: new Date().toISOString(),
  outDir: OUT,
  emailInk: EMAIL_INK,
  paleCtaInk,
  paleCtaOk: paleOk,
  rows,
  failCount: rows.filter((r) => r.hasPaleFooter || r.notes.startsWith("FAIL")).length,
  renderedCount: rows.filter((r) => r.htmlBytes > 0).length,
};

writeFileSync(join(OUT, "results.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.failCount > 0 || !paleOk ? 1 : 0);
