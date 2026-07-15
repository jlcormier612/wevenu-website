"use client";

import { cn } from "@/lib/utils";

type LeadFormProps = {
  intent: "walkthrough" | "contact";
  className?: string;
};

/**
 * Presentational placeholder form — wires to CRM/email later.
 * Labels are intentionally generic so copy can land without layout churn.
 */
export function LeadForm({ intent, className }: LeadFormProps) {
  const submitLabel =
    intent === "walkthrough" ? "Request a Walkthrough" : "Send Message";

  return (
    <form
      className={cn("space-y-5", className)}
      onSubmit={(e) => e.preventDefault()}
      aria-label={intent === "walkthrough" ? "Walkthrough request" : "Contact"}
    >
      <Field label="Name" name="name" autoComplete="name" />
      <Field label="Email" name="email" type="email" autoComplete="email" />
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
          className="w-full rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition focus:border-[var(--heritage-sage)]"
          placeholder="Placeholder — tell us a little about your venue"
        />
      </div>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-full bg-[var(--heritage-sage)] px-6 py-3 text-sm text-[var(--true-white)] transition-opacity hover:opacity-90 sm:w-auto"
      >
        {submitLabel}
      </button>
      <p className="text-xs text-[var(--forest-sage)]/50">
        Form wiring placeholder — submissions are not sent yet.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
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
        className="w-full rounded-full border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition focus:border-[var(--heritage-sage)]"
        placeholder="Placeholder"
      />
    </div>
  );
}
