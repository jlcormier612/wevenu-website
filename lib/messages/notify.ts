const RESEND_URL = "https://api.resend.com/emails";

const FROM = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";

function html(senderName: string, preview: string, ctaUrl: string, ctaLabel: string): string {
  const escaped = preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:40px auto;color:#2D2B28">
<p style="font-size:16px;font-weight:600;margin-bottom:8px">💬 New message from ${senderName}</p>
<div style="background:#F5F3EF;border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:14px;color:#3D3A35;line-height:1.5">
  ${escaped}
</div>
<a href="${ctaUrl}" style="display:inline-block;background:#5D6F5D;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500">${ctaLabel}</a>
<p style="margin-top:24px;font-size:11px;color:#9A9188">Wevenu · Your venue planning platform</p>
</body></html>`;
}

export async function sendMessageEmail({
  to,
  senderName,
  bodyPreview,
  ctaUrl,
  ctaLabel,
}: {
  to: string;
  senderName: string;
  bodyPreview: string;
  ctaUrl: string;
  ctaLabel: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[messages] DEV notify → ${to} | ${senderName}: ${bodyPreview.slice(0, 60)}`);
    return;
  }
  const subject = `💬 New message from ${senderName}`;
  await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html: html(senderName, bodyPreview, ctaUrl, ctaLabel),
      text: `New message from ${senderName}:\n\n${bodyPreview}\n\nReply at: ${ctaUrl}`,
    }),
  }).catch(err => console.error("[messages] notify failed:", err));
}
