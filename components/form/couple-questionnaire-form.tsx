"use client";

/**
 * CoupleQuestionnaireForm — the couple-facing final details form.
 *
 * Only shows couple-relevant fields (not coordinator-internal fields
 * like vendor notes or room assignments). Those remain coordinator-owned.
 *
 * No login required. Accessed via /questionnaire/{access_key}.
 */

import * as React from "react";

import { CheckCircle, Loader2 } from "lucide-react";

type QData = {
  questionnaire_id: string;
  event_name: string;
  event_date: string;
  venue_name: string;
  venue_logo_url: string | null;
  venue_primary_color: string;
  status: string;
  final_guest_count: number | null;
  meal_notes: string | null;
  processional_song: string | null;
  recessional_song: string | null;
  first_dance_song: string | null;
  parent_dances: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  special_requests: string | null;
};

type State = "idle" | "submitting" | "success" | "already_submitted";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{children}</p>
    </div>
  );
}

export function CoupleQuestionnaireForm({
  accessKey,
  data,
}: {
  accessKey: string;
  data: QData;
}) {
  const alreadySubmitted = data.status === "submitted" || data.status === "reviewed";
  const primary = data.venue_primary_color || "#5D6F5D";

  const eventDate = data.event_date
    ? new Date(data.event_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : null;

  const [state, setState] = React.useState<State>(alreadySubmitted ? "already_submitted" : "idle");
  const [guestCount, setGuestCount] = React.useState(String(data.final_guest_count ?? ""));
  const [mealNotes, setMealNotes] = React.useState(data.meal_notes ?? "");
  const [processional, setProcessional] = React.useState(data.processional_song ?? "");
  const [recessional, setRecessional] = React.useState(data.recessional_song ?? "");
  const [firstDance, setFirstDance] = React.useState(data.first_dance_song ?? "");
  const [parentDances, setParentDances] = React.useState(data.parent_dances ?? "");
  const [emergencyName, setEmergencyName] = React.useState(data.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = React.useState(data.emergency_contact_phone ?? "");
  const [specialRequests, setSpecialRequests] = React.useState(data.special_requests ?? "");
  const [error, setError] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setError("");

    try {
      const res = await fetch("/api/public/questionnaire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessKey,
          finalGuestCount: guestCount ? parseInt(guestCount, 10) : null,
          mealNotes, processionalSong: processional, recessionalSong: recessional,
          firstDanceSong: firstDance, parentDances, emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone, specialRequests,
        }),
      });
      const result = await res.json();
      if (result.ok) setState("success");
      else { setError(result.message ?? "Something went wrong."); setState("idle"); }
    } catch { setError("Network error. Please try again."); setState("idle"); }
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent";

  if (state === "success" || state === "already_submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primary}08` }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto" style={{ color: primary }} />
          <h2 className="text-xl font-semibold text-gray-900">
            {state === "already_submitted" ? "Already submitted!" : "Thank you!"}
          </h2>
          <p className="text-gray-600">
            {state === "already_submitted"
              ? "Your final details have already been submitted. Reach out to your coordinator if you need to make changes."
              : "Your final details have been received. Your coordinator will review them shortly. We can't wait for your event!"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: `${primary}06` }}>
      {/* Header */}
      <div className="py-8 px-4 text-center" style={{ backgroundColor: primary }}>
        {data.venue_logo_url && (
          <img src={data.venue_logo_url} alt={data.venue_name}
            className="h-12 w-12 object-contain rounded-lg mx-auto mb-3"
            style={{ background: "rgba(255,255,255,0.15)" }} />
        )}
        <h1 className="text-white text-xl font-semibold">{data.venue_name}</h1>
        <p className="text-white/80 text-sm mt-1">Final Details — {data.event_name}</p>
        {eventDate && <p className="text-white/60 text-xs mt-0.5">{eventDate}</p>}
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">

          <p className="text-sm text-gray-600 leading-relaxed">
            Please fill in your final details below. These go directly to your coordinator — no attachments, no emails, no re-keying.
          </p>

          {/* Guests & Meals */}
          <SectionHead>Guests & meals</SectionHead>
          <Field label="Final guest count">
            <input type="number" min="1" value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)} placeholder="175"
              className={inputCls + " w-32"} />
          </Field>
          <Field label="Meal preferences" hint="Entrée counts, dietary requirements, children's meals — any details that help your caterer.">
            <textarea value={mealNotes} onChange={(e) => setMealNotes(e.target.value)}
              placeholder="Chicken: 85  ·  Fish: 45  ·  Vegan: 12  ·  Children's: 8  ·  Nut allergy: table 4…"
              rows={3} className={inputCls + " resize-none"} />
          </Field>

          {/* Music */}
          <SectionHead>Music selections</SectionHead>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Processional song">
              <input value={processional} onChange={(e) => setProcessional(e.target.value)}
                placeholder="Canon in D" className={inputCls} />
            </Field>
            <Field label="Recessional song">
              <input value={recessional} onChange={(e) => setRecessional(e.target.value)}
                placeholder="Signed, Sealed, Delivered" className={inputCls} />
            </Field>
            <Field label="First dance">
              <input value={firstDance} onChange={(e) => setFirstDance(e.target.value)}
                placeholder="At Last — Etta James" className={inputCls} />
            </Field>
            <Field label="Parent dances" hint="Optional">
              <input value={parentDances} onChange={(e) => setParentDances(e.target.value)}
                placeholder="My Girl · Wind Beneath My Wings" className={inputCls} />
            </Field>
          </div>

          {/* Emergency contact */}
          <SectionHead>Day-of emergency contact</SectionHead>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Emily Carter" className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="(615) 555-0100" className={inputCls} />
            </Field>
          </div>

          {/* Special requests */}
          <SectionHead>Anything else</SectionHead>
          <Field label="Special requests or notes"
            hint="Surprises, accessibility needs, personal touches — anything you'd like your coordinator to know.">
            <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="We're planning a surprise toast at 7pm…" rows={4}
              className={inputCls + " resize-none"} />
          </Field>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button type="submit" disabled={state === "submitting"}
            className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primary }}>
            {state === "submitting"
              ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
              : "Submit final details"}
          </button>
          <p className="text-center text-xs text-gray-400">
            Your details go directly to {data.venue_name} — no PDFs, no attachments.
          </p>
        </form>
      </div>
    </div>
  );
}
