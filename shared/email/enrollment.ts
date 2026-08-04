/**
 * Post-purchase product emails for Hello to Cheers enrollments.
 *
 * Policy (Customer Lifecycle Engine Phase 1):
 * - Launch Yourself (self_guided): Welcome / Founder Welcome (+ Welcome Back ack).
 *   One message with Activate Account link when `activateUrl` is provided.
 *   Caller must mint activationToken before send; product sync may follow.
 * - White Glove: White Glove Welcome only (no credentials). Kickoff optional.
 *   Do NOT send Launch Yourself welcome that implies product access.
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
  /** e.g. "5–7 business days" */
  implementationTimeline?: string | null;
  activateUrl?: string | null;
};

function baseVars(ctx: EnrollmentEmailContext): EmailTemplateVars {
  return {
    firstName: ctx.firstName?.trim() || null,
    venueName: ctx.venueName,
    planName: ctx.planName,
    schedulingUrl: ctx.schedulingUrl ?? null,
    implementationTimeline: ctx.implementationTimeline ?? null,
    activateUrl: ctx.activateUrl ?? null,
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

  if (isWhiteGlove) {
    results.push(
      await sendRelationshipEmail({
        relationshipId: ctx.relationshipId,
        to,
        templateId: "white_glove_welcome",
        vars,
        meta: { trigger: "checkout.session.completed", white_glove: true },
      }),
    );

    if (ctx.welcomeBackRequested) {
      results.push(
        await sendRelationshipEmail({
          relationshipId: ctx.relationshipId,
          to,
          templateId: "welcome_back",
          vars,
          meta: {
            trigger: "checkout.session.completed",
            welcome_back: true,
            white_glove: true,
          },
        }),
      );
    }

    // Optional companion scheduling note (no credentials).
    results.push(
      await sendRelationshipEmail({
        relationshipId: ctx.relationshipId,
        to,
        templateId: "kickoff",
        vars,
        meta: { trigger: "checkout.session.completed", white_glove: true },
      }),
    );

    return results;
  }

  // Launch Yourself / self-guided
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

  return results;
}

/** Welcome Home after White Glove Launch Workspace. */
export async function sendWelcomeHomeEmail(input: {
  relationshipId: string;
  customerEmail: string;
  venueName: string;
  firstName?: string | null;
  activateUrl: string;
}): Promise<RelationshipEmailResult | null> {
  const to = input.customerEmail.trim();
  if (!to) return null;
  return sendRelationshipEmail({
    relationshipId: input.relationshipId,
    to,
    templateId: "welcome_home",
    vars: {
      firstName: input.firstName,
      venueName: input.venueName,
      activateUrl: input.activateUrl,
    },
    meta: { trigger: "white_glove.launch_workspace" },
  });
}

/** Reactivation email after payment success / manual reactivate. */
export async function sendReactivationEmail(input: {
  relationshipId: string;
  customerEmail: string;
  venueName: string;
  firstName?: string | null;
}): Promise<RelationshipEmailResult | null> {
  const to = input.customerEmail.trim();
  if (!to) return null;
  return sendRelationshipEmail({
    relationshipId: input.relationshipId,
    to,
    templateId: "account_reactivated",
    vars: {
      firstName: input.firstName,
      venueName: input.venueName,
    },
    meta: { trigger: "lifecycle.reactivated" },
  });
}
