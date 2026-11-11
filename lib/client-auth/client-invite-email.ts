/**
 * Client planning-workspace invitation email — shared builder for preview and send.
 * Preview and send must use this same content path so the venue reviews what is sent.
 */
import {
  brandButtonHtml,
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
  type EmailVenueBrand,
  type VenueBrandSource,
} from "@/lib/email/venue-brand";
import { publicAppOrigin } from "@/lib/env";

export type ClientInviteEmailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
  acceptUrl: string;
  ctaLabel: string;
  venueName: string;
  coupleName: string;
};

export const CLIENT_INVITE_CTA_LABEL = "Create Your Account";

export const CLIENT_INVITE_ACCESS_WARNING =
  "Sending this invitation lets the client create or access their account and open their planning workspace. Materials already available to them may become visible. Drafts and items that still need a separate share action stay private until you share them.";

export function clientInviteAcceptUrl(token: string): string {
  return `${publicAppOrigin()}/client/accept?token=${token}`;
}

/** Stand-in token shape for preview only — never persisted; real token is created on send. */
export function clientInvitePreviewAcceptUrl(): string {
  return clientInviteAcceptUrl("preview");
}

export function buildClientInviteEmail(input: {
  to: string;
  coupleName: string;
  venue: VenueBrandSource;
  /** Personal accept URL (real token on send; preview stand-in on review). */
  acceptUrl: string;
  brand?: EmailVenueBrand;
}): ClientInviteEmailContent {
  const brand = input.brand ?? emailBrandFromVenue(input.venue);
  const venueName = brand.name;
  const coupleName = input.coupleName.trim() || "there";
  const subject = `You're invited to your ${venueName} planning workspace`;
  const text = [
    `Hi ${coupleName},`,
    "",
    `${venueName} invited you to join your private planning space on Hello to Cheers.`,
    "",
    "Hello to Cheers is where you'll keep the important details of your celebration together — planning tasks, venue information, and the things your team shares with you along the way.",
    "",
    "Create your account to get started:",
    input.acceptUrl,
    "",
    "By accepting, you'll be asked to review the Hello to Cheers Terms and Privacy Policy before entering your workspace.",
    "",
    "This link is personal to you — please don't share it.",
    "",
    venueName,
  ].join("\n");
  // Explicit inline margins — email clients and the in-app preview (Tailwind
  // preflight zeroes bare <p> margins) must agree on spacing.
  const bodyP =
    'margin:0 0 16px;font-size:15px;color:#374151;line-height:1.55';
  const legalP =
    'margin:0 0 8px;color:#6b7280;font-size:12px;line-height:1.5';
  const html = renderBrandedEmailHtml(brand, [
    `<p style="${bodyP}">Hi ${escapeHtml(coupleName)},</p>`,
    `<p style="${bodyP}"><strong>${escapeHtml(venueName)}</strong> invited you to join your private planning space on Hello to Cheers.</p>`,
    `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.55">Hello to Cheers is where you'll keep the important details of your celebration together — planning tasks, venue information, and the things your team shares with you along the way.</p>`,
    `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.55">Create your account to get started.</p>`,
    `<p style="margin:0 0 20px">${brandButtonHtml(brand, input.acceptUrl, CLIENT_INVITE_CTA_LABEL)}</p>`,
    `<p style="${legalP}">By accepting, you'll be asked to review the Hello to Cheers Terms and Privacy Policy before entering your workspace.</p>`,
    `<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5">This link is personal to you — please don't share it.</p>`,
  ].join(""));

  return {
    to: input.to.trim(),
    subject,
    text,
    html,
    acceptUrl: input.acceptUrl,
    ctaLabel: CLIENT_INVITE_CTA_LABEL,
    venueName,
    coupleName,
  };
}
