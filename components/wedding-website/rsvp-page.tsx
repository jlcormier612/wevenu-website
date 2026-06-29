"use client";

/**
 * RsvpPage — the personalized RSVP submission experience.
 *
 * This is what every guest sees when they click their invitation link.
 * It must feel warm, celebratory, and personal — not like a form.
 *
 * "Hi Sarah! Emily & James would love for you to join them."
 */

import * as React from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { RsvpContext } from "@/app/rsvp/[token]/page";

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}

export function RsvpPage({ context, rsvpToken }: { context: RsvpContext; rsvpToken: string }) {
  const { guest, couple, event, venue, websiteSlug, accentColor } = context;
  const color = accentColor ?? "#5D6F5D";
  const coupleName = [couple.firstName, couple.partnerFirstName].filter(Boolean).join(" & ");
  const guestFirstName = guest.firstName;

  const [status, setStatus] = React.useState<"form" | "submitting" | "confirmed">(
    guest.rsvpStatus === "attending" || guest.rsvpStatus === "declined" ? "confirmed" : "form"
  );
  const [attending, setAttending] = React.useState<"attending" | "declined" | "maybe">(
    guest.rsvpStatus as "attending" | "declined" | "maybe" ?? "attending"
  );
  const [dietary, setDietary] = React.useState(guest.dietary ?? "");
  const [plusOneName, setPlusOneName] = React.useState(guest.plusOneName ?? "");
  const [note, setNote] = React.useState(guest.rsvpNote ?? "");

  async function handleSubmit() {
    setStatus("submitting");
    try {
      const res = await fetch("/api/portal/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rsvpToken,
          status: attending,
          plusOneName: guest.plusOne && plusOneName ? plusOneName : undefined,
          dietary: dietary || undefined,
          note: note || undefined,
        }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) setStatus("confirmed");
      else { toast.error("Something went wrong. Please try again."); setStatus("form"); }
    } catch { toast.error("Could not submit. Please try again."); setStatus("form"); }
  }

  const du = event ? daysUntil(event.eventDate) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F7F5F1" }}>
      {/* Header */}
      <div className="pt-12 pb-8 px-6 text-center" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`, color: "white" }}>
        <p className="text-sm opacity-70 mb-1">{venue.name}</p>
        <h1 className="font-heading text-3xl font-semibold">{coupleName}</h1>
        {event && (
          <div className="mt-3 space-y-0.5">
            <p className="text-base opacity-90">{formatDate(event.eventDate)}</p>
            {du !== null && du > 0 && (
              <p className="text-sm opacity-60">{du} days away</p>
            )}
          </div>
        )}
      </div>

      {/* RSVP Card */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {status === "confirmed" ? (
            <div className="rounded-2xl border border-border bg-white p-8 text-center space-y-4 shadow-sm">
              <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ background: `${color}15` }}>
                {attending === "attending" ? (
                  <span className="text-3xl">💗</span>
                ) : (
                  <Check className="h-8 w-8" style={{ color }} />
                )}
              </div>
              {attending === "attending" ? (
                <>
                  <h2 className="font-heading text-2xl font-semibold text-[#1A1A1A]">
                    We'll see you there, {guestFirstName}!
                  </h2>
                  <p className="text-sm text-[#666]">
                    Thank you for your RSVP. We can't wait to celebrate with you.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-2xl font-semibold text-[#1A1A1A]">
                    We'll miss you, {guestFirstName}.
                  </h2>
                  <p className="text-sm text-[#666]">
                    Thank you for letting us know. We appreciate you thinking of us.
                  </p>
                </>
              )}
              {websiteSlug && (
                <Link href={`/w/${websiteSlug}`}
                  className="block mt-4 text-sm font-medium underline-offset-2 hover:underline"
                  style={{ color }}>
                  Visit {coupleName}'s wedding website →
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-5">
              <div>
                <h2 className="font-heading text-xl font-semibold text-[#1A1A1A]">
                  Hi {guestFirstName}! 👋
                </h2>
                <p className="text-sm text-[#666] mt-1">
                  {coupleName} would love for you to join them on{" "}
                  {event ? formatDate(event.eventDate) : "their special day"}.
                </p>
              </div>

              {/* RSVP choice */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#999] uppercase tracking-wide">Will you be attending?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "attending", label: "Joyfully accepts" },
                    { value: "declined", label: "Regretfully declines" },
                    { value: "maybe", label: "Maybe" },
                  ].map(({ value, label }) => (
                    <button key={value} type="button"
                      onClick={() => setAttending(value as typeof attending)}
                      className="rounded-xl border py-3 text-xs font-medium leading-tight transition-colors"
                      style={attending === value
                        ? { background: color, borderColor: color, color: "white" }
                        : { borderColor: "#DED6CA", color: "#444" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary */}
              {attending === "attending" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[#666]">Dietary restrictions <span className="font-normal text-[#999]">(optional)</span></p>
                    <input value={dietary} onChange={e => setDietary(e.target.value)}
                      placeholder="e.g., vegetarian, nut allergy, gluten-free"
                      className="w-full rounded-xl border border-[#DED6CA] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/20" />
                  </div>

                  {/* Plus one */}
                  {guest.plusOne && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[#666]">Your guest's name <span className="font-normal text-[#999]">(optional)</span></p>
                      <input value={plusOneName} onChange={e => setPlusOneName(e.target.value)}
                        placeholder="Guest's full name"
                        className="w-full rounded-xl border border-[#DED6CA] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/20" />
                    </div>
                  )}
                </div>
              )}

              {/* Note */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#666]">Leave a note for the couple <span className="font-normal text-[#999]">(optional)</span></p>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="We can't wait to celebrate with you!"
                  className="w-full rounded-xl border border-[#DED6CA] px-4 py-2.5 text-sm focus:outline-none resize-none focus:ring-2 focus:ring-[#5D6F5D]/20" />
              </div>

              <button type="button" onClick={handleSubmit}
                disabled={status === "submitting"}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: color }}>
                {status === "submitting"
                  ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  : attending === "attending" ? "💗 I'll be there!" : "Submit RSVP"}
              </button>

              {websiteSlug && (
                <p className="text-center text-xs text-[#999]">
                  View the <Link href={`/w/${websiteSlug}`} className="underline">wedding website</Link> for event details and schedule.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="text-center py-4 text-[10px] text-[#B8AEA1]">
        Powered by Wevenu · {venue.name}
      </footer>
    </div>
  );
}
