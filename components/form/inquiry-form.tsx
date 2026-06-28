"use client";

/**
 * InquiryForm — the public-facing venue inquiry form.
 *
 * Renders venue-branded (primary color, logo, name).
 * Submits to /api/public/inquire and shows a confirmation on success.
 * Includes a honeypot field to reject bots.
 */

import * as React from "react";

import { Loader2 } from "lucide-react";

const EVENT_TYPES = [
  { value: "wedding",             label: "Wedding" },
  { value: "corporate_event",     label: "Corporate Event" },
  { value: "birthday",            label: "Birthday / Milestone" },
  { value: "anniversary",         label: "Anniversary" },
  { value: "baby_shower",         label: "Baby Shower / Bridal Shower" },
  { value: "holiday_party",       label: "Holiday Party" },
  { value: "fundraiser",          label: "Fundraiser / Gala" },
  { value: "other",               label: "Other" },
];

type VenueBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  email: string | null;
};

type FormState = "idle" | "submitting" | "success" | "error";

export function InquiryForm({
  embedKey,
  venue,
  tourKey = null,
}: {
  embedKey: string;
  venue: VenueBranding;
  tourKey?: string | null;
}) {
  const [state, setState] = React.useState<FormState>("idle");
  const [refCode, setRefCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");

  // Form fields
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [partnerFirst, setPartnerFirst] = React.useState("");
  const [partnerLast, setPartnerLast] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [eventDate, setEventDate] = React.useState("");
  const [guestCount, setGuestCount] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [message, setMessage] = React.useState("");

  const primary = venue.primaryColor || "#5D6F5D";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return; // Bot detected — silently ignore
    if (!firstName || !lastName || !email) return;

    setState("submitting");

    // Collect UTM params + referrer from the browser
    const urlParams = new URLSearchParams(window.location.search);
    const sourceData = {
      source: "website_form",
      form_key: embedKey,
      utm_source: urlParams.get("utm_source") ?? undefined,
      utm_medium: urlParams.get("utm_medium") ?? undefined,
      utm_campaign: urlParams.get("utm_campaign") ?? undefined,
      utm_content: urlParams.get("utm_content") ?? undefined,
      utm_term: urlParams.get("utm_term") ?? undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.href,
    };

    try {
      const res = await fetch("/api/public/inquire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          embedKey,
          firstName, lastName, email, phone,
          partnerFirst, partnerLast,
          eventType, eventDate,
          guestCount: guestCount ? parseInt(guestCount, 10) : null,
          estimatedBudget: budget ? parseFloat(budget.replace(/[$,]/g, "")) : null,
          message,
          sourceData,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRefCode(data.referenceCode);
        setState("success");
      } else {
        setError(data.message ?? "Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primary}10` }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <div className="text-4xl">💗</div>
          <h2 className="text-xl font-semibold text-gray-900">Thank you!</h2>
          <p className="text-gray-600">
            We received your inquiry and will be in touch soon.
          </p>
          {refCode && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Your reference number</p>
              <p className="text-lg font-mono font-bold text-gray-900 mt-0.5">{refCode}</p>
            </div>
          )}
          <p className="text-sm text-gray-500">
            We look forward to speaking with you about your event.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: `${primary}08` }}>
      {/* Venue header */}
      <div className="py-8 px-4 text-center" style={{ backgroundColor: primary }}>
        {venue.logoUrl && (
          <img src={venue.logoUrl} alt={venue.name}
            className="h-12 w-12 object-contain rounded-lg mx-auto mb-3"
            style={{ background: "rgba(255,255,255,0.15)" }} />
        )}
        <h1 className="text-white text-xl font-semibold">{venue.name}</h1>
        <p className="text-white/70 text-sm mt-1">Inquiry Form</p>
      </div>

      {/* Two-path choice — shown when tour scheduling is enabled */}
      {tourKey && (
        <div className="max-w-xl mx-auto px-4 pt-6">
          <div className="grid grid-cols-2 gap-3">
            <a href={`/book/${tourKey}`}
              className="block rounded-2xl border-2 p-4 text-center space-y-1.5 transition-colors hover:border-current"
              style={{ borderColor: primary, background: `${primary}08` }}>
              <p className="text-2xl">📅</p>
              <p className="text-sm font-semibold" style={{ color: primary }}>Schedule a Tour</p>
              <p className="text-xs text-gray-500">Pick a date and time to visit us.</p>
            </a>
            <div className="rounded-2xl border-2 p-4 text-center space-y-1.5" style={{ borderColor: "#DED6CA", background: "#F5F4F2" }}>
              <p className="text-2xl">✉️</p>
              <p className="text-sm font-semibold text-gray-700">Request Information</p>
              <p className="text-xs text-gray-500">Tell us about your event below.</p>
            </div>
          </div>
          <div className="mt-4 h-px bg-gray-100" />
        </div>
      )}

      {/* Form card */}
      <div className="max-w-xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">

          {/* Honeypot — hidden from humans, catches bots */}
          <input type="text" name="website_url" value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">First name *</label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": primary } as React.CSSProperties} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Last name *</label>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": primary } as React.CSSProperties} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Email *</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Partner / Co-host (optional)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <input placeholder="Partner first name" value={partnerFirst} onChange={(e) => setPartnerFirst(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
              <input placeholder="Partner last name" value={partnerLast} onChange={(e) => setPartnerLast(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Event type</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white">
                <option value="">Select event type</option>
                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Event date</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Guest count</label>
              <input type="number" placeholder="150" min="1" value={guestCount} onChange={(e) => setGuestCount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Estimated budget</label>
              <input placeholder="$15,000" value={budget} onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Tell us about your event</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Share any details about your vision, special requests, or questions…"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none" />
          </div>

          {state === "error" && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <button type="submit" disabled={state === "submitting"}
            className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primary }}>
            {state === "submitting"
              ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
              : "Send Inquiry"}
          </button>

          <p className="text-center text-xs text-gray-400">
            Your information is used only to respond to your inquiry.
          </p>
        </form>
      </div>
    </div>
  );
}
