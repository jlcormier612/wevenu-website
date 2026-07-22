import type { EmailTemplateDefinition } from "../types";
import {
  firstName,
  marketingUrl,
  paragraphsToHtml,
  planName,
  previewFromText,
  venueName,
  wrapHelloHtml,
} from "./helpers";

export const welcomeTemplate: EmailTemplateDefinition = {
  id: "welcome",
  name: "Welcome",
  description: "Standard welcome for a new Hello to Cheers subscriber.",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const subject = `Welcome to Hello to Cheers — ${venue}`;
    const paragraphs = [
      `Hi ${name},`,
      `Welcome to Hello to Cheers. We're glad ${venue} is here.`,
      `Your ${plan} subscription is active. You can take your time with setup — we'll keep the path clear and the noise low.`,
      `If you need anything, just reply to this email. We're listening.`,
      `Start here: ${marketingUrl("/product")}`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Welcome", paragraphsToHtml(paragraphs)),
      preview: previewFromText(text),
      timelineTitle: "Welcome Email Sent",
    };
  },
};

export const founderWelcomeTemplate: EmailTemplateDefinition = {
  id: "founder_welcome",
  name: "Founder Welcome",
  description: "Welcome for Founding Members (automatic while Founder Program is active).",
  status: "live",
  render(vars) {
    const name = firstName(vars);
    const venue = venueName(vars);
    const plan = planName(vars);
    const subject = `You're a Founding Member — welcome, ${name}`;
    const paragraphs = [
      `Hi ${name},`,
      `Thank you for joining Hello to Cheers as a Founding Member for ${venue}.`,
      `Your ${plan} Founding subscription is confirmed. Founding Members help shape what we build next — and you'll always have a direct line to us.`,
      `We'll keep you close as we grow. Reply anytime; Jen reads these.`,
      `Explore the product: ${marketingUrl("/product")}`,
    ];
    const text = paragraphs.join("\n\n");
    return {
      subject,
      text,
      html: wrapHelloHtml("Founding Member Welcome", paragraphsToHtml(paragraphs)),
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
