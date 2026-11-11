"use client";

import { useRef, useState, type FormEvent } from "react";

import { isGa4Initialized, trackGenerateLead } from "@shared/analytics";

import { INQUIRY_HONEYPOT_FIELD } from "@/lib/inquiries/spam";
import { HOVER_FILL } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type LeadFormProps = {
  intent: "walkthrough" | "contact" | "support";
  /** Override default submit button copy (fields + ingest path stay the same). */
  submitLabel?: string;
  /**
   * Walkthrough page `intent=more-info` — extra question field + Submit default.
   * Does not change inquiry kind (still walks through ingestWalkthroughRequest).
   */
  moreInfo?: boolean;
  /** Optional Message field placeholder (Contact uses approved copy). */
  messagePlaceholder?: string;
  /**
   * Submit button fill. Contact uses botanical to match approved CTAs;
   * Support keeps the established heritage-sage treatment by default.
   */
  buttonAccent?: "botanical" | "heritage";
  className?: string;
};

/**
 * Contact / Walkthrough / Support inquiry form — uses the shared marketing inquiry architecture.
 */
export function LeadForm({
  intent,
  submitLabel: submitLabelProp,
  moreInfo = false,
  messagePlaceholder = "Tell us a little about your venue",
  buttonAccent = "heritage",
  className,
}: LeadFormProps) {
  const submitLabel =
    submitLabelProp ??
    (moreInfo
      ? "Submit"
      : intent === "walkthrough"
        ? "Schedule a Walkthrough"
        : intent === "support"
          ? "Send Support Request"
          : "Send Message");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  /** Stable for one submit attempt so network retries do not create duplicates. */
  const idempotencyKeyRef = useRef<string | null>(null);
  const submitFill =
    buttonAccent === "botanical"
      ? "bg-[var(--botanical)] hover:bg-[color-mix(in_srgb,var(--botanical)_88%,black)]"
      : `bg-[var(--heritage-sage)] ${HOVER_FILL}`;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);

    const form = new FormData(e.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const venue = String(form.get("venue") ?? "").trim();

    if (!firstName || !lastName || !email || !venue) {
      setStatus("error");
      setError("Please complete all required fields.");
      return;
    }

    const fields: Record<string, string> = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      venue,
      message: String(form.get("message") ?? ""),
      // Include honeypot so the server can reject bot fills (empty for humans).
      [INQUIRY_HONEYPOT_FIELD]: String(form.get(INQUIRY_HONEYPOT_FIELD) ?? ""),
    };
    if (moreInfo) {
      fields.question = String(form.get("question") ?? "");
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: intent,
          fields,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to send your message.");
      }
      // Marketing CRM inquiry only — never venue lead surface.
      if (isGa4Initialized()) {
        trackGenerateLead({
          funnel_surface: "htc_marketing",
          form_mode: intent,
          has_utm: typeof window !== "undefined" && /utm_/i.test(window.location.search),
        });
      }
      idempotencyKeyRef.current = null;
      setStatus("done");
    } catch (err) {
      // Keep the same idempotency key so a visitor retry of this attempt is safe.
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to send your message.");
    }
  }

  if (status === "done") {
    return (
      <p className={cn("text-base leading-[1.7] text-[var(--forest-sage)]/75", className)}>
        Thank you — we&apos;ve received your message and will be in touch shortly.
      </p>
    );
  }

  const ariaLabel =
    intent === "walkthrough"
      ? "Walkthrough request"
      : intent === "support"
        ? "Support request"
        : "Contact";

  return (
    <form
      className={cn("space-y-5", className)}
      onSubmit={onSubmit}
      aria-label={ariaLabel}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="First name"
          name="firstName"
          autoComplete="given-name"
          idPrefix={intent}
          required
        />
        <Field
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          idPrefix={intent}
          required
        />
      </div>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        idPrefix={intent}
        required
      />
      <Field
        label="Venue name"
        name="venue"
        autoComplete="organization"
        idPrefix={intent}
        required
      />
      <div>
        <label
          htmlFor={`${intent}-message`}
          className="mb-2 block text-sm text-[var(--forest-sage)]"
        >
          Message
        </label>
        <textarea
          id={`${intent}-message`}
          name="message"
          rows={4}
          className="w-full rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)] focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
          placeholder={messagePlaceholder}
        />
      </div>
      {moreInfo ? (
        <div>
          <label
            htmlFor={`${intent}-question`}
            className="mb-2 block text-sm text-[var(--forest-sage)]"
          >
            Question/information you&apos;re requesting
          </label>
          <textarea
            id={`${intent}-question`}
            name="question"
            rows={4}
            className="w-full rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)] focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
            placeholder="Please tell me more about ..."
          />
        </div>
      ) : null}
      {/* Invisible honeypot — leave empty. tabIndex -1 keeps keyboard users out. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${intent}-${INQUIRY_HONEYPOT_FIELD}`}>Website</label>
        <input
          id={`${intent}-${INQUIRY_HONEYPOT_FIELD}`}
          type="text"
          name={INQUIRY_HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      {error ? (
        <p className="text-sm text-[var(--forest-sage)]/60" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className={cn(
          "inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-[var(--true-white)] transition duration-200 ease-out disabled:opacity-60 sm:w-auto",
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2",
          submitFill,
        )}
      >
        {status === "submitting" ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  idPrefix,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  idPrefix?: string;
}) {
  const id = idPrefix ? `${idPrefix}-${name}` : `field-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-[var(--forest-sage)]">
        {label}
        {required ? (
          <span className="text-[var(--dusty-rose)]" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-required={required || undefined}
        className="w-full rounded-full border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)] focus-visible:ring-2 focus-visible:ring-[var(--botanical)] focus-visible:ring-offset-2"
      />
    </div>
  );
}
