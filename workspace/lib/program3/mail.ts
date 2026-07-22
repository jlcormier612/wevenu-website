import { sendRelationshipEmail } from "@shared/email";

import type { Relationship } from "@/lib/types";

import {
  appendLocalCommunication,
  appendLocalTimeline,
  bumpTemplateSent,
  getBrandingSync,
  getTemplateSync,
  newId,
} from "./store";
import { interpolate, varsForRelationship } from "./variables";

export type LibraryEmailDelivery = "sent" | "simulated" | "failed";

/**
 * Send a Communication Library template via @shared/email.
 * Always logs timeline `email_sent` + local communication (dry-run without RESEND_API_KEY).
 */
export async function sendLibraryTemplateEmail(
  relationship: Relationship,
  templateId: string,
  metaSource: "workflow" | "sequence" = "workflow",
): Promise<{ subject: string; delivery: LibraryEmailDelivery }> {
  const template = getTemplateSync(templateId);
  const branding = getBrandingSync();
  const vars = varsForRelationship(relationship);
  const subject = interpolate(template?.subject ?? "(missing template)", vars);
  const body = interpolate(template?.body ?? "", vars);
  const signedBody = `${body}\n\n—\n${branding.signatureHtml}`;
  const to = relationship.owner.email?.trim();
  const occurredAt = new Date().toISOString();

  let delivery: LibraryEmailDelivery = "simulated";
  let timelineId = newId("evt");
  let communicationId = newId("comm");

  if (to) {
    const result = await sendRelationshipEmail({
      relationshipId: relationship.id,
      to,
      templateId: "luv_suggestion",
      vars: {
        subject,
        body: signedBody,
        venueName: relationship.venue.name,
        firstName: relationship.owner.firstName,
      },
      subject,
      text: signedBody,
      authorName: branding.fromName,
      timelineTitle: `Email sent: ${subject}`,
      meta: {
        source: metaSource,
        communication_library_template_id: templateId,
      },
    });
    delivery = result.delivery;
    if (result.timelineEventId) timelineId = result.timelineEventId;
    if (result.communicationId) communicationId = result.communicationId;
  }

  const deliveryNote =
    delivery === "sent"
      ? `Sent via Resend from ${branding.fromName} <${branding.fromEmail}>`
      : delivery === "failed"
        ? `Send failed — logged from ${branding.fromName}`
        : `Dry-run / simulated from ${branding.fromName} <${branding.fromEmail}>`;

  await appendLocalCommunication({
    id: communicationId,
    relationshipId: relationship.id,
    channel: "email",
    subject,
    body: `${signedBody}\n\n[${deliveryNote}]`,
    direction: "outbound",
    occurredAt,
    authorName: branding.fromName,
  });

  await appendLocalTimeline({
    id: timelineId,
    relationshipId: relationship.id,
    type: "email_sent",
    title: `Email sent: ${subject}`,
    body: deliveryNote,
    occurredAt,
    meta: {
      templateId,
      simulated: delivery !== "sent",
      delivery,
      source: metaSource,
    },
  });

  if (templateId) await bumpTemplateSent(templateId);
  return { subject, delivery };
}
