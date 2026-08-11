"use client";

/**
 * CoupleQuestionnaireForm — the couple-facing final details form.
 *
 * Only shows couple-relevant fields (not coordinator-internal fields
 * like vendor notes or room assignments). Those remain coordinator-owned.
 * Which of the six optional fields (meal notes, songs, special requests)
 * actually appear — and which are required — comes from the venue's own
 * questionnaire_templates config (Work Package D5D), snapshotted onto
 * `data.included_fields`/`data.required_fields`.
 *
 * No login required. Accessed via /questionnaire/{access_key} or the
 * client portal (both resolve to this same component, unchanged).
 *
 * Work Package D5D — autosaves in the background while filling in (debounced,
 * only while status='sent'), so closing the tab or losing connection before
 * clicking Submit no longer loses everything typed. Carries an optimistic-
 * concurrency token (updated_at) so a coordinator editing the same
 * questionnaire at the same time is detected rather than silently
 * overwritten.
 */

import * as React from "react";

import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

import { celebrateLuv } from "@/lib/luv/celebrate";
import { coupleCelebrationMessage } from "@/lib/luv/celebrations";

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
  included_fields?: string[];
  required_fields?: string[];
  updated_at?: string;
};

type State = "idle" | "submitting" | "success" | "already_submitted" | "stale";
type SaveState = "idle" | "saving" | "saved" | "error";

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
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
  previewMode = false,
}: {
  accessKey: string;
  data: QData;
  /** Work Package D5D — reuses this exact component for "Preview as Client" (venue-side). No network calls fire; Submit just shows what the couple would see. */
  previewMode?: boolean;
}) {
  const alreadySubmitted = !previewMode && (data.status === "submitted" || data.status === "reviewed");
  const primary = data.venue_primary_color || "#5D6F5D";
  const included = data.included_fields ?? ["meal_notes", "processional_song", "recessional_song", "first_dance_song", "parent_dances", "special_requests"];
  const required = data.required_fields ?? [];
  const showsMusic = included.includes("processional_song") || included.includes("recessional_song") || included.includes("first_dance_song") || included.includes("parent_dances");

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
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const expectedUpdatedAtRef = React.useRef(data.updated_at);

  function findMissing(): string[] {
    const missing: string[] = [];
    if (!guestCount.trim()) missing.push("Final guest count");
    if (!emergencyName.trim()) missing.push("Emergency contact name");
    if (!emergencyPhone.trim()) missing.push("Emergency contact phone");
    if (required.includes("meal_notes") && !mealNotes.trim()) missing.push("Meal preferences");
    if (required.includes("processional_song") && !processional.trim()) missing.push("Processional song");
    if (required.includes("recessional_song") && !recessional.trim()) missing.push("Recessional song");
    if (required.includes("first_dance_song") && !firstDance.trim()) missing.push("First dance song");
    if (required.includes("parent_dances") && !parentDances.trim()) missing.push("Parent dances");
    if (required.includes("special_requests") && !specialRequests.trim()) missing.push("Special requests");
    return missing;
  }

  function currentPayload() {
    return {
      accessKey,
      finalGuestCount: guestCount ? parseInt(guestCount, 10) : null,
      mealNotes, processionalSong: processional, recessionalSong: recessional,
      firstDanceSong: firstDance, parentDances, emergencyContactName: emergencyName,
      emergencyContactPhone: emergencyPhone, specialRequests,
    };
  }

  // Work Package D5D — debounced background autosave. Only while the form
  // is still open for editing (not yet submitted, not a preview) — this is
  // the couple's real "save progress" mechanism; before this, every answer
  // lived only in React state until the final Submit click.
  const isDirty = React.useRef(false);
  React.useEffect(() => {
    if (previewMode || alreadySubmitted || state !== "idle") return;
    isDirty.current = true;
    const timer = setTimeout(async () => {
      if (!isDirty.current) return;
      isDirty.current = false;
      setSaveState("saving");
      try {
        const res = await fetch("/api/public/questionnaire/draft", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...currentPayload(), expectedUpdatedAt: expectedUpdatedAtRef.current }),
        });
        const result = await res.json() as { ok?: boolean; error?: string; updatedAt?: string };
        if (result.ok) {
          if (result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
          setSaveState("saved");
        } else if (result.error === "stale") {
          setState("stale");
        } else {
          setSaveState("error");
        }
      } catch { setSaveState("error"); }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestCount, mealNotes, processional, recessional, firstDance, parentDances, emergencyName, emergencyPhone, specialRequests]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = findMissing();
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}.`);
      return;
    }
    if (previewMode) { setState("success"); return; }
    setState("submitting");
    setError("");

    try {
      const res = await fetch("/api/public/questionnaire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...currentPayload(), expectedUpdatedAt: expectedUpdatedAtRef.current }),
      });
      const result = await res.json() as { ok?: boolean; celebrated?: boolean; message?: string; error?: string };
      if (result.ok) {
        // Layered acknowledgment only when DB says this is the first fire.
        if (result.celebrated) {
          celebrateLuv(coupleCelebrationMessage("questionnaire_submitted"));
        }
        setState("success");
      } else if (result.error === "stale") {
        setState("stale");
      } else { setError(result.message ?? "Something went wrong."); setState("idle"); }
    } catch { setError("Network error. Please try again."); setState("idle"); }
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:border-transparent";

  if (state === "stale") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primary}08` }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">This form was just updated</h2>
          <p className="text-gray-600">
            Your coordinator made a change to this form while you were filling it in. Refresh the page to see the latest version before continuing.
          </p>
          <button type="button" onClick={() => window.location.reload()}
            className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: primary }}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (state === "success" || state === "already_submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primary}08` }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto" style={{ color: primary }} />
          <h2 className="text-xl font-semibold text-gray-900">
            {state === "already_submitted" ? "Already submitted!" : previewMode ? "This is what the couple will see." : "Thank you!"}
          </h2>
          <p className="text-gray-600">
            {state === "already_submitted"
              ? "Your final details have already been submitted. Reach out to your coordinator if you need to make changes."
              : previewMode ? "In the real form, this confirmation appears once the couple submits."
              : "Your final details have been received. Your coordinator will review them shortly. We can't wait for your event!"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-0" style={{ backgroundColor: `${primary}06` }}>
      {previewMode && (
        <div className="sticky top-0 z-10 bg-amber-100 border-b border-amber-200 px-4 py-2 text-center text-xs font-medium text-amber-900">
          Preview — this is exactly what your couple sees. Nothing you enter here is saved.
        </div>
      )}
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

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-600 leading-relaxed">
              Please fill in your final details below. These go directly to your coordinator — no attachments, no emails, no re-keying.
            </p>
          </div>
          {!previewMode && (
            <p className="text-xs text-gray-400 -mt-3 flex items-center gap-1.5" aria-live="polite">
              {saveState === "saving" && <><Loader2 className="h-3 w-3 animate-spin" />Saving…</>}
              {saveState === "saved" && "Progress saved automatically."}
              {saveState === "error" && "Couldn't save just now — your answers are still here, try again shortly."}
            </p>
          )}

          {/* Guests & Meals */}
          <SectionHead>Guests & meals</SectionHead>
          <Field label="Final guest count" required>
            <input type="number" min="1" inputMode="numeric" value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)} placeholder="175"
              className={inputCls + " w-32"} />
          </Field>
          {included.includes("meal_notes") && (
            <Field label="Meal preferences" required={required.includes("meal_notes")}
              hint="Entrée counts, dietary requirements, children's meals — any details that help your caterer.">
              <textarea value={mealNotes} onChange={(e) => setMealNotes(e.target.value)}
                placeholder="Chicken: 85  ·  Fish: 45  ·  Vegan: 12  ·  Children's: 8  ·  Nut allergy: table 4…"
                rows={3} className={inputCls + " resize-none"} />
            </Field>
          )}

          {/* Music */}
          {showsMusic && (
            <>
              <SectionHead>Music selections</SectionHead>
              <div className="grid gap-4 sm:grid-cols-2">
                {included.includes("processional_song") && (
                  <Field label="Processional song" required={required.includes("processional_song")}>
                    <input value={processional} onChange={(e) => setProcessional(e.target.value)}
                      placeholder="Canon in D" className={inputCls} />
                  </Field>
                )}
                {included.includes("recessional_song") && (
                  <Field label="Recessional song" required={required.includes("recessional_song")}>
                    <input value={recessional} onChange={(e) => setRecessional(e.target.value)}
                      placeholder="Signed, Sealed, Delivered" className={inputCls} />
                  </Field>
                )}
                {included.includes("first_dance_song") && (
                  <Field label="First dance" required={required.includes("first_dance_song")}>
                    <input value={firstDance} onChange={(e) => setFirstDance(e.target.value)}
                      placeholder="At Last — Etta James" className={inputCls} />
                  </Field>
                )}
                {included.includes("parent_dances") && (
                  <Field label="Parent dances" required={required.includes("parent_dances")} hint={required.includes("parent_dances") ? undefined : "Optional"}>
                    <input value={parentDances} onChange={(e) => setParentDances(e.target.value)}
                      placeholder="My Girl · Wind Beneath My Wings" className={inputCls} />
                  </Field>
                )}
              </div>
            </>
          )}

          {/* Emergency contact */}
          <SectionHead>Day-of emergency contact</SectionHead>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Emily Carter" className={inputCls} />
            </Field>
            <Field label="Phone" required>
              <input type="tel" inputMode="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="(615) 555-0100" className={inputCls} />
            </Field>
          </div>

          {/* Special requests */}
          {included.includes("special_requests") && (
            <>
              <SectionHead>Anything else</SectionHead>
              <Field label="Special requests or notes" required={required.includes("special_requests")}
                hint="Surprises, accessibility needs, personal touches — anything you'd like your coordinator to know.">
                <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="We're planning a surprise toast at 7pm…" rows={4}
                  className={inputCls + " resize-none"} />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button type="submit" disabled={state === "submitting"}
            className="w-full rounded-lg py-3.5 sm:py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primary }}>
            {state === "submitting"
              ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
              : previewMode ? "Submit final details (preview)" : "Submit final details"}
          </button>
          <p className="text-center text-xs text-gray-400">
            Your details go directly to {data.venue_name} — no PDFs, no attachments.
          </p>
        </form>
      </div>
    </div>
  );
}
