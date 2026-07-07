const RESEND_URL = "https://api.resend.com/emails";
const FROM = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";
const INTERNAL_EMAIL = process.env.WEVENU_INTERNAL_EMAIL ?? "feedback@wevenu.com";

const TYPE_LABELS: Record<string, string> = {
  support: "Support Request",
  bug:     "Bug Report",
  feature: "Feature Idea",
  nps:     "NPS Rating",
  general: "General Feedback",
};

type Meta = Record<string, string | number | null>;

function html(type: string, subject: string | null, body: string, rating: number | null, userEmail: string, venueName: string, metadata: Meta): string {
  const label   = TYPE_LABELS[type] ?? type;
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ratingHtml = rating != null
    ? `<p style="font-size:14px;margin-bottom:8px"><strong>NPS Rating:</strong> ${rating}/10</p>`
    : "";
  const metaRows = Object.entries(metadata)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<tr><td style="padding:2px 8px 2px 0;color:#9A9188;font-size:12px;white-space:nowrap">${k.replace(/_/g, " ")}</td><td style="padding:2px 0;font-size:12px">${v}</td></tr>`)
    .join("");
  const metaHtml = metaRows
    ? `<table style="margin-top:16px;border-top:1px solid #EDE9E3;padding-top:12px;width:100%">${metaRows}</table>`
    : "";
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:40px auto;color:#2D2B28">
<p style="font-size:18px;font-weight:700;margin-bottom:4px">📬 ${label}</p>
<p style="font-size:13px;color:#9A9188;margin-bottom:20px">from ${userEmail} · ${venueName}</p>
${subject ? `<p style="font-size:14px;font-weight:600;margin-bottom:8px">${subject.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : ""}
${ratingHtml}
<div style="background:#F5F3EF;border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:14px;color:#3D3A35;line-height:1.6;white-space:pre-wrap">${escaped}</div>
${metaHtml}
<p style="margin-top:24px;font-size:11px;color:#9A9188">Wevenu Platform · Internal Notification</p>
</body></html>`;
}

export async function sendFeedbackEmail({
  type, subject, body, rating, userEmail, venueName, metadata = {},
}: {
  type:      string;
  subject:   string | null;
  body:      string;
  rating:    number | null;
  userEmail: string;
  venueName: string;
  metadata?: Meta;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[feedback] DEV notify → ${type} from ${userEmail}: ${body.slice(0, 60)}`);
    return;
  }
  const label   = TYPE_LABELS[type] ?? type;
  const subject_ = `[Wevenu Feedback] ${label}${subject ? `: ${subject}` : ""}`;
  await fetch(RESEND_URL, {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    FROM,
      to:      INTERNAL_EMAIL,
      subject: subject_,
      html:    html(type, subject, body, rating, userEmail, venueName, metadata),
      text:    `${label} from ${userEmail} (${venueName})\n\n${subject ? subject + "\n\n" : ""}${rating != null ? `Rating: ${rating}/10\n\n` : ""}${body}`,
    }),
  }).catch(err => console.error("[feedback] notify failed:", err));
}
