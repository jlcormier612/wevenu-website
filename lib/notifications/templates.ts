import type { NotificationRole } from "@/lib/notifications/types";

const SAGE = "#5D6F5D";
const ROSE = "#D8A7AA";
const LINEN = "#F7F5F1";

function formatDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}

type ReminderEmailContext = {
  taskTitle: string;
  eventName: string;
  eventDate: string;
  dueDate: string;
  role: NotificationRole;
  reminderType: string;
  portalToken?: string;     // couple portal access token for portal link
  venueBaseUrl: string;
  venueName: string;
};

export function buildReminderEmail(ctx: ReminderEmailContext): { subject: string; html: string; text: string } {
  const du = daysUntil(ctx.dueDate);
  const isOverdue = du < 0;
  const isDueToday = du === 0;

  let urgencyLine: string;
  if (isOverdue) urgencyLine = `This task is ${Math.abs(du)} day${Math.abs(du) !== 1 ? "s" : ""} overdue.`;
  else if (isDueToday) urgencyLine = "This task is due today.";
  else urgencyLine = `This task is due in ${du} day${du !== 1 ? "s" : ""} (${formatDate(ctx.dueDate)}).`;

  const isCoordinator = ctx.role === "coordinator";
  const actionUrl = isCoordinator
    ? `${ctx.venueBaseUrl}/events`
    : ctx.portalToken
    ? `${ctx.venueBaseUrl}/p/${ctx.portalToken}`
    : ctx.venueBaseUrl;
  const actionLabel = isCoordinator ? "View in Wevenu →" : "View your planning workspace →";

  const subject = isOverdue
    ? `Overdue: "${ctx.taskTitle}" — ${ctx.eventName}`
    : isDueToday
    ? `Due today: "${ctx.taskTitle}" — ${ctx.eventName}`
    : `Reminder: "${ctx.taskTitle}" due ${du === 1 ? "tomorrow" : `in ${du} days`} — ${ctx.eventName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${LINEN};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${LINEN};padding:32px 16px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #DED6CA;">
        <!-- Header -->
        <tr><td style="background:${SAGE};padding:20px 28px;">
          <p style="margin:0;color:#fff;font-size:13px;letter-spacing:0.05em;">${ctx.venueName}</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">${ctx.eventName}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px;">
          <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#1a1a1a;">${ctx.taskTitle}</p>
          <p style="margin:0 0 20px;font-size:13px;color:${isOverdue ? "#C0392B" : isCoordinator ? SAGE : "#666"};">${urgencyLine}</p>
          ${ctx.role === "couple" ? `
          <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.6;">
            ${isOverdue
              ? "This planning step is past due. Please complete it when you get a chance so your planning stays on track."
              : "Your planning workspace has a step that needs your attention."
            }
          </p>` : `
          <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.6;">
            ${isOverdue
              ? "This task requires attention. You can mark it complete, waive it, or reassign the due date."
              : "This task is coming up. Review and take action in Wevenu."
            }
          </p>`}
          <a href="${actionUrl}" style="display:inline-block;background:${SAGE};color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:500;">${actionLabel}</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 28px;border-top:1px solid #F0EDE9;">
          <p style="margin:0;font-size:11px;color:#B8AEA1;">
            Sent by ${ctx.venueName} via Wevenu. ${ctx.role === "couple" ? `<a href="${ctx.venueBaseUrl}/p/${ctx.portalToken ?? ""}" style="color:${ROSE};text-decoration:none;">Manage your workspace</a>` : ""}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${ctx.venueName} — ${ctx.eventName}\n\n${ctx.taskTitle}\n${urgencyLine}\n\n${actionLabel}\n${actionUrl}`;

  return { subject, html, text };
}
