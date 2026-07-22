"use client";

import { useState, type FormEvent } from "react";

import { HOVER_FILL } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

/**
 * Footer newsletter signup → shared Relationship store via /api/inquiries.
 */
export function NewsletterSignup({ className }: { className?: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "newsletter", fields: { email } }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to subscribe.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to subscribe.");
    }
  }

  if (status === "done") {
    return (
      <p className={cn("text-sm leading-[1.7] text-[var(--forest-sage)]/75", className)}>
        You&apos;re on the list — thank you.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("space-y-3", className)}
      aria-label="Newsletter signup"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email
      </label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Email address"
        className="w-full rounded-2xl border border-[var(--taupe-light)] bg-[var(--true-white)] px-4 py-2.5 text-sm text-[var(--forest-sage)] outline-none transition duration-200 ease-out focus:border-[var(--heritage-sage)]"
      />
      {error ? <p className="text-xs text-[var(--forest-sage)]/60">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className={`inline-flex w-full items-center justify-center rounded-full bg-[var(--heritage-sage)] px-4 py-2.5 text-sm text-[var(--true-white)] transition duration-200 ease-out disabled:opacity-60 ${HOVER_FILL}`}
      >
        {status === "submitting" ? "Joining…" : "Stay in touch"}
      </button>
    </form>
  );
}
