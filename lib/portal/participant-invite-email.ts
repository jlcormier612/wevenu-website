/**
 * Couple-invited portal participant email — venue-branded shell (D5 / #28).
 * Copy and accept URL stay personal to the invitee; no internal venue notes.
 */
import {
  appendEmailSignatureText,
  brandButtonHtml,
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
  type VenueBrandSource,
} from "@/lib/email/venue-brand";

export type PortalParticipantInviteEmailInput = {
  firstName: string;
  coupleName: string;
  venueName: string;
  acceptUrl: string;
  brandSource: VenueBrandSource;
};

export function buildPortalParticipantInviteEmail(input: PortalParticipantInviteEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const brand = emailBrandFromVenue(input.brandSource);
  const venueName = input.venueName.trim() || brand.name;
  const firstName = input.firstName.trim();
  const coupleName = input.coupleName.trim();
  const subject = `${coupleName} invited you to their planning workspace`;

  const text = appendEmailSignatureText(
    [
      `Hi ${firstName},`,
      "",
      `${coupleName} invited you to help plan their celebration with ${venueName}.`,
      "",
      "By accepting this invitation, you will be asked to review and accept the applicable Hello to Cheers Terms and Privacy Policy before accessing your workspace.",
      "",
      "Create your account here:",
      input.acceptUrl,
      "",
      "This link is personal to you — please don't share it.",
    ].join("\n"),
    brand,
  );

  const html = renderBrandedEmailHtml(
    brand,
    [
      `<p>Hi ${escapeHtml(firstName)},</p>`,
      `<p><strong>${escapeHtml(coupleName)}</strong> invited you to help plan their celebration with ${escapeHtml(venueName)}.</p>`,
      `<p>By accepting this invitation, you will be asked to review and accept the applicable Hello to Cheers Terms and Privacy Policy before accessing your workspace.</p>`,
      `<p>Create your account to get started.</p>`,
      `<p>${brandButtonHtml(brand, input.acceptUrl, "Create Your Account")}</p>`,
      `<p style="color:#888;font-size:12px;">This link is personal to you — please don't share it.</p>`,
    ].join(""),
  );

  return { subject, text, html };
}
