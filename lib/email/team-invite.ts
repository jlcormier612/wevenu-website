/**
 * Team invitation email templates.
 */

import { htcEmailLogoHeaderHtml } from "@/shared/brand/logo";
import { ACCESS_TITLE_LABELS } from "@/lib/authorization/access-copy";
import type { AccessTitle } from "@/lib/authorization/types";

function accessLabel(accessTitleLabel?: string | AccessTitle): string | null {
  if (!accessTitleLabel) return null;
  if (accessTitleLabel in ACCESS_TITLE_LABELS) {
    return ACCESS_TITLE_LABELS[accessTitleLabel as AccessTitle];
  }
  return accessTitleLabel;
}

export function buildTeamInviteHtml({
  memberName,
  venueName,
  acceptUrl,
  accessTitleLabel,
}: {
  memberName: string;
  venueName: string;
  acceptUrl: string;
  accessTitleLabel?: string;
}): string {
  const title = accessLabel(accessTitleLabel);
  const titleLine = title
    ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">You've been invited as <strong>${escapeHtml(title)}</strong>.</p>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
        ${htcEmailLogoHeaderHtml()}
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280">
          Team invitation
        </p>
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;line-height:1.3">
          You're invited to join<br>${escapeHtml(venueName)} on Hello to Cheers
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
          Hi ${escapeHtml(memberName)},<br><br>
          ${escapeHtml(venueName)} has invited you to join their team on Hello to Cheers — where they manage clients, events, vendors, and workflows.
        </p>
        ${titleLine}
        <a href="${acceptUrl}"
          style="display:inline-block;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none">
          Accept Invitation →
        </a>
        <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.5">
          If you weren't expecting this invitation, you can safely ignore it.<br>
          <a href="${acceptUrl}" style="color:#9ca3af;word-break:break-all">${acceptUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-top:20px;text-align:center">
        <p style="font-size:12px;color:#9ca3af;margin:0">Powered by Hello to Cheers</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildTeamInviteText({
  memberName,
  venueName,
  acceptUrl,
  accessTitleLabel,
}: {
  memberName: string;
  venueName: string;
  acceptUrl: string;
  accessTitleLabel?: string;
}): string {
  const title = accessLabel(accessTitleLabel);
  return [
    `You're invited to join ${venueName} on Hello to Cheers`,
    "",
    `Hi ${memberName},`,
    "",
    `${venueName} has invited you to join their team on Hello to Cheers.`,
    title ? `You've been invited as ${title}.` : "",
    "Accept your invitation to access the full venue workspace.",
    "",
    `Accept invitation: ${acceptUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOwnerInviteHtml({
  memberName,
  venueName,
  acceptUrl,
  administratorName,
}: {
  memberName: string;
  venueName: string;
  acceptUrl: string;
  administratorName: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
        ${htcEmailLogoHeaderHtml()}
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280">
          Owner invitation
        </p>
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;line-height:1.3">
          You're invited as an Owner of<br>${escapeHtml(venueName)}
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
          Hi ${escapeHtml(memberName)},
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
          ${escapeHtml(administratorName)} is setting up Hello to Cheers for ${escapeHtml(venueName)} and has been added as an Administrator.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
          You've been invited as an Owner so you can access the venue, see who is managing it, and control ownership and access permissions whenever you want.
          You don't need to finish day-to-day setup yourself — your Administrator can keep running the account while this invitation is pending.
        </p>
        <a href="${acceptUrl}"
          style="display:inline-block;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none">
          Accept Owner Invitation →
        </a>
        <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.5">
          If you weren't expecting this invitation, you can safely ignore it.<br>
          <a href="${acceptUrl}" style="color:#9ca3af;word-break:break-all">${acceptUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-top:20px;text-align:center">
        <p style="font-size:12px;color:#9ca3af;margin:0">Powered by Hello to Cheers</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOwnerInviteText({
  memberName,
  venueName,
  acceptUrl,
  administratorName,
}: {
  memberName: string;
  venueName: string;
  acceptUrl: string;
  administratorName: string;
}): string {
  return [
    `You're invited as an Owner of ${venueName} on Hello to Cheers`,
    "",
    `Hi ${memberName},`,
    "",
    `${administratorName} is setting up Hello to Cheers for ${venueName} and has been added as an Administrator.`,
    "",
    "You've been invited as an Owner so you can access the venue, see who is managing it, and control ownership and access permissions whenever you want.",
    "You don't need to finish day-to-day setup yourself — your Administrator can keep running the account while this invitation is pending.",
    "",
    `Accept Owner invitation: ${acceptUrl}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
