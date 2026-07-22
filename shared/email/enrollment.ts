/**
 * Post-purchase product emails for Hello to Cheers enrollments.
 *
 * Policy (Project 3):
 * - Always send Welcome (or Founder Welcome when foundingMember).
 * - When Welcome Back was requested, also send Welcome Back acknowledgment
 *   (verification remains pending — Project 5).
 * - When White Glove, also send Kickoff + White Glove Scheduling.
 * - Payment receipt companion is registry-only; Stripe sends the official receipt.
 */

import { sendRelationshipEmail } from "./send";
import type { EmailTemplateVars, RelationshipEmailResult } from "./types";

export type EnrollmentEmailContext = {
  relationshipId: string;
  customerEmail: string;
  venueName: string;
  planName: string;
  firstName?: string | null;
  foundingMember: boolean;
  welcomeBackRequested: boolean;
  onboardingType: "self_guided" | "white_glove" | "none" | string;
  schedulingUrl?: string | null;
};

function baseVars(ctx: EnrollmentEmailContext): EmailTemplateVars {
  return {
    firstName: ctx.firstName?.trim() || null,
    venueName: ctx.venueName,
    planName: ctx.planName,
    schedulingUrl: ctx.schedulingUrl ?? null,
  };
}

export async function sendEnrollmentProductEmails(
  ctx: EnrollmentEmailContext,
): Promise<RelationshipEmailResult[]> {
  const to = ctx.customerEmail.trim();
  if (!to) {
    console.warn("[email] skip enrollment product emails — no customer email");
    return [];
  }

  const vars = baseVars(ctx);
  const results: RelationshipEmailResult[] = [];
  const isWhiteGlove = ctx.onboardingType === "white_glove";

  results.push(
    await sendRelationshipEmail({
      relationshipId: ctx.relationshipId,
      to,
      templateId: ctx.foundingMember ? "founder_welcome" : "welcome",
      vars,
      meta: { trigger: "checkout.session.completed" },
    }),
  );

  if (ctx.welcomeBackRequested) {
    results.push(
      await sendRelationshipEmail({
        relationshipId: ctx.relationshipId,
        to,
        templateId: "welcome_back",
        vars,
        meta: { trigger: "checkout.session.completed", welcome_back: true },
      }),
    );
  }

  if (isWhiteGlove) {
    results.push(
      await sendRelationshipEmail({
        relationshipId: ctx.relationshipId,
        to,
        templateId: "kickoff",
        vars,
        meta: { trigger: "checkout.session.completed", white_glove: true },
      }),
    );
    results.push(
      await sendRelationshipEmail({
        relationshipId: ctx.relationshipId,
        to,
        templateId: "white_glove_scheduling",
        vars,
        meta: { trigger: "checkout.session.completed", white_glove: true },
      }),
    );
  }

  return results;
}
