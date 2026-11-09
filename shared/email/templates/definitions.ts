import type { EmailTemplateDefinition } from "../types";
import {
  ctaButtonHtml,
  escapeHtml,
  firstName,
  marketingUrl,
  paragraphsToHtml,
  planName,
  previewFromText,
  venueName,
  wrapHelloHtml,
} from "./helpers";

function activateUrlFromVars(vars: Parameters<EmailTemplateDefinition["render"]>[0]): string {
  return String(vars.activateUrl || "").trim();
}

function launchYourselfBodyParts(input: {
  name: string;
  venue: string;
  plan: string;
  activateUrl: string;
  founding: boolean;
}): { beforeActivate: string[]; afterActivate: string[] } {
  const { name, venue, plan, activateUrl, founding } = input;
  const beforeActivate = founding
    ? [
        `Hi ${name},`,
        `Thank you for joining Hello to Cheers as a Founding Member. We're so excited to welcome ${venue}.`,
        `Your ${plan} Founding subscription is confirmed — you're ready to set up your workspace.`,
        `Founding Members help shape what we build next, and you'll always have a direct line to us.`,
      ]
    : [
        `Hi ${name},`,
        `Thank you for joining Hello to Cheers. We're glad ${venue} is here.`,
        `Your ${plan} subscription is active — you're ready to set up your workspace.`,
      ];
  const afterActivate = [
    `Activate Account: ${activateUrl}`,
    `What happens next`,
    `Activate your account, create your password, and we'll walk you through the important pieces of your venue setup, one step at a time. You can take it at your own pace.`,
    `Questions? Just reply to this email — Jennifer and the team are listening.`,
  ];
  return { beforeActivate, afterActivate };
}

export const welcomeTemplate: EmailTemplateDefinition = {
  id: "welcome",
  name: "Welcome",
  description:
    "Launch Yourself welcome — includes Activate Account link (no plaintext password).",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const activateUrl = activateUrlFromVars(vars);
    const subject = `Welcome to Hello to Cheers — ${venue}`;
    const { beforeActivate, afterActivate } = launchYourselfBodyParts({
      name,
      venue,
      plan,
      activateUrl,
      founding: false,
    });
    const paragraphs = [...beforeActivate, ...afterActivate];
    const text = paragraphs.join("\n\n");
    const htmlBody = [
      paragraphsToHtml(beforeActivate),
      ctaButtonHtml("Activate Account", activateUrl),
      paragraphsToHtml(afterActivate.slice(1)),
    ].join("\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Welcome", htmlBody),
      preview: previewFromText(text),
      timelineTitle: "Welcome Email Sent",
    };
  },
};

export const founderWelcomeTemplate: EmailTemplateDefinition = {
  id: "founder_welcome",
  name: "Founder Welcome",
  description:
    "Founding Member Launch Yourself welcome — includes Activate Account link (no plaintext password).",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const activateUrl = activateUrlFromVars(vars);
    const subject = `You're a Founding Member — welcome, ${name}`;
    const { beforeActivate, afterActivate } = launchYourselfBodyParts({
      name,
      venue,
      plan,
      activateUrl,
      founding: true,
    });
    const paragraphs = [...beforeActivate, ...afterActivate];
    const text = paragraphs.join("\n\n");
    const htmlBody = [
      paragraphsToHtml(beforeActivate),
      ctaButtonHtml("Activate Account", activateUrl),
      paragraphsToHtml(afterActivate.slice(1)),
    ].join("\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Founding Member Welcome", htmlBody),
      preview: previewFromText(text),
      timelineTitle: "Founder Welcome Email Sent",
    };
  },
};

export const welcomeBackTemplate: EmailTemplateDefinition = {
  id: "welcome_back",
  name: "Welcome Back",
  description:
    "Acknowledgment when Welcome Back is requested at checkout or via form (verification still pending).",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const subject = `We received your Welcome Back note — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `We received your Welcome Back request for ${venue}. Thank you for coming back to us.`,
      `Our team will review your note and follow up personally. Welcome Back verification is intentional — not automatic — so we can honor your history with care.`,
      `In the meantime, your subscription is active and you can begin settling in.`,
      `Questions? Just reply here.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Welcome Back", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Welcome Back Email Sent",
    };
  },
};

export const welcomeBackVerifiedTemplate: EmailTemplateDefinition = {
  id: "welcome_back_verified",
  name: "Welcome Back Verified",
  description:
    "Sent when ops approves Welcome Back — confirms Founding Member pricing eligibility.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const subject = `Welcome Back verified — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `Good news: we've verified your Welcome Back request for ${venue}.`,
      `You're confirmed for Founding Member pricing on your ${plan} plan. Thank you for trusting us again — we're glad you're here.`,
      `If anything feels unclear, just reply. We're listening.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Welcome Back Verified", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Welcome Back Verified Email Sent",
    };
  },
};

export const welcomeBackRejectedTemplate: EmailTemplateDefinition = {
  id: "welcome_back_rejected",
  name: "Welcome Back Not Verified",
  description: "Light note when Welcome Back verification is not approved.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const subject = `A note about your Welcome Back request — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `Thank you for reaching out about Welcome Back for ${venue}.`,
      `After review, we weren't able to verify Welcome Back eligibility for this request. Your subscription and plan remain as they are — nothing else changes on your account.`,
      `If you believe we missed something, reply with a little more context and we'll take another look with care.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Welcome Back update", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Welcome Back Rejection Email Sent",
    };
  },
};

export const kickoffTemplate: EmailTemplateDefinition = {
  id: "kickoff",
  name: "Kickoff (White Glove)",
  description: "White Glove / onboarding kickoff note after purchase.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const subject = `White Glove kickoff for ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `Thank you for choosing White Glove Setup for ${venue}.`,
      `We'll guide your kickoff personally — configuration, first workflows, and the quiet details that make the first weeks feel calm instead of chaotic.`,
      `Next: watch for a short scheduling note so we can lock a kickoff call that fits your calendar.`,
      `Reply anytime if you'd like to share context before we meet.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("White Glove Kickoff", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Kickoff Email Sent",
    };
  },
};

export const whiteGloveSchedulingTemplate: EmailTemplateDefinition = {
  id: "white_glove_scheduling",
  name: "White Glove Scheduling",
  description: "Ask the venue to schedule their White Glove kickoff call.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const schedulingUrl =
      String(vars.schedulingUrl || "").trim() || marketingUrl("/contact");
    const subject = `Schedule your White Glove kickoff — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `Let's schedule the White Glove kickoff for ${venue}.`,
      `Pick a time that works for you here: ${schedulingUrl}`,
      `Come with any questions about tours, proposals, payments, or how your team works today — we'll meet you where you are.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Schedule Kickoff", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "White Glove Scheduling Email Sent",
    };
  },
};

export const whiteGloveWelcomeTemplate: EmailTemplateDefinition = {
  id: "white_glove_welcome",
  name: "White Glove Welcome",
  description:
    "Welcome after White Glove purchase — no credentials; points to short intake.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const intakeUrl = String(vars.intakeUrl || "").trim();
    const subject = `Let's get ${venue} ready — White Glove Setup`;
    const before = [
      `Hi ${name},`,
      `Thank you for choosing White Glove Setup for ${venue}. Your ${plan} subscription is confirmed.`,
      `You've chosen White Glove Setup. We'll build your Hello to Cheers workspace using the information and materials you provide.`,
      `You don't need to configure everything yourself.`,
      `Every venue is a little different. We'll get started as soon as we have what we need and keep you updated along the way. The sooner you send your materials and answer any questions, the sooner we'll have your workspace ready to use.`,
    ];
    const after = [
      `You won't receive login credentials yet — we'll invite you when your workspace is ready.`,
      `Questions? Just reply — we're right here.`,
    ];
    const text = [
      ...before,
      intakeUrl
        ? `Share a few details about your venue here: ${intakeUrl}`
        : `We'll send you a short link to share your venue information shortly.`,
      ...after,
    ].join("\n\n");
    const htmlBody = intakeUrl
      ? paragraphsToHtml(before) +
        `<p style="margin:0 0 8px;font-size:16px;line-height:1.55;color:#1f2937">Share a few details about your venue:</p>` +
        ctaButtonHtml("Share venue details", intakeUrl) +
        paragraphsToHtml(after)
      : paragraphsToHtml([
          ...before,
          `We'll send you a short link to share your venue information shortly.`,
          ...after,
        ]);
    return {
      subject,
      text,
      html: wrapHelloHtml("White Glove Welcome", htmlBody),
      preview: previewFromText(text),
      timelineTitle: "White Glove Welcome Email Sent",
    };
  },
};

export const welcomeHomeTemplate: EmailTemplateDefinition = {
  id: "welcome_home",
  name: "Welcome Home",
  description:
    "Sent when White Glove Setup is finished — includes Set Up Your Login link.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const activateUrl = activateUrlFromVars(vars);
    const subject = `Your Hello to Cheers workspace is ready — ${venue}`;
    const before = [
      `Hi ${name},`,
      `We've finished setting up your workspace and it's ready for you.`,
    ];
    const after = [
      `When you sign in, we'll walk you through anything that's still yours to decide.`,
    ];
    const text = [...before, activateUrl ? `Set Up Your Login: ${activateUrl}` : "", ...after]
      .filter(Boolean)
      .join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml(
        "Your workspace is ready",
        paragraphsToHtml(before) +
          (activateUrl
            ? `<p style="margin:24px 0"><a href="${escapeHtml(activateUrl)}" style="display:inline-block;background:#5D6F5D;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">Set Up Your Login</a></p>`
            : "") +
          paragraphsToHtml(after),
      ),
      preview: previewFromText(text),
      timelineTitle: "White Glove Access Email Sent",
    };
  },
};

/**
 * Full three-sided / client-vendor notice copy is Phase 2.
 * Keep it prepared but gated so Sandbox cannot send those claims early.
 * Enable only when HTC_PHASE2_LIFECYCLE_COMMS=true after Phase 2 is GREEN.
 */
function phase2LifecycleCommsEnabled(): boolean {
  return process.env.HTC_PHASE2_LIFECYCLE_COMMS === "true";
}

export const paymentReminderTemplate: EmailTemplateDefinition = {
  id: "payment_reminder",
  name: "Payment Reminder",
  description: "Failed-payment dunning reminder with optional billing portal link.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const day = Number(vars.dunningDay ?? "0");
    const portalUrl = String(vars.billingPortalUrl || "").trim();
    const accessEndsRaw = String(vars.accessEndsAt || "").trim();
    const accessEndsLabel = accessEndsRaw
      ? new Date(accessEndsRaw).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }) + " (UTC)"
      : null;
    const phase2 = phase2LifecycleCommsEnabled();
    const subject =
      day >= 14
        ? `Action required — Your Hello to Cheers access may end soon`
        : day >= 7
          ? `Reminder: update payment for ${venue}`
          : `Action needed: update payment for ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `We weren't able to process the latest payment for ${venue}'s Hello to Cheers subscription.`,
      portalUrl
        ? `You can resolve this securely here: ${portalUrl}`
        : `Please update your payment method from the billing email Stripe sent, or reply and we'll help.`,
    ];
    if (day >= 7 && accessEndsLabel) {
      paragraphs.push(
        phase2
          ? `If this isn't resolved by ${accessEndsLabel}, access to your venue workspace will be suspended. Connected client portals, vendor workspaces, wedding websites, and automated communications that depend on your subscription will also stop when that date arrives.`
          : `If this isn't resolved by ${accessEndsLabel}, access to your venue workspace will be suspended. Your venue data will be preserved.`,
      );
      paragraphs.push(
        phase2
          ? `Before then, please export any information you wish to retain from Settings → Team & Data → Export my data. Clients can use Export my data in their planning portal. Vendors can download documents available in their workspace.`
          : `Before then, please export any information you wish to retain from Settings → Team & Data → Export my data (or from the recovery screen if access is already paused).`,
      );
    }
    if (day >= 14) {
      if (phase2) {
        paragraphs.push(
          `Beginning seven days before the scheduled suspension, clients and vendors who sign in may see a discreet in-app notice about the date their workspace becomes unavailable. Hello to Cheers will not email or text your clients or vendors about this change, and we will not share the reason. We encourage you to communicate with them directly.`,
        );
      }
      paragraphs.push(
        `Your account information will be retained for a limited recovery period after suspension, subject to our retention policy.`,
      );
    } else if (day >= 7) {
      if (phase2) {
        paragraphs.push(
          `If the issue remains unresolved, client and vendor in-app notices will begin seven days before suspension. Hello to Cheers will not email or text your clients or vendors about this change.`,
        );
      } else {
        paragraphs.push(
          `Your services remain available until the suspension date above. Please update billing to avoid interruption.`,
        );
      }
    } else {
      paragraphs.push(
        `No action needed if you've already updated your card — thank you. Your services remain fully available while we work through this.`,
      );
    }
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Payment reminder", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: `Payment Reminder Email Sent (Day ${day})`,
    };
  },
};

export const accountSuspendedTemplate: EmailTemplateDefinition = {
  id: "account_suspended",
  name: "Account Suspended",
  description: "Day-21 suspension notice — access disabled, data preserved.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const portalUrl = String(vars.billingPortalUrl || "").trim();
    const subject = `Access paused for ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `We've paused access to Hello to Cheers for ${venue} because payment is still unresolved.`,
      `Your venue data is preserved. You can update your payment method to restore access${portalUrl ? `: ${portalUrl}` : "."}`,
      `While access is paused, authorized owners can still open billing recovery and export venue data from the recovery screen.`,
      `Reply anytime — we're here to help you get back online.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Access paused", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Suspension Email Sent",
    };
  },
};

export const accountReactivatedTemplate: EmailTemplateDefinition = {
  id: "account_reactivated",
  name: "Account Reactivated",
  description: "Welcome-back style note after payment success or manual reactivation.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const subject = `Welcome back — ${venue} is active again`;
    const paragraphs = [
      `Hi ${name},`,
      `Good news: access for ${venue} is restored. Welcome back.`,
      `Everything you had before is still here. If you need a hand settling back in, just reply.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Welcome back", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Reactivation Email Sent",
    };
  },
};

export const subscriptionLinkTemplate: EmailTemplateDefinition = {
  id: "subscription_link",
  name: "Subscription Link",
  description: "Owner/Sales sends a Stripe Checkout link for an existing Relationship.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const checkoutUrl =
      String(vars.checkoutUrl || "").trim() || marketingUrl("/pricing");
    const subject = `Your Hello to Cheers subscription link — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `Here's your personal checkout link for ${venue} (${plan}):`,
      checkoutUrl,
      `This link takes you straight to secure checkout — no need to start from the public pricing page.`,
      `Questions before you subscribe? Just reply.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Subscription link", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Subscription Link Email Sent",
    };
  },
};

export const paymentReceiptTemplate: EmailTemplateDefinition = {
  id: "payment_receipt",
  name: "Payment Receipt Companion",
  description:
    "Optional companion note alongside Stripe's built-in receipt. Registry-ready; not auto-sent.",
  status: "registry",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const amount = String(vars.amountLabel || "").trim() || "your payment";
    const subject = `Payment received — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `We've received ${amount} for ${venue} (${plan}).`,
      `Stripe also sends an official receipt to this inbox. This note is just a warm companion from our team.`,
      `Thank you for trusting Hello to Cheers.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Payment received", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Payment Receipt Companion Sent",
    };
  },
};

export const trialReminderTemplate: EmailTemplateDefinition = {
  id: "trial_reminder",
  name: "Trial Reminder",
  description: "Stub template for trial-ending reminders (trial not live yet).",
  status: "registry",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const days = String(vars.daysRemaining ?? "a few");
    const subject = `Your Hello to Cheers trial for ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `A quick note: ${days} day(s) remain on the Hello to Cheers trial for ${venue}.`,
      `If you'd like help deciding on a plan — or want White Glove setup — reply and we'll walk with you.`,
      `No pressure. Just a clear next step when you're ready.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Trial reminder", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Trial Reminder Email Sent",
    };
  },
};

export const renewalReminderTemplate: EmailTemplateDefinition = {
  id: "renewal_reminder",
  name: "Renewal Reminder",
  description: "Template + hook point for upcoming renewal outreach.",
  status: "registry",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const renewDate = String(vars.renewalDate || "").trim() || "soon";
    const subject = `Renewal coming up — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `A gentle heads-up: ${venue}'s ${plan} subscription renews ${renewDate}.`,
      `Nothing you need to do if everything looks right. If you'd like to change plans or talk through the year ahead, reply anytime.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Renewal reminder", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Renewal Reminder Email Sent",
    };
  },
};

export const inquiryConfirmationTemplate: EmailTemplateDefinition = {
  id: "inquiry_confirmation",
  name: "Inquiry Confirmation",
  description:
    "Auto-reply after Contact Us or Request more information (unscheduled walkthrough) form submit. No credentials.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const subject = "Thanks for inquiring about Hello to Cheers!";
    const paragraphs = [
      `Hi ${name},`,
      `Thanks for inquiring about Hello to Cheers!`,
      `We received your note about ${venue} and someone from our team will follow up with you shortly.`,
      `In the meantime, no action is needed on your end. If something comes up, just reply to this email.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Thanks for reaching out", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Inquiry Confirmation Email Sent",
    };
  },
};

export const feedbackConfirmationTemplate: EmailTemplateDefinition = {
  id: "feedback_confirmation",
  name: "Feedback Confirmation",
  description:
    "Auto-ack after product Get Help / bug / idea / NPS or marketing support form. No credentials.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const kindLabel = String(vars.feedbackKindLabel || "").trim() || "message";
    const subject = `We received your ${kindLabel}`;
    const paragraphs = [
      `Hi ${name},`,
      `Thank you for sharing your ${kindLabel} with us${venue && venue !== "your venue" ? ` about ${venue}` : ""}.`,
      `We've received it and our team will follow up if we need more details or have an update.`,
      `No action is needed on your end right now. If anything else comes up, reply to this email anytime.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Thanks for your feedback", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Feedback Confirmation Email Sent",
    };
  },
};

export const luvSuggestionTemplate: EmailTemplateDefinition = {
  id: "luv_suggestion",
  name: "Luv Suggestion",
  description: "Ad-hoc Luv draft send from the Relationship Workspace.",
  status: "live",
  render(vars) {
    const subject =
      String(vars.subject || "").trim() || `A note from Hello to Cheers — ${venueName(vars)}`;
    const body =
      String(vars.body || vars.text || "").trim() ||
      `Hi ${firstName(vars)},\n\nWe're thinking of ${venueName(vars)} and wanted to reach out.`;
    const text = body;
    const htmlBody = paragraphsToHtml(body.split(/\n\n+/).filter(Boolean));
    return {
      subject,
      text,
      html: wrapHelloHtml(subject, htmlBody),
      preview: previewFromText(text),
      timelineTitle: `Email Sent — ${subject}`,
    };
  },
};

/**
 * Phase 3 automatic tier-upgrade notice.
 * Registry-only until Sandbox activation authorizes real sends.
 */
export const tierUpgradeNoticeTemplate: EmailTemplateDefinition = {
  id: "tier_upgrade_notice",
  name: "Tier Upgrade Notice",
  description:
    "Advance notice that a venue's subscription will move to a higher plan at an eligible renewal. No immediate charge.",
  status: "registry",
  render(vars) {
    const venue = venueName(vars);
    const currentPlan = String(vars.current_plan_name || vars.currentPlanName || "Gather");
    const newPlan = String(vars.new_plan_name || vars.newPlanName || "Celebrate");
    const effective = String(vars.effective_date || vars.effectiveDate || "your next eligible renewal");
    const currentAmount = String(vars.current_amount || vars.currentAmount || "");
    const newAmount = String(vars.new_amount || vars.newAmount || "");
    const discount = String(vars.discount_label || vars.discountLabel || "");
    const peakCount = String(vars.peak_count || vars.peakCount || "");
    const peakYear = String(vars.peak_year || vars.peakYear || "");
    const contact = String(vars.contact_email || vars.contactEmail || "jennifer@hellotocheers.com");
    const subject = "Your Hello to Cheers plan is growing with you";
    const paragraphs = [
      `Hi ${venue},`,
      `Your venue has reached the booking volume for our ${newPlan} plan${peakCount && peakYear ? ` (${peakCount} qualifying celebrations in ${peakYear})` : ""}.`,
      `Your subscription will move from ${currentPlan} to ${newPlan} at your next eligible renewal on ${effective}.`,
      currentAmount && newAmount
        ? `Current recurring subscription: ${currentAmount}/month. New recurring subscription: ${newAmount}/month.`
        : `Your recurring subscription amount will update on ${effective}.`,
      discount || "Any existing lifetime discount continues on the new plan.",
      "There is no immediate charge. Your current plan and billing amount stay the same until that renewal date.",
      `Questions? Reply to this email or contact ${contact}.`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml(subject, paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Tier Upgrade Notice Prepared",
    };
  },
};
