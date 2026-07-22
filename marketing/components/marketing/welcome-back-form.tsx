"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { HOVER_FILL, HOVER_LINK } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type WelcomeBackFormProps = {
  className?: string;
};

/**
 * Optional Welcome Back introduction — stores a note for the team.
 * Does not gate checkout, approve eligibility, or issue Payment Links.
 */
export function WelcomeBackForm({ className }: WelcomeBackFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const form = new FormData(e.currentTarget);
    const fields = {
      businessName: String(form.get("businessName") ?? ""),
      venueName: String(form.get("venueName") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      businessEmail: String(form.get("businessEmail") ?? ""),
      phone: String(form.get("phone") ?? ""),
      yearsWithWeven: String(form.get("yearsWithWeven") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "welcome_back_request", fields }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to submit your request.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to submit your request.");
    }
  }

  if (status === "done") {
    return (
      <div className={cn("max-w-[65ch] space-y-6", className)}>
        <h2 className="font-heading text-[2.52rem] text-[var(--forest-sage)] md:text-[3.36rem]">
          Thank you.
        </h2>
        <p className="text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
          We received your note and will be in touch soon. You don&apos;t need to wait —
          you can{" "}
          <Link href="/pricing#plans" className={HOVER_LINK}>
            choose a plan
          </Link>{" "}
          anytime and note Welcome Back at checkout.
        </p>
        <p className="text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
          Some relationships deserve a second chapter.
        </p>
        <p className="font-heading text-xl leading-snug text-[var(--forest-sage)] md:text-2xl">
          We&apos;re looking forward to welcoming you home.
        </p>
      </div>
    );
  }

  return (
    <form
      className={cn("space-y-5", className)}
      onSubmit={onSubmit}
      aria-label="Welcome Back introduction"
    >
      <Field label="Business Name" name="businessName" autoComplete="organization" required />
      <Field label="Venue Name" name="venueName" required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First Name" name="firstName" autoComplete="given-name" required />
        <Field label="Last Name" name="lastName" autoComplete="family-name" required />
      </div>
      <Field
        label="Business Email"
        name="businessEmail"
        type="email"
        autoComplete="email"
        required
      />
      <Field label="Phone Number" name="phone" type="tel" autoComplete="tel" required />
      <Field
        label="Approximate years you used Weven (optional)"
        name="yearsWithWeven"
      />
      <div>
        <label
          htmlFor="welcome-back-notes"
          className="mb-2 block text-sm text-[var(--forest-sage)]"
        >
          Anything you&apos;d like us to know (optional)
        </label>
        <textarea
          id="welcome-back-notes"
          name="notes"
          rows={4}
          className="w-full rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-3 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)]"
        />
      </div>
      {error ? (
        <p className="text-sm text-[var(--forest-sage)]/60">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className={`inline-flex w-full items-center justify-center rounded-full bg-[var(--heritage-sage)] px-6 py-3 text-sm text-[var(--true-white)] transition duration-200 ease-out disabled:opacity-60 ${HOVER_FILL} sm:w-auto`}
      >
        {status === "submitting" ? "Submitting…" : "Send a note"}
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
  const id = `welcome-back-${name}`;
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
