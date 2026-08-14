/**
 * Contract-invitation email — sent when a venue sends a contract for signing.
 * Venue Brand Experience Phase 1: built branded from day one (per the user's
 * direction — this is a foundational transactional email in the core booking
 * workflow, not part of the future Messaging & Conversations initiative).
 */
import { escapeHtml, brandButtonHtml, renderBrandedEmailHtml, type EmailVenueBrand } from "@/lib/email/venue-brand";

export type ContractInviteContext = {
  brand: EmailVenueBrand;
  recipientFirstName: string;
  contractTitle: string;
  signUrl: string;
  /** Work Package D5E — the venue's own message from the unified Share dialog, already merge-resolved. Replaces the default sentence; the signing link/button is always still appended, so the venue can never accidentally send an invite with no way to sign. */
  customMessage?: string;
};

export function buildContractInviteSubject(ctx: ContractInviteContext): string {
  return `${ctx.brand.name}: ${ctx.contractTitle} is ready for your signature`;
}

export function buildContractInviteText(ctx: ContractInviteContext): string {
  return [
    `Hi ${ctx.recipientFirstName},`,
    "",
    ctx.customMessage?.trim() || `${ctx.brand.name} has sent you "${ctx.contractTitle}" to review and sign.`,
    "",
    "Review and sign here:",
    ctx.signUrl,
    "",
    ctx.brand.name,
  ].join("\n");
}

export function buildContractInviteHtml(ctx: ContractInviteContext): string {
  const body = [
    `<p style="margin:0 0 12px;font-size:15px;color:#374151">Hi ${escapeHtml(ctx.recipientFirstName)},</p>`,
    `<p style="margin:0 0 20px;font-size:15px;color:#374151">${escapeHtml(ctx.customMessage?.trim() || `${ctx.brand.name} has sent you "${ctx.contractTitle}" to review and sign.`)}</p>`,
    `<p style="margin:0 0 20px">${brandButtonHtml(ctx.brand, ctx.signUrl, "Review & Sign")}</p>`,
  ].join("");
  return renderBrandedEmailHtml(ctx.brand, body);
}
