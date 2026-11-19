import { htcEmailLogoHeaderHtml } from "@/shared/brand/logo";
import { sendEmail } from "@/lib/email/send";

function html(senderName: string, preview: string, ctaUrl: string, ctaLabel: string, eventName?: string): string {
  const escaped = preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const eventLine = eventName
    ? `<p style="font-size:13px;color:#6B6560;margin:0 0 12px">Event: ${eventName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "";
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:40px auto;color:#2D2B28">
${htcEmailLogoHeaderHtml()}
<p style="font-size:16px;font-weight:600;margin-bottom:8px">💬 New message from ${senderName}</p>
${eventLine}
<div style="background:#F5F3EF;border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:14px;color:#3D3A35;line-height:1.5">
  ${escaped}
</div>
<a href="${ctaUrl}" style="display:inline-block;background:#5D6F5D;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500">${ctaLabel}</a>
<p style="margin-top:24px;font-size:11px;color:#9A9188">Hello to Cheers · Your venue planning platform</p>
</body></html>`;
}

export async function sendMessageEmail({
  to,
  senderName,
  bodyPreview,
  ctaUrl,
  ctaLabel,
  subject,
  eventName,
}: {
  to: string;
  senderName: string;
  bodyPreview: string;
  ctaUrl: string;
  ctaLabel: string;
  /** Optional override — defaults to "New message from {senderName}". */
  subject?: string;
  eventName?: string;
}): Promise<void> {
  const resolvedSubject = subject ?? `💬 New message from ${senderName}`;
  const textParts = [
    `You have a new message from ${senderName}.`,
    eventName ? `Event: ${eventName}` : null,
    "",
    bodyPreview,
    "",
    `Reply at: ${ctaUrl}`,
  ].filter((line): line is string => line !== null);

  const result = await sendEmail({
    to,
    subject: resolvedSubject,
    html: html(senderName, bodyPreview, ctaUrl, ctaLabel, eventName),
    text: textParts.join("\n"),
    category: "message_alert",
  });
  if (!result.ok) {
    console.error("[messages] notify failed:", result.message);
  }
}
