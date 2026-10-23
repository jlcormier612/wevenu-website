/**
 * Customer-facing email shell / footer / CTA contrast regression.
 * Renders real HTML builders — no external delivery.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMAIL_INK } from "@/lib/email/contrast-safe";
import { linkifyPlainTextForEmailHtml } from "@/lib/email/conversation-brand";
import { buildDigestHtml } from "@/lib/email/daily-digest";
import { buildTeamInviteHtml } from "@/lib/email/team-invite";
import {
  brandButtonHtml,
  emailBrandFromVenue,
  renderBrandedEmailHtml,
} from "@/lib/email/venue-brand";
import { buildVendorInviteHtml } from "@/lib/email/vendor-invite";
import { contrastRatio, inkOn } from "@/lib/theme/public-form-surface";
import { listEmailTemplates, renderEmailTemplate } from "@/shared/email/templates/registry";

function assertAA(fg: string, bg: string, label: string) {
  const ratio = contrastRatio(fg, bg) ?? 0;
  assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1 (need ≥4.5)`);
}

function extractInlineColors(html: string): string[] {
  const out: string[] = [];
  const re = /color:\s*(#[0-9a-fA-F]{3,8})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]!.toLowerCase());
  return out;
}

describe("email shell contrast tokens", () => {
  it("EMAIL_INK muted/footer clear AA on white and page backdrop", () => {
    assertAA(EMAIL_INK.muted, EMAIL_INK.card, "muted on card");
    assertAA(EMAIL_INK.muted, EMAIL_INK.page, "muted on page");
    assertAA(EMAIL_INK.footer, EMAIL_INK.card, "footer on card");
    assertAA(EMAIL_INK.body, EMAIL_INK.card, "body on card");
    assertAA(EMAIL_INK.heading, EMAIL_INK.card, "heading on card");
  });

  it("banned pale footer grey stays below AA so we do not regress", () => {
    assert.ok((contrastRatio("#9ca3af", "#ffffff") ?? 0) < 4.5);
  });

  it("venue brand shell does not emit #9ca3af", () => {
    const brand = emailBrandFromVenue({
      name: "Jen's Fancy Venue",
      primary_color: "#5D6F5D",
      email_signature: "Thanks,\nJen",
      email: "hello@example.com",
      phone: "+15555550100",
      email_footer_show_signature: true,
      email_footer_show_email: true,
      email_footer_show_phone: true,
    });
    const html = renderBrandedEmailHtml(
      brand,
      `<p style="color:${EMAIL_INK.body}">Hello</p>`,
    );
    assert.doesNotMatch(html, /#9ca3af/i);
    assert.match(html, new RegExp(EMAIL_INK.footer, "i"));
  });

  it("brand CTA ink adapts for pale and dark primary colors", () => {
    const pale = brandButtonHtml(
      { name: "V", primaryColor: "#D8A7AA" },
      "https://example.com",
      "Pay",
    );
    assert.match(pale, /color:#000000/i);
    assertAA("#000000", "#D8A7AA", "black on dusty-rose CTA");

    const dark = brandButtonHtml(
      { name: "V", primaryColor: "#5D6F5D" },
      "https://example.com",
      "Open",
    );
    const ink = inkOn("#5D6F5D");
    assert.match(dark, new RegExp(`color:${ink}`, "i"));
    assertAA(ink, "#5D6F5D", "CTA on heritage");
  });

  it("conversation linkify CTA uses readable ink on pale brand", () => {
    const html = linkifyPlainTextForEmailHtml(
      "See https://example.com/offer/abc123",
      "#D8A7AA",
    );
    assert.match(html, /color:#000000/i);
    assert.doesNotMatch(html, /color:#fff;/i);
  });

  it("team/vendor invite + digest omit pale footer grey", () => {
    const team = buildTeamInviteHtml({
      memberName: "Alex",
      venueName: "Fancy",
      acceptUrl: "https://example.com/join",
    });
    const vendor = buildVendorInviteHtml({
      vendorName: "Baker",
      venueName: "Fancy",
      acceptUrl: "https://example.com/vendor/accept",
    });
    const digest = buildDigestHtml({
      venueName: "Fancy",
      todayFormatted: "Oct 23",
      subjectLine: "Digest",
      urgentItems: [{ label: "Call", detail: "Soon", href: "https://example.com" }],
      dueTodayItems: [],
      recentWins: [],
      luvObservation: null,
      appUrl: "https://example.com",
      unsubscribeUrl: "https://example.com/settings",
    });
    for (const [name, html] of [
      ["team", team],
      ["vendor", vendor],
      ["digest", digest],
    ] as const) {
      assert.doesNotMatch(html, /#9ca3af/i, name);
      const colors = extractInlineColors(html);
      for (const c of colors) {
        if (c === "#ffffff" || c === "#fff" || c === "#fffdf9") continue;
        // Background colors appear as color: in some CTAs — skip pure backgrounds checked elsewhere.
        const onWhite = contrastRatio(c, "#ffffff") ?? 0;
        // Allow brand sage used as text only if AA; CTAs use white/black ink separately.
        if (c === "#5d6f5d" || c === "#2f3d2f") continue;
        assert.ok(
          onWhite >= 4.5 || c === "#000000" || c === "#111827" || c === "#374151" || c === "#6b7280",
          `${name} inline color ${c} on white = ${onWhite.toFixed(2)}`,
        );
      }
    }
  });

  it("platform registry templates render without #9ca3af", () => {
    for (const t of listEmailTemplates()) {
      const rendered = renderEmailTemplate(t.id, {
        firstName: "Alex",
        venueName: "Fancy",
        activateUrl: "https://example.com/activate",
        amount: "$10.00",
        invoiceNumber: "INV-1",
      } as never);
      assert.ok(rendered.html.length > 0, t.id);
      assert.ok(rendered.text.length > 0, `${t.id} text`);
      assert.doesNotMatch(rendered.html, /#9ca3af/i, t.id);
    }
  });
});
