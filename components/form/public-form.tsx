"use client";

/**
 * Purpose-specific Public Form — venue-branded lead capture.
 * Reuses inquiry surface styling / Turnstile / custom question rendering.
 * Wave 1: does NOT collect SMS consent (phone ≠ consent).
 */

import * as React from "react";

import { HtcPlatformMark } from "@/components/brand/htc-platform-mark";
import { RequestInformationConfirmation } from "@/components/form/inquiry-confirmations";
import { TurnstileWidget } from "@/components/shared/turnstile-widget";
import { EVENT_TYPES } from "@/lib/event-types/canonical";
import type { InquiryFormQuestion } from "@/lib/inquiry-form/types";
import { PUBLIC_FORM_API_ERRORS } from "@/lib/public-forms/constants";
import { publicFormUnavailableCopy } from "@/lib/public-forms/lifecycle";
import type { PublicFormPublicConfig, PublicFormUnavailableState } from "@/lib/public-forms/types";
import { validatePublicFormSubmission } from "@/lib/public-forms/validation";
import { inkOn, publicFormSurfaceStyle } from "@/lib/theme/public-form-surface";

function CustomQuestionField({
  q,
  value,
  onChange,
  error,
}: {
  q: InquiryFormQuestion;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  error?: string;
}) {
  const label = q.required ? `${q.questionText} *` : q.questionText;
  if (q.questionType === "long_answer") {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">{label}</label>
        <textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  if (q.questionType === "single_select") {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">{label}</label>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">Select…</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  if (q.questionType === "multiple_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <p className="block text-sm font-medium text-foreground">{label}</p>
        <div className="space-y-2">
          {q.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => {
                  onChange(e.target.checked ? [...selected, o] : selected.filter((x) => x !== o));
                }}
              />
              {o}
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type FormState = "idle" | "submitting" | "success" | "error";

export function PublicFormUnavailable({ state }: { state: PublicFormUnavailableState }) {
  const copy = publicFormUnavailableCopy(state.status === "unknown" ? null : state.status);
  const venue = state.venue;
  const brand = {
    primary: venue?.primaryColor || "#5D6F5D",
    secondary: venue?.secondaryColor || "#4F5F4F",
    accent: venue?.accentColor || "#B8AEA1",
    neutral: venue?.neutralColor || "#F7F5F1",
  };
  return (
    <div data-theme-lock="light" className="min-h-screen flex items-center justify-center px-4" style={publicFormSurfaceStyle(brand)}>
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center">
        {venue?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.logoUrl} alt={venue.name} className="mx-auto h-12 w-12 rounded-full object-cover" />
        ) : null}
        {venue?.name ? (
          <p className="text-sm font-semibold" style={{ color: brand.secondary }}>{venue.name}</p>
        ) : null}
        <h1 className="font-heading text-xl font-medium text-heading">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <p className="sr-only">{state.publicTitle}</p>
      </div>
    </div>
  );
}

export function PublicFormView({
  publicKey,
  config,
}: {
  publicKey: string;
  config: PublicFormPublicConfig;
}) {
  const { form, venue, customQuestions } = config;
  const fields = form.fieldConfig;
  const primary = venue.primaryColor || "#5D6F5D";
  const secondary = venue.secondaryColor || "#4F5F4F";
  const accent = venue.accentColor || "#B8AEA1";
  const neutral = venue.neutralColor || "#F7F5F1";
  const brand = { primary, secondary, accent, neutral };
  const surface = publicFormSurfaceStyle(brand);

  const [state, setState] = React.useState<FormState>("idle");
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [eventDate, setEventDate] = React.useState("");
  const [guestCount, setGuestCount] = React.useState("");
  const [customAnswers, setCustomAnswers] = React.useState<Record<string, string | string[]>>({});

  function fieldLabel(base: string, visibility: "required" | "optional" | "hidden") {
    if (visibility === "required") return `${base} *`;
    return base;
  }

  function buildSourceData() {
    const urlParams = new URLSearchParams(window.location.search);
    const customAnswerEntries = customQuestions
      .map((q) => {
        const answer = customAnswers[q.id];
        if (
          answer == null ||
          (typeof answer === "string" && !answer.trim()) ||
          (Array.isArray(answer) && answer.length === 0)
        ) {
          return null;
        }
        return { questionId: q.id, questionText: q.questionText, answer };
      })
      .filter(Boolean);

    return {
      source: "public_form",
      form_key: publicKey,
      public_form_id: form.id,
      public_form_internal_name: form.internalName,
      public_form_public_title: form.publicTitle,
      custom_answers: customAnswerEntries,
      utm_source: urlParams.get("utm_source") ?? undefined,
      utm_medium: urlParams.get("utm_medium") ?? undefined,
      utm_campaign: urlParams.get("utm_campaign") ?? undefined,
      utm_content: urlParams.get("utm_content") ?? undefined,
      utm_term: urlParams.get("utm_term") ?? undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.href,
      qr_campaign_id: urlParams.get("qr") ?? undefined,
    };
  }

  function validate(): boolean {
    const errors = validatePublicFormSubmission(fields, customQuestions, {
      firstName,
      lastName,
      email,
      phone,
      eventType,
      eventDate,
      guestCount,
      customAnswers,
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    if (!validate()) return;

    setState("submitting");
    setError("");

    try {
      const sourceData = buildSourceData();
      const res = await fetch("/api/public/forms/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicKey,
          firstName,
          lastName,
          email,
          phone,
          eventType: fields.event_type === "hidden" ? "other" : eventType,
          eventDate: eventDate || null,
          guestCount: guestCount ? parseInt(guestCount, 10) : null,
          sourceData,
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setState("success");
      } else {
        setError(PUBLIC_FORM_API_ERRORS[data.error] ?? data.message ?? "Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="min-h-screen" style={surface}>
        <RequestInformationConfirmation firstName={firstName} venueName={venue.name} brand={brand} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={surface}>
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div className="mb-8 text-center">
          {venue.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={venue.logoUrl} alt={venue.name} className="mx-auto mb-4 h-14 w-auto object-contain" />
          ) : (
            <p className="mb-2 font-heading text-xl font-semibold" style={{ color: primary }}>
              {venue.name}
            </p>
          )}
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">{form.publicTitle}</h1>
          {form.description.trim() ? (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{form.description}</p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">First name *</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                autoComplete="given-name"
              />
              {fieldErrors.firstName && <p className="text-xs text-red-600">{fieldErrors.firstName}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Last name *</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                autoComplete="family-name"
              />
              {fieldErrors.lastName && <p className="text-xs text-red-600">{fieldErrors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              autoComplete="email"
            />
            {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
          </div>

          {fields.phone !== "hidden" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {fieldLabel("Phone", fields.phone)}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                autoComplete="tel"
              />
              {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone}</p>}
            </div>
          )}

          {fields.event_type !== "hidden" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {fieldLabel("Event type", fields.event_type)}
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {fieldErrors.eventType && <p className="text-xs text-red-600">{fieldErrors.eventType}</p>}
            </div>
          )}

          {fields.preferred_event_date !== "hidden" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {fieldLabel("Preferred event date", fields.preferred_event_date)}
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              {fieldErrors.eventDate && <p className="text-xs text-red-600">{fieldErrors.eventDate}</p>}
            </div>
          )}

          {fields.guest_count !== "hidden" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {fieldLabel("Guest count", fields.guest_count)}
              </label>
              <input
                type="number"
                min={1}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              {fieldErrors.guestCount && <p className="text-xs text-red-600">{fieldErrors.guestCount}</p>}
            </div>
          )}

          {customQuestions.map((q) => (
            <CustomQuestionField
              key={q.id}
              q={q}
              value={customAnswers[q.id] ?? (q.questionType === "multiple_select" ? [] : "")}
              onChange={(v) => setCustomAnswers((prev) => ({ ...prev, [q.id]: v }))}
              error={fieldErrors[q.id]}
            />
          ))}

          {/* Honeypot */}
          <div className="absolute -left-[9999px] opacity-0" aria-hidden>
            <label>
              Company
              <input value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <TurnstileWidget onToken={setTurnstileToken} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ background: primary, color: inkOn(primary) }}
          >
            {state === "submitting" ? "Submitting…" : "Submit"}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <HtcPlatformMark className="opacity-70" />
          <p className="text-[11px] text-muted-foreground">
            Powered by Hello to Cheers
            {venue.email ? (
              <>
                {" · "}
                <a href={`mailto:${venue.email}`} className="underline-offset-2 hover:underline">
                  Contact venue
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
