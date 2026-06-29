"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { PublicWebsite } from "@/lib/wedding-website/types";

function formatEventDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}

// ── Password Gate ─────────────────────────────────────────────────────────────

function PasswordGate({ slug, accentColor }: { slug: string; accentColor: string }) {
  const router = useRouter();
  const [pw, setPw] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true); setError(false);
    router.push(`/w/${slug}?p=${encodeURIComponent(pw)}`);
    setChecking(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F5F1" }}>
      <div className="text-center space-y-6 px-6 max-w-sm w-full">
        <p className="text-3xl">🔒</p>
        <div>
          <p className="font-heading text-xl font-medium text-[#5D6F5D]">Private wedding website</p>
          <p className="text-sm text-[#B8AEA1] mt-1">Enter the password to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="Password" autoFocus
            className="w-full rounded-xl border border-[#DED6CA] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
          {error && <p className="text-xs text-red-500">Incorrect password. Please try again.</p>}
          <button type="submit" disabled={!pw.trim() || checking}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ background: accentColor }}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── RSVP Form ─────────────────────────────────────────────────────────────────

function RsvpSection({ accentColor }: { accentColor: string }) {
  const [token, setToken] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "found" | "submitted">("idle");
  const [guestName, setGuestName] = React.useState("");
  const [rsvpStatus, setRsvpStatus] = React.useState("attending");
  const [dietary, setDietary] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    // In production: look up by rsvp_token. For Sprint 52, direct token entry.
    if (token.trim().length > 10) setStatus("found");
    else toast.error("Please enter your full RSVP code from your invitation.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rsvpToken: token, status: rsvpStatus, dietary }),
      });
      const data = await res.json() as { ok: boolean; guestName?: string };
      if (data.ok) { setGuestName(data.guestName ?? ""); setStatus("submitted"); }
      else toast.error("Could not submit RSVP. Please try again.");
    } catch { toast.error("Something went wrong."); }
    finally { setSubmitting(false); }
  }

  if (status === "submitted") {
    return (
      <div className="rounded-2xl border border-white/30 bg-white/20 p-8 text-center space-y-3">
        <p className="text-3xl">💗</p>
        <p className="text-xl font-semibold">Thank you{guestName ? `, ${guestName}` : ""}!</p>
        <p className="text-sm opacity-75">We've received your RSVP and can't wait to celebrate with you.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/90 p-6 space-y-5 text-[#333]">
      {status === "idle" ? (
        <form onSubmit={handleLookup} className="space-y-3">
          <p className="text-sm font-medium">Enter the RSVP code from your invitation</p>
          <input value={token} onChange={e => setToken(e.target.value)} placeholder="Your RSVP code"
            className="w-full rounded-xl border border-[#DED6CA] px-4 py-3 text-sm focus:outline-none focus:ring-2" />
          <button type="submit" disabled={!token.trim()}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: accentColor }}>
            Find My Invitation →
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm font-medium">Will you be attending?</p>
          <div className="grid grid-cols-3 gap-2">
            {[["attending", "Joyfully accepts"], ["declined", "Regretfully declines"], ["maybe", "Maybe"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setRsvpStatus(v)}
                className="rounded-xl border py-3 text-sm font-medium transition-colors"
                style={rsvpStatus === v ? { background: accentColor, borderColor: accentColor, color: "white" } : { borderColor: "#DED6CA" }}>
                {l}
              </button>
            ))}
          </div>
          {rsvpStatus === "attending" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#666]">Dietary restrictions <span className="font-normal text-[#B8AEA1]">(optional)</span></p>
              <input value={dietary} onChange={e => setDietary(e.target.value)} placeholder="e.g., vegetarian, nut allergy"
                className="w-full rounded-xl border border-[#DED6CA] px-4 py-2.5 text-sm focus:outline-none" />
            </div>
          )}
          <button type="submit" disabled={submitting}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: accentColor }}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Submit RSVP →"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function SectionHeader({ title, accentColor }: { title: string; accentColor: string }) {
  return (
    <div className="text-center space-y-1.5 mb-8">
      <div className="flex items-center gap-3 justify-center">
        <div className="h-px flex-1" style={{ background: `${accentColor}30` }} />
        <h2 className="font-heading text-2xl font-medium" style={{ color: accentColor }}>{title}</h2>
        <div className="h-px flex-1" style={{ background: `${accentColor}30` }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WeddingWebsite({ site, slug }: { site: PublicWebsite; slug: string }) {
  if (site.requires_password) {
    return <PasswordGate slug={slug} accentColor={site.accentColor ?? "#5D6F5D"} />;
  }

  const color = site.accentColor ?? "#5D6F5D";
  const couple = site.couple;
  const coupleName = couple
    ? [couple.firstName, couple.partnerFirstName].filter(Boolean).join(" & ")
    : "The Couple";
  const eventDate = site.event?.eventDate;
  const du = eventDate ? daysUntil(eventDate) : null;
  const content = site.content ?? {};
  const sections = site.sectionsEnabled ?? ["home", "event", "schedule", "travel", "registry", "faq", "rsvp"];

  const BG = site.theme === "garden" ? "#F5F4F2"
    : site.theme === "modern" ? "#1A1A1A"
    : "#F7F5F1";
  const TEXT = site.theme === "modern" ? "#F7F5F1" : "#1A1A1A";

  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT }}>

      {/* Hero */}
      <div className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-16"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`, color: "white" }}>
        {content.home?.coverImageUrl && (
          <div className="absolute inset-0 bg-black/40" />
        )}
        <div className="relative z-10 space-y-4 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-75">
            {site.event?.eventType?.replace(/_/g, " ") ?? "Wedding"}
          </p>
          <h1 className="font-heading text-4xl md:text-6xl font-semibold leading-tight">
            {content.home?.title ?? coupleName}
          </h1>
          {content.home?.subtitle && (
            <p className="text-lg md:text-xl opacity-90">{content.home.subtitle}</p>
          )}
          {eventDate && (
            <div className="space-y-1 mt-6">
              <p className="text-xl font-medium">{formatEventDate(eventDate)}</p>
              {du !== null && du > 0 && (
                <p className="text-sm opacity-75">{du} days to go</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Welcome message */}
      {content.home?.welcomeMessage && (
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <p className="font-heading text-xl leading-relaxed" style={{ color }}>
            {content.home.welcomeMessage}
          </p>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-16">

        {/* Event Details */}
        {sections.includes("event") && content.event && (
          <section>
            <SectionHeader title="Event Details" accentColor={color} />
            <div className="grid gap-6 md:grid-cols-2">
              {content.event.ceremony && (
                <div className="rounded-2xl border p-6 space-y-2 text-center" style={{ borderColor: `${color}30` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Ceremony</p>
                  {content.event.ceremony.time && <p className="text-lg font-medium">{content.event.ceremony.time}</p>}
                  {content.event.ceremony.location && <p className="font-medium" style={{ color }}>{content.event.ceremony.location}</p>}
                  {content.event.ceremony.address && <p className="text-sm opacity-60">{content.event.ceremony.address}</p>}
                </div>
              )}
              {content.event.reception && (
                <div className="rounded-2xl border p-6 space-y-2 text-center" style={{ borderColor: `${color}30` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Reception</p>
                  {content.event.reception.time && <p className="text-lg font-medium">{content.event.reception.time}</p>}
                  {content.event.reception.location && <p className="font-medium" style={{ color }}>{content.event.reception.location}</p>}
                  {content.event.reception.address && <p className="text-sm opacity-60">{content.event.reception.address}</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Schedule */}
        {sections.includes("schedule") && content.schedule?.length && (
          <section>
            <SectionHeader title="Schedule" accentColor={color} />
            <div className="space-y-4">
              {content.schedule.map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="shrink-0 text-sm font-medium w-20 text-right opacity-60 pt-0.5">{item.time}</span>
                  <div className="flex-1 border-l-2 pl-4 pb-4" style={{ borderColor: `${color}40` }}>
                    <p className="font-medium">{item.title}</p>
                    {item.description && <p className="text-sm opacity-60 mt-0.5">{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Travel */}
        {sections.includes("travel") && content.travel && (
          <section>
            <SectionHeader title="Travel & Accommodations" accentColor={color} />
            {content.travel.message && <p className="text-center opacity-70 mb-6">{content.travel.message}</p>}
            {content.travel.hotels?.map((h, i) => (
              <div key={i} className="rounded-2xl border p-5 space-y-1 mb-3" style={{ borderColor: `${color}30` }}>
                <p className="font-medium">{h.name}</p>
                {h.code && <p className="text-sm opacity-60">Group code: <span className="font-mono font-medium">{h.code}</span></p>}
                {h.notes && <p className="text-sm opacity-60">{h.notes}</p>}
                {h.url && <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-sm underline" style={{ color }}>{h.url}</a>}
              </div>
            ))}
            {content.travel.transportation?.notes && (
              <div className="rounded-2xl border p-5" style={{ borderColor: `${color}30` }}>
                <p className="text-sm font-medium mb-1">Transportation</p>
                <p className="text-sm opacity-60">{content.travel.transportation.notes}</p>
              </div>
            )}
          </section>
        )}

        {/* Registry */}
        {sections.includes("registry") && content.registry?.length && (
          <section>
            <SectionHeader title="Registry" accentColor={color} />
            <div className="grid gap-3 sm:grid-cols-2">
              {content.registry.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-2xl border p-5 text-center transition-colors hover:border-current"
                  style={{ borderColor: `${color}30`, color }}>
                  <p className="font-semibold">{r.name}</p>
                  {r.notes && <p className="text-xs opacity-60 mt-1">{r.notes}</p>}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {sections.includes("faq") && content.faq?.length && (
          <section>
            <SectionHeader title="FAQ" accentColor={color} />
            <div className="space-y-4">
              {content.faq.map((item, i) => (
                <div key={i} className="rounded-2xl border p-5 space-y-2" style={{ borderColor: `${color}30` }}>
                  <p className="font-semibold">{item.question}</p>
                  <p className="text-sm opacity-70">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* RSVP */}
        {sections.includes("rsvp") && (
          <section>
            <div className="rounded-2xl p-8" style={{ background: color }}>
              <div className="text-center text-white mb-6">
                <h2 className="font-heading text-3xl font-semibold mb-2">RSVP</h2>
                <p className="opacity-75 text-sm">Enter the code from your invitation to respond.</p>
                {site.rsvpStats && site.rsvpStats.total > 0 && (
                  <p className="opacity-60 text-xs mt-1">{site.rsvpStats.attending} of {site.rsvpStats.total} guests have responded</p>
                )}
              </div>
              <RsvpSection accentColor={color} />
            </div>
          </section>
        )}

      </div>

      {/* Footer */}
      <div className="text-center py-8 text-sm opacity-40">
        {coupleName}'s Wedding · Powered by Wevenu
      </div>
    </div>
  );
}
