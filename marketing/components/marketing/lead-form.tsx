"use client";

import { useState, type FormEvent } from "react";

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
  className?: string;
};

/**
 * Contact / Walkthrough / Support inquiry form — uses the shared marketing inquiry architecture.
 */
export function LeadForm({
  intent,
  submitLabel: submitLabelProp,
  moreInfo = false,
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    };
    if (moreInfo) {
      fields.question = String(form.get("question") ?? "");
    }

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: intent, fields }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to send your message.");
      }
      setStatus("done");
    } catch (err) {
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
          className="w-full rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)]"
          placeholder="Tell us a little about your venue"
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
            className="w-full rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)]"
            placeholder="Please tell me more about ..."
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-[var(--forest-sage)]/60">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className={`inline-flex w-full items-center justify-center rounded-full bg-[var(--heritage-sage)] px-6 py-3 text-sm text-[var(--true-white)] transition duration-200 ease-out disabled:opacity-60 ${HOVER_FILL} sm:w-auto`}
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
        className="w-full rounded-full border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)]"
      />
    </div>
  );
}
