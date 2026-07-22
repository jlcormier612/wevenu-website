"use client";

import { useState, type FormEvent } from "react";

import { HOVER_FILL } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type LeadFormProps = {
  intent: "walkthrough" | "contact" | "support";
  className?: string;
};

/**
 * Contact / Walkthrough / Support inquiry form — uses the shared marketing inquiry architecture.
 */
export function LeadForm({ intent, className }: LeadFormProps) {
  const submitLabel =
    intent === "walkthrough"
      ? "Schedule a Walkthrough"
      : intent === "support"
        ? "Send Support Request"
        : "Send Message";
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const form = new FormData(e.currentTarget);
    const fields = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      venue: String(form.get("venue") ?? ""),
      message: String(form.get("message") ?? ""),
    };

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
      <Field label="Name" name="name" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Venue name" name="venue" autoComplete="organization" />
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
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const id = `field-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-[var(--forest-sage)]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-full border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)]"
      />
    </div>
  );
}
