import { NextResponse } from "next/server";

import { sendRelationshipEmail, sendWelcomeHomeEmail, sendReactivationEmail } from "@shared/email";
import {
  createManualSubscription,
  launchWhiteGloveWorkspace,
  loadLiveStore,
  reactivateRelationshipAccount,
  recordSubscriptionLinkSent,
  refreshRelationshipHealth,
  suspendRelationshipAccount,
  tickPaymentDunning,
  whiteGloveTimelineLabel,
  markDunningReminderSent,
  recordPaymentFailed,
  type PlanId,
} from "@shared/relationships";
import { enqueueProductSync } from "@shared/product-sync";

import { loadLifecycleSettings } from "@/lib/lifecycle-settings";
import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

export const runtime = "nodejs";

type Action =
  | "send_subscription_link"
  | "manual_subscription"
  | "resend_welcome"
  | "launch_workspace"
  | "suspend"
  | "reactivate"
  | "send_payment_reminder"
  | "view_billing"
  | "tick_dunning"
  | "refresh_health"
  | "save_implementation_notes";

function marketingBaseUrl(): string {
  return (
    process.env.MARKETING_URL ||
    process.env.NEXT_PUBLIC_MARKETING_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

function workspaceBaseUrl(): string {
  return (
    process.env.WORKSPACE_URL ||
    process.env.NEXT_PUBLIC_WORKSPACE_URL ||
    "http://localhost:3002"
  ).replace(/\/$/, "");
}

function planToStripeTier(planId: PlanId | string): "starter" | "growing" | "professional" {
  const key = String(planId || "").toLowerCase();
  if (key === "celebrate" || key === "growing") return "growing";
  if (key === "flourish" || key === "professional") return "professional";
  return "starter";
}

/**
 * Customer Lifecycle Engine — owner/ops actions on a Relationship.
 */
export async function POST(request: Request) {
  await ensureProgram4Data();
  const actor = await getActingMember();
  const body = (await request.json()) as {
    action?: Action;
    relationshipId?: string;
    plan?: string;
    onboardingType?: "self_guided" | "white_glove";
    emailLink?: boolean;
    ownerOverride?: boolean;
    reason?: string;
    notes?: string;
    mrrCents?: number;
    foundingMember?: boolean;
    implementationNotes?: string;
    implementationAssets?: Record<string, string>;
  };

  const action = body.action;
  const relationshipId = body.relationshipId?.trim();
  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  if (action === "tick_dunning") {
    if (!(await actorCan("manage_settings")) && !(await actorCan("manage_product_sync"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const results = await tickPaymentDunning();
    return NextResponse.json({ ok: true, results });
  }

  if (!relationshipId) {
    return NextResponse.json({ error: "relationshipId required" }, { status: 400 });
  }

  const store = await loadLiveStore();
  const relationship = store.relationships.find((r) => r.id === relationshipId);
  if (!relationship) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  switch (action) {
    case "send_subscription_link": {
      if (!(await actorCan("edit_relationships"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Owner / Admin / Sales — edit_relationships covers Sales.
      const planTier = planToStripeTier(body.plan || relationship.planId);
      const onboardingType =
        body.onboardingType ||
        (relationship.onboardingType === "white_glove" ? "white_glove" : "self_guided");

      let checkoutUrl: string;
      let sessionId: string | null = null;
      try {
        const res = await fetch(`${marketingBaseUrl()}/api/stripe/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: planTier,
            venue_name: relationship.venue.name,
            relationship_id: relationship.id,
            customer_email: relationship.owner.email,
            stripe_customer_id: relationship.stripeCustomerId || undefined,
            onboarding_type: onboardingType,
            welcome_back: relationship.welcomeBackRequested,
          }),
        });
        const data = (await res.json()) as {
          url?: string;
          session_id?: string;
          error?: string;
        };
        if (!res.ok || !data.url) {
          return NextResponse.json(
            { error: data.error || "Failed to create checkout session" },
            { status: 502 },
          );
        }
        checkoutUrl = data.url;
        sessionId = data.session_id ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Checkout failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }

      const emailLink = body.emailLink !== false;
      let emailed = false;
      if (emailLink && relationship.owner.email) {
        await sendRelationshipEmail({
          relationshipId: relationship.id,
          to: relationship.owner.email,
          templateId: "subscription_link",
          vars: {
            firstName: relationship.owner.firstName,
            venueName: relationship.venue.name,
            planName: relationship.planName || planTier,
            checkoutUrl,
          },
          actorId: actor.id,
          meta: { trigger: "lifecycle.send_subscription_link" },
        });
        emailed = true;
      }

      await recordSubscriptionLinkSent({
        relationshipId: relationship.id,
        checkoutUrl,
        planTier,
        actorId: actor.id,
        emailed,
      });

      return NextResponse.json({
        ok: true,
        url: checkoutUrl,
        sessionId,
        emailed,
        message: emailed
          ? "Subscription link emailed and ready to copy."
          : "Subscription link ready to copy.",
      });
    }

    case "manual_subscription": {
      if (!(await actorCan("manage_product_sync")) && actor.role !== "owner" && actor.role !== "administrator") {
        return NextResponse.json({ error: "Owner/Admin only" }, { status: 403 });
      }
      const result = await createManualSubscription({
        relationshipId,
        planId: (body.plan as PlanId) || relationship.planId,
        onboardingType: body.onboardingType,
        foundingMember: body.foundingMember,
        mrrCents: body.mrrCents,
        actorId: actor.id,
        notes: body.notes,
      });
      if (!result) {
        return NextResponse.json({ error: "Failed" }, { status: 400 });
      }
      const settings = await loadLifecycleSettings();
      if (result.relationship.onboardingType !== "white_glove") {
        await enqueueProductSync(relationshipId, "manual_subscription");
        if (result.relationship.owner.email) {
          await sendRelationshipEmail({
            relationshipId,
            to: result.relationship.owner.email,
            templateId: result.relationship.foundingMember
              ? "founder_welcome"
              : "welcome",
            vars: {
              firstName: result.relationship.owner.firstName,
              venueName: result.relationship.venue.name,
              planName: result.relationship.planName,
            },
            actorId: actor.id,
            meta: { trigger: "lifecycle.manual_subscription" },
          });
        }
      } else if (result.relationship.owner.email) {
        await sendRelationshipEmail({
          relationshipId,
          to: result.relationship.owner.email,
          templateId: "white_glove_welcome",
          vars: {
            firstName: result.relationship.owner.firstName,
            venueName: result.relationship.venue.name,
            planName: result.relationship.planName,
            implementationTimeline: whiteGloveTimelineLabel(settings.whiteGlove),
          },
          actorId: actor.id,
          meta: { trigger: "lifecycle.manual_subscription", white_glove: true },
        });
      }
      return NextResponse.json({ ok: true, relationship: result.relationship });
    }

    case "resend_welcome": {
      if (!(await actorCan("edit_relationships"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const email = relationship.owner.email?.trim();
      if (!email) {
        return NextResponse.json({ error: "No owner email" }, { status: 400 });
      }
      const settings = await loadLifecycleSettings();
      const isWg = relationship.onboardingType === "white_glove";
      const stillImpl = relationship.status === "white_glove_implementation";
      const templateId = stillImpl
        ? "white_glove_welcome"
        : relationship.status === "active" || relationship.activationToken
          ? isWg
            ? "welcome_home"
            : relationship.foundingMember
              ? "founder_welcome"
              : "welcome"
          : relationship.foundingMember
            ? "founder_welcome"
            : "welcome";

      const activateUrl = relationship.activationToken
        ? `${workspaceBaseUrl()}/activate/${relationship.activationToken}`
        : `${marketingBaseUrl()}/product`;

      await sendRelationshipEmail({
        relationshipId,
        to: email,
        templateId,
        vars: {
          firstName: relationship.owner.firstName,
          venueName: relationship.venue.name,
          planName: relationship.planName,
          implementationTimeline: whiteGloveTimelineLabel(settings.whiteGlove),
          activateUrl,
        },
        actorId: actor.id,
        meta: { trigger: "lifecycle.resend_welcome" },
      });
      return NextResponse.json({ ok: true, templateId });
    }

    case "launch_workspace": {
      if (
        !(await actorCan("manage_onboarding")) &&
        !(await actorCan("manage_product_sync"))
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const ownerOverride =
        Boolean(body.ownerOverride) &&
        (actor.role === "owner" || actor.role === "administrator");
      const launched = await launchWhiteGloveWorkspace({
        relationshipId,
        actorId: actor.id,
        ownerOverride,
      });
      if (!launched.ok || !launched.relationship) {
        return NextResponse.json({ error: launched.message }, { status: 400 });
      }

      await enqueueProductSync(relationshipId, "white_glove.launch_workspace");

      const activateUrl = launched.activationToken
        ? `${workspaceBaseUrl()}/activate/${launched.activationToken}`
        : `${marketingBaseUrl()}/product`;

      if (launched.relationship.owner.email) {
        await sendWelcomeHomeEmail({
          relationshipId,
          customerEmail: launched.relationship.owner.email,
          venueName: launched.relationship.venue.name,
          firstName: launched.relationship.owner.firstName,
          activateUrl,
        });
      }

      return NextResponse.json({
        ok: true,
        message: launched.message,
        activationToken: launched.activationToken,
        activateUrl,
        relationship: launched.relationship,
      });
    }

    case "suspend": {
      if (!(await actorCan("manage_product_sync"))) {
        return NextResponse.json({ error: "Owner/Admin only" }, { status: 403 });
      }
      const updated = await suspendRelationshipAccount({
        relationshipId,
        actorId: actor.id,
        reason: body.reason,
      });
      if (updated?.owner.email) {
        await sendRelationshipEmail({
          relationshipId,
          to: updated.owner.email,
          templateId: "account_suspended",
          vars: {
            firstName: updated.owner.firstName,
            venueName: updated.venue.name,
          },
          actorId: actor.id,
          meta: { trigger: "lifecycle.suspend" },
        });
      }
      return NextResponse.json({ ok: true, relationship: updated });
    }

    case "reactivate": {
      if (!(await actorCan("manage_product_sync"))) {
        return NextResponse.json({ error: "Owner/Admin only" }, { status: 403 });
      }
      const updated = await reactivateRelationshipAccount({
        relationshipId,
        actorId: actor.id,
        reason: body.reason,
      });
      if (updated?.owner.email) {
        await sendReactivationEmail({
          relationshipId,
          customerEmail: updated.owner.email,
          venueName: updated.venue.name,
          firstName: updated.owner.firstName,
        });
      }
      return NextResponse.json({ ok: true, relationship: updated });
    }

    case "send_payment_reminder": {
      if (!(await actorCan("edit_relationships"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const failed = await recordPaymentFailed({ relationshipId });
      const day = failed.reminderDay ?? 0;
      const email = relationship.owner.email?.trim();
      if (!email) {
        return NextResponse.json({ error: "No owner email" }, { status: 400 });
      }

      let billingPortalUrl: string | null = null;
      if (relationship.stripeCustomerId) {
        try {
          const res = await fetch(`${marketingBaseUrl()}/api/stripe/portal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customer_id: relationship.stripeCustomerId }),
          });
          const data = (await res.json()) as { url?: string };
          billingPortalUrl = data.url ?? null;
        } catch {
          billingPortalUrl = null;
        }
      }

      await sendRelationshipEmail({
        relationshipId,
        to: email,
        templateId: day >= 21 ? "account_suspended" : "payment_reminder",
        vars: {
          firstName: relationship.owner.firstName,
          venueName: relationship.venue.name,
          dunningDay: day,
          billingPortalUrl,
        },
        actorId: actor.id,
        meta: { trigger: "lifecycle.send_payment_reminder", dunning_day: day },
      });
      await markDunningReminderSent(relationshipId, day as 0 | 3 | 7 | 14 | 21);
      return NextResponse.json({ ok: true, dunningDay: day, billingPortalUrl });
    }

    case "view_billing": {
      if (!(await actorCan("edit_relationships")) && !(await actorCan("view_finance"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!relationship.stripeCustomerId) {
        return NextResponse.json(
          { error: "No Stripe customer on this Relationship" },
          { status: 400 },
        );
      }
      try {
        const res = await fetch(`${marketingBaseUrl()}/api/stripe/portal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: relationship.stripeCustomerId }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          return NextResponse.json(
            { error: data.error || "Portal failed" },
            { status: 502 },
          );
        }
        return NextResponse.json({ ok: true, url: data.url });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Portal failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    case "refresh_health": {
      if (!(await actorCan("view_relationships"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const snapshot = await refreshRelationshipHealth(relationshipId);
      return NextResponse.json({ ok: true, health: snapshot });
    }

    case "save_implementation_notes": {
      if (!(await actorCan("manage_onboarding"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { updateRelationshipFields } = await import("@shared/relationships");
      const updated = await updateRelationshipFields(relationshipId, {
        implementationNotes: body.implementationNotes,
        implementationAssets: body.implementationAssets as never,
        lastTeamActivityAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, relationship: updated });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
