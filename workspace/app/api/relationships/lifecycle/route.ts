import { NextResponse } from "next/server";

import { sendRelationshipEmail, sendReactivationEmail, activationUrlFromToken } from "@shared/email";
import {
  buildSubscriptionLinkPreview,
  createManualSubscription,
  isStandardDiscountEligibility,
  launchWhiteGloveWorkspace,
  loadLiveStore,
  reactivateRelationshipAccount,
  recordCustomerHandoff,
  recordSubscriptionLinkSent,
  refreshRelationshipHealth,
  resolveRelationshipStandardDiscount,
  subscriptionTermsFingerprint,
  suspendRelationshipAccount,
  tickPaymentDunning,
  tickRenewalStages,
  updateStandardDiscountEligibility,
  whiteGloveTimelineLabel,
  markDunningReminderSent,
  recordPaymentFailed,
  type PlanId,
} from "@shared/relationships";
import { enqueueProductSync } from "@shared/product-sync";

import { loadLifecycleSettings } from "@/lib/lifecycle-settings";
import { actorCan, requireWorkspaceStaff } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

export const runtime = "nodejs";

type Action =
  | "preview_subscription_link"
  | "send_subscription_link"
  | "set_standard_discount_eligibility"
  | "manual_subscription"
  | "resend_welcome"
  | "launch_workspace"
  | "record_customer_handoff"
  | "suspend"
  | "reactivate"
  | "send_payment_reminder"
  | "view_billing"
  | "tick_dunning"
  | "tick_renewals"
  | "refresh_health"
  | "save_implementation_notes"
  | "founder_extend_access"
  | "founder_clear_override"
  | "founder_pause_suspend"
  | "founder_retention_hold"
  | "founder_security_lock"
  | "get_entitlement";

/** In-memory confirm guards to reduce duplicate Checkout Sessions / emails. */
const recentSubscriptionConfirms = new Map<string, number>();
const CONFIRM_DEDUP_MS = 15_000;

function marketingBaseUrl(): string {
  return (
    process.env.MARKETING_URL ||
    process.env.NEXT_PUBLIC_MARKETING_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3001"
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
  const auth = await requireWorkspaceStaff();
  if (!auth.ok) return auth.response;
  await ensureProgram4Data();
  const actor = auth.actor;
  const body = (await request.json()) as {
    action?: Action;
    relationshipId?: string;
    plan?: string;
    onboardingType?: "self_guided" | "white_glove";
    emailLink?: boolean;
    /** Stage 1E — required true for Checkout Session + email side effects */
    confirm?: boolean;
    confirmToken?: string;
    previewMode?: "send" | "copy";
    termsFingerprint?: string;
    standardDiscountEligibility?: string;
    additionalVenueQualified?: boolean;
    ownerOverride?: boolean;
    reason?: string;
    notes?: string;
    /** Stage 1F — optional handoff note for record_customer_handoff */
    note?: string;
    mrrCents?: number;
    foundingMember?: boolean;
    implementationNotes?: string;
    implementationAssets?: Record<string, string>;
    accessOverrideUntil?: string;
    pauseBillingSuspend?: boolean;
    retentionHold?: boolean;
    manualSecurityLock?: boolean;
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

  if (action === "tick_renewals") {
    if (!(await actorCan("manage_settings")) && !(await actorCan("manage_product_sync"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const results = await tickRenewalStages();
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
    case "preview_subscription_link": {
      if (!(await actorCan("edit_relationships"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const mode = body.previewMode === "copy" ? "copy" : "send";
      const preview = buildSubscriptionLinkPreview({
        relationship,
        mode,
        planId: body.plan || relationship.planId,
        onboardingType:
          body.onboardingType ||
          (relationship.onboardingType === "white_glove"
            ? "white_glove"
            : "self_guided"),
        additionalVenueQualified: Boolean(body.additionalVenueQualified),
      });
      return NextResponse.json({
        ok: true,
        preview,
        termsFingerprint: subscriptionTermsFingerprint(preview.terms),
        // Explicit: preview never creates Stripe sessions or sends email.
        stripeSessionCreated: false,
        emailed: false,
      });
    }

    case "set_standard_discount_eligibility": {
      if (!(await actorCan("edit_relationships"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const eligibilityRaw = body.standardDiscountEligibility;
      if (!isStandardDiscountEligibility(eligibilityRaw)) {
        return NextResponse.json(
          { error: "Invalid standardDiscountEligibility" },
          { status: 400 },
        );
      }
      if (
        eligibilityRaw === "additional_venue" &&
        !body.additionalVenueQualified
      ) {
        return NextResponse.json(
          {
            error:
              "Additional venue discount requires a qualifying organization/venue relationship. Record the organization link first, or choose another eligibility.",
            code: "additional_venue_unqualified",
          },
          { status: 400 },
        );
      }
      const updated = await updateStandardDiscountEligibility(relationshipId, {
        eligibility: eligibilityRaw,
        evidence: "founder_recorded",
        actorId: actor.id,
      });
      if (!updated) {
        return NextResponse.json({ error: "Update failed" }, { status: 400 });
      }
      const resolved = resolveRelationshipStandardDiscount(updated);
      return NextResponse.json({
        ok: true,
        relationship: {
          id: updated.id,
          standardDiscountEligibility: resolved.eligibility,
          standardDiscountEvidence: resolved.evidence,
          welcomeBackRequested: updated.welcomeBackRequested,
          welcomeBackVerified: updated.welcomeBackVerified,
          foundingMember: updated.foundingMember,
        },
        message: "Standard discount eligibility updated. Founding slots are not consumed by this save.",
      });
    }

    case "send_subscription_link": {
      if (!(await actorCan("edit_relationships"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Stage 1E safety: Checkout Session + email require explicit confirm.
      if (body.confirm !== true) {
        return NextResponse.json(
          {
            error:
              "Confirmation required. Open the subscription review and click Confirm & Send or Confirm & Generate Link.",
            code: "confirm_required",
          },
          { status: 400 },
        );
      }

      const planTier = planToStripeTier(body.plan || relationship.planId);
      const onboardingType =
        body.onboardingType ||
        (relationship.onboardingType === "white_glove" ? "white_glove" : "self_guided");
      const emailLink = body.emailLink !== false;
      const resolved = resolveRelationshipStandardDiscount(relationship);
      const preview = buildSubscriptionLinkPreview({
        relationship,
        mode: emailLink ? "send" : "copy",
        planId: body.plan || relationship.planId,
        onboardingType,
        additionalVenueQualified: Boolean(body.additionalVenueQualified),
      });
      const expectedFp = subscriptionTermsFingerprint(preview.terms);
      if (
        body.termsFingerprint &&
        body.termsFingerprint !== expectedFp
      ) {
        return NextResponse.json(
          {
            error:
              "Commercial terms changed since preview. Re-open the review and confirm again.",
            code: "terms_mismatch",
            preview,
            termsFingerprint: expectedFp,
          },
          { status: 409 },
        );
      }

      const dedupKey = `${relationship.id}:${emailLink ? "send" : "copy"}:${expectedFp}`;
      const now = Date.now();
      const last = recentSubscriptionConfirms.get(dedupKey) ?? 0;
      if (now - last < CONFIRM_DEDUP_MS) {
        return NextResponse.json(
          {
            error:
              "This confirmation was already submitted. Wait a moment before generating another link.",
            code: "duplicate_confirm",
          },
          { status: 409 },
        );
      }
      recentSubscriptionConfirms.set(dedupKey, now);

      let checkoutUrl: string;
      let sessionId: string | null = null;
      try {
        const syncKey = process.env.PRODUCT_SYNC_API_KEY?.trim() || "";
        if (!syncKey) {
          recentSubscriptionConfirms.delete(dedupKey);
          return NextResponse.json(
            {
              error:
                "PRODUCT_SYNC_API_KEY is not configured — cannot authorize CRM Checkout.",
            },
            { status: 503 },
          );
        }
        const res = await fetch(`${marketingBaseUrl()}/api/stripe/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${syncKey}`,
          },
          body: JSON.stringify({
            plan: planTier,
            venue_name: relationship.venue.name,
            relationship_id: relationship.id,
            customer_email: relationship.owner.email,
            stripe_customer_id: relationship.stripeCustomerId || undefined,
            onboarding_type: onboardingType,
            // Actual checkout flag from resolved eligibility (not silent ignore).
            welcome_back: preview.terms.checkoutFlags.welcome_back,
          }),
        });
        const data = (await res.json()) as {
          url?: string;
          session_id?: string;
          error?: string;
        };
        if (!res.ok || !data.url) {
          recentSubscriptionConfirms.delete(dedupKey);
          return NextResponse.json(
            { error: data.error || "Failed to create checkout session" },
            { status: 502 },
          );
        }
        checkoutUrl = data.url;
        sessionId = data.session_id ?? null;
      } catch (error) {
        recentSubscriptionConfirms.delete(dedupKey);
        const message = error instanceof Error ? error.message : "Checkout failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }

      let emailed = false;
      let emailDelivery: "sent" | "simulated" | "failed" | "skipped" = "skipped";
      let emailError: string | null = null;
      if (emailLink) {
        if (!relationship.owner.email) {
          emailError = "No recipient email on this relationship.";
          emailDelivery = "failed";
        } else {
          const sendResult = await sendRelationshipEmail({
            relationshipId: relationship.id,
            to: relationship.owner.email,
            templateId: "subscription_link",
            vars: {
              firstName: relationship.owner.firstName,
              venueName: relationship.venue.name,
              planName: relationship.planName || preview.terms.planDisplayName,
              checkoutUrl,
            },
            actorId: actor.id,
            idempotencyKey: `sublink:${relationship.id}:${sessionId || checkoutUrl.slice(-24)}`,
            meta: {
              trigger: "lifecycle.send_subscription_link",
              eligibility: resolved.eligibility,
              terms_fingerprint: expectedFp,
            },
          });
          if (sendResult.ok) {
            emailed = true;
            emailDelivery =
              sendResult.delivery === "sent" ? "sent" : "simulated";
          } else {
            emailDelivery = "failed";
            emailError = sendResult.message || "Email delivery failed";
          }
        }
      }

      await recordSubscriptionLinkSent({
        relationshipId: relationship.id,
        checkoutUrl,
        planTier,
        actorId: actor.id,
        emailed,
      });

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      if (emailLink && emailDelivery === "failed") {
        return NextResponse.json({
          ok: true,
          url: checkoutUrl,
          sessionId,
          emailed: false,
          emailDelivery,
          emailError,
          expiresAt,
          terms: preview.terms,
          message:
            "Checkout link was created, but the email was not delivered. You can copy the link below and retry email later — a new Confirm will create a new session.",
          recovery: "copy_link",
        });
      }

      return NextResponse.json({
        ok: true,
        url: checkoutUrl,
        sessionId,
        emailed,
        emailDelivery,
        expiresAt,
        terms: preview.terms,
        message: emailed
          ? "Subscription link emailed. Checkout session created."
          : "Subscription link generated — not emailed.",
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
        // Token → welcome with Activate Account → product sync
        const activateUrl = result.relationship.activationToken
          ? activationUrlFromToken(result.relationship.activationToken)
          : null;
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
              activateUrl,
            },
            actorId: actor.id,
            meta: { trigger: "lifecycle.manual_subscription" },
          });
        }
        await enqueueProductSync(relationshipId, "manual_subscription");
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

      // White Glove customer access emails are Product HQ only (Finish White Glove Setup).
      // CRM may only resend the intake/welcome message — never welcome_home.
      if (isWg) {
        await sendRelationshipEmail({
          relationshipId,
          to: email,
          templateId: "white_glove_welcome",
          vars: {
            firstName: relationship.owner.firstName,
            venueName: relationship.venue.name,
            planName: relationship.planName,
            implementationTimeline: whiteGloveTimelineLabel(settings.whiteGlove),
          },
          actorId: actor.id,
          meta: { trigger: "lifecycle.resend_welcome", white_glove: true },
        });
        return NextResponse.json({
          ok: true,
          templateId: "white_glove_welcome",
          note: "White Glove access email is sent only from Product HQ Finish White Glove Setup.",
        });
      }

      const templateId = relationship.foundingMember ? "founder_welcome" : "welcome";
      const activateUrl = relationship.activationToken
        ? activationUrlFromToken(relationship.activationToken)
        : `${marketingBaseUrl()}/product`;

      await sendRelationshipEmail({
        relationshipId,
        to: email,
        templateId,
        vars: {
          firstName: relationship.owner.firstName,
          venueName: relationship.venue.name,
          planName: relationship.planName,
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

      // Internal CRM milestone only — no welcome_home, no activation token,
      // no product enrollment access mutation.
      return NextResponse.json({
        ok: true,
        message: launched.message,
        relationship: launched.relationship,
        customerAccessGranted: false,
      });
    }
    case "record_customer_handoff": {
      if (
        !(await actorCan("configure_white_glove")) &&
        !(await actorCan("manage_onboarding")) &&
        !(await actorCan("manage_product_sync"))
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const handed = await recordCustomerHandoff({
        relationshipId,
        actorId: actor.id,
        note: typeof body.note === "string" ? body.note : null,
      });
      if (!handed.ok) {
        return NextResponse.json({ error: handed.message }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        relationship: handed.relationship,
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

    case "get_entitlement": {
      if (!(await actorCan("manage_product_sync")) && !(await actorCan("view_finance"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const base = (
        process.env.PRODUCT_API_BASE_URL?.trim() || ""
      ).replace(/\/$/, "");
      const key = process.env.PRODUCT_SYNC_API_KEY?.trim() || "";
      if (!base || !key) {
        return NextResponse.json({
          ok: true,
          stripe: {
            customerId: relationship.stripeCustomerId ?? null,
            subscriptionId: relationship.stripeSubscriptionId ?? null,
            paymentStatus: relationship.paymentStatus ?? null,
          },
          dunning: relationship.dunning ?? null,
          product: null,
          note: "PRODUCT_API_BASE_URL unset — showing CRM facts only",
        });
      }
      const res = await fetch(`${base}/api/internal/product-access/entitlement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          action: "get",
          venueId: relationship.productSync?.venueId ?? null,
          ownerEmail: relationship.owner.email ?? null,
          stripeCustomerId: relationship.stripeCustomerId ?? null,
          relationshipId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        ok: res.ok,
        stripe: {
          customerId: relationship.stripeCustomerId ?? null,
          subscriptionId: relationship.stripeSubscriptionId ?? null,
        },
        dunning: relationship.dunning ?? null,
        product: data,
      });
    }

    case "founder_extend_access":
    case "founder_clear_override":
    case "founder_pause_suspend":
    case "founder_retention_hold":
    case "founder_security_lock": {
      if (!(await actorCan("manage_product_sync"))) {
        return NextResponse.json({ error: "Owner/Admin only" }, { status: 403 });
      }
      const reason = String(body.reason || "").trim();
      if (!reason) {
        return NextResponse.json(
          { error: "A reason is required for founder overrides." },
          { status: 400 },
        );
      }
      const { applyFounderOverrideRemote } = await import(
        "@shared/product-sync/entitlement-sync"
      );
      const payload: Parameters<typeof applyFounderOverrideRemote>[0] = {
        venueId: relationship.productSync?.venueId ?? null,
        ownerEmail: relationship.owner.email ?? null,
        relationshipId,
        stripeCustomerId: relationship.stripeCustomerId ?? null,
        actorId: actor.id,
        actorLabel: actor.name || actor.email || actor.id,
        reason,
        dunningStartedAt: relationship.dunning?.startedAt ?? null,
        dunningClearedAt: relationship.dunning?.clearedAt ?? null,
      };
      if (action === "founder_extend_access") {
        const until = String(body.accessOverrideUntil || "").trim();
        if (!until) {
          return NextResponse.json(
            { error: "accessOverrideUntil (ISO date) is required" },
            { status: 400 },
          );
        }
        payload.accessOverrideUntil = new Date(until).toISOString();
      }
      if (action === "founder_clear_override") {
        payload.clearOverride = true;
        payload.pauseBillingSuspend = false;
      }
      if (action === "founder_pause_suspend") {
        payload.pauseBillingSuspend = body.pauseBillingSuspend !== false;
      }
      if (action === "founder_retention_hold") {
        payload.retentionHold = body.retentionHold !== false;
        payload.retentionHoldReason = reason;
      }
      if (action === "founder_security_lock") {
        payload.manualSecurityLock = body.manualSecurityLock === true;
        payload.manualSecurityLockReason = reason;
      }
      const result = await applyFounderOverrideRemote(payload);
      // Timeline breadcrumb in CRM (access-only — Stripe unchanged).
      const { appendTimelineEvent } = await import("@shared/relationships");
      await appendTimelineEvent(relationshipId, {
        type: "note_added",
        title: `Founder override: ${action}`,
        body: `${reason} · ${result.detail}`,
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        meta: {
          founder_action: action,
          access_only: true,
          stripe_unchanged: true,
          ok: result.ok,
        },
      });
      return NextResponse.json({ ok: result.ok, result });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
