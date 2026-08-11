"use client";

/**
 * Couple-facing Questionnaire Family form — Client Planning, Final Details,
 * and Post-Event Feedback. Preserves D5D autosave + optimistic concurrency.
 * Uses approved wording from lib/questionnaire-family/definitions.ts.
 */

import * as React from "react";

import { AlertTriangle, CheckCircle, ExternalLink, Loader2 } from "lucide-react";

import { celebrateLuv } from "@/lib/luv/celebrate";
import { coupleCelebrationMessage } from "@/lib/luv/celebrations";
import {
  getQuestionnaireMasterByKind,
  type QuestionnaireFieldDef,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";

export type FamilyQuestionnaireData = {
  questionnaire_id: string;
  access_key?: string;
  kind: QuestionnaireKind;
  event_name: string;
  event_date: string | null;
  event_guest_count: number | null;
  venue_name: string;
  venue_logo_url: string | null;
  venue_primary_color: string;
  public_review_url?: string | null;
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
  ceremony_start_time?: string | null;
  reception_start_time?: string | null;
  ceremony_location?: string | null;
  reception_location?: string | null;
  vendor_notes?: string | null;
  included_fields?: string[];
  required_fields?: string[];
  additional?: { family?: Record<string, string> } | null;
  updated_at?: string;
  known_vendors?: { name: string; role?: string | null }[];
  client_primary_name?: string | null;
};

type State = "idle" | "submitting" | "success" | "already_submitted" | "stale";
type SaveState = "idle" | "saving" | "saved" | "error";

function FieldShell({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
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

function interpolate(text: string, venueName: string): string {
  return text.replace(/\{\{venue_name\}\}/g, venueName);
}

function columnValue(data: FamilyQuestionnaireData, column: string): string {
  const map: Record<string, string | null | undefined> = {
    meal_notes: data.meal_notes,
    processional_song: data.processional_song,
    recessional_song: data.recessional_song,
    first_dance_song: data.first_dance_song,
    parent_dances: data.parent_dances,
    emergency_contact_name: data.emergency_contact_name,
    emergency_contact_phone: data.emergency_contact_phone,
    special_requests: data.special_requests,
    vendor_notes: data.vendor_notes,
    ceremony_start_time: data.ceremony_start_time,
    reception_start_time: data.reception_start_time,
    ceremony_location: data.ceremony_location,
    reception_location: data.reception_location,
  };
  return map[column] ?? "";
}

export function CoupleFamilyQuestionnaireForm({
  accessKey,
  data,
  previewMode = false,
}: {
  accessKey: string;
  data: FamilyQuestionnaireData;
  previewMode?: boolean;
}) {
  const kind = data.kind || "final_details";
  const master = getQuestionnaireMasterByKind(kind);
  const alreadySubmitted = !previewMode && (data.status === "submitted" || data.status === "reviewed");
  const primary = data.venue_primary_color || "#5D6F5D";
  const masterIds = master.fields.map((f) => f.id);
  const snapshot = data.included_fields ?? [];
  const snapshotLooksLikeFamily = snapshot.some((id) => masterIds.includes(id));
  const included = new Set(snapshotLooksLikeFamily && snapshot.length ? snapshot : masterIds);
  const requiredDefault = master.fields.filter((f) => f.required).map((f) => f.id);
  const requiredSnapshot = data.required_fields ?? [];
  const required = new Set(
    requiredSnapshot.some((id) => masterIds.includes(id)) ? requiredSnapshot : requiredDefault,
  );
  const fields = master.fields.filter((f) => included.has(f.id));
  const familyInit = data.additional?.family ?? {};

  const eventDate = data.event_date
    ? new Date(data.event_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : null;

  const [state, setState] = React.useState<State>(alreadySubmitted ? "already_submitted" : "idle");
  const [family, setFamily] = React.useState<Record<string, string>>(() => {
    const init = { ...familyInit };
    if (!init.primary_day_of_contact && data.client_primary_name) {
      init.primary_day_of_contact = data.client_primary_name;
    }
    return init;
  });
  const [columns, setColumns] = React.useState<Record<string, string>>(() => {
    const c: Record<string, string> = {};
    for (const f of fields) {
      if (f.destination === "column" && f.column) c[f.column] = columnValue(data, f.column);
    }
    return c;
  });
  const [guestConfirm, setGuestConfirm] = React.useState<"yes" | "no" | "">(
    data.final_guest_count != null || data.event_guest_count != null ? "" : "no",
  );
  const [guestCount, setGuestCount] = React.useState(String(data.final_guest_count ?? data.event_guest_count ?? ""));
  const [timingChanging, setTimingChanging] = React.useState(false);
  const [ceremonyChanging, setCeremonyChanging] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const expectedUpdatedAtRef = React.useRef(data.updated_at);
  const isDirty = React.useRef(false);

  function setFamilyField(id: string, value: string) {
    setFamily((prev) => ({ ...prev, [id]: value }));
  }

  function visibleFields(): QuestionnaireFieldDef[] {
    return fields.filter((f) => {
      const controller = fields.find((c) => c.followUpId === f.id);
      if (!controller?.showFollowUpWhen) return true;
      const choice = family[controller.id] ?? "";
      return controller.showFollowUpWhen.includes(choice);
    });
  }

  function findMissing(): string[] {
    const missing: string[] = [];
    for (const f of visibleFields()) {
      if (!required.has(f.id) && !f.required) continue;
      if (f.type === "guest_count_confirm") {
        if (!guestConfirm) missing.push("Guest count confirmation");
        else if (guestConfirm === "no" && !guestCount.trim()) missing.push("Updated guest count");
        else if (guestConfirm === "yes" && data.event_guest_count == null && !guestCount.trim()) missing.push("Guest count");
        continue;
      }
      if (f.destination === "column" && f.column) {
        if (!columns[f.column]?.trim()) missing.push(f.label);
        continue;
      }
      if (f.destination === "family" && !family[f.id]?.trim()) missing.push(f.label);
    }
    return missing;
  }

  function buildPayload() {
    const payload: Record<string, unknown> = {
      family: { ...family },
      meal_notes: columns.meal_notes ?? "",
      processional_song: columns.processional_song ?? "",
      recessional_song: columns.recessional_song ?? "",
      first_dance_song: columns.first_dance_song ?? "",
      parent_dances: columns.parent_dances ?? "",
      emergency_contact_name: columns.emergency_contact_name ?? "",
      emergency_contact_phone: columns.emergency_contact_phone ?? "",
      special_requests: columns.special_requests ?? "",
      vendor_notes: columns.vendor_notes ?? "",
      ceremony_start_time: columns.ceremony_start_time ?? "",
      reception_start_time: columns.reception_start_time ?? "",
      ceremony_location: columns.ceremony_location ?? "",
      reception_location: columns.reception_location ?? "",
    };
    if (guestConfirm === "yes") {
      payload.guest_count_confirmed = "yes";
      payload.final_guest_count = data.event_guest_count ?? (guestCount ? Number(guestCount) : null);
    } else if (guestConfirm === "no") {
      payload.guest_count_confirmed = "no";
      payload.final_guest_count = guestCount ? Number(guestCount) : null;
    } else if (guestCount) {
      payload.final_guest_count = Number(guestCount);
    }
    if (timingChanging) {
      payload.family = {
        ...(payload.family as object),
        timing_change_notes: family.timing_change_notes ?? "",
      };
    }
    if (ceremonyChanging) {
      payload.family = {
        ...(payload.family as object),
        ceremony_change_notes: family.ceremony_change_notes ?? "",
      };
    }
    return payload;
  }

  React.useEffect(() => {
    if (previewMode || alreadySubmitted || state !== "idle") return;
    isDirty.current = true;
    const timer = setTimeout(async () => {
      if (!isDirty.current) return;
      isDirty.current = false;
      setSaveState("saving");
      try {
        const res = await fetch("/api/public/questionnaire/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accessKey,
            familyPayload: buildPayload(),
            expectedUpdatedAt: expectedUpdatedAtRef.current,
          }),
        });
        const result = await res.json() as { ok?: boolean; error?: string; updatedAt?: string };
        if (result.ok) {
          if (result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
          setSaveState("saved");
        } else if (result.error === "stale") setState("stale");
        else setSaveState("error");
      } catch { setSaveState("error"); }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, columns, guestConfirm, guestCount, timingChanging, ceremonyChanging]);

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
        body: JSON.stringify({
          accessKey,
          familyPayload: buildPayload(),
          expectedUpdatedAt: expectedUpdatedAtRef.current,
        }),
      });
      const result = await res.json() as { ok?: boolean; celebrated?: boolean; message?: string; error?: string };
      if (result.ok) {
        if (result.celebrated) celebrateLuv(coupleCelebrationMessage("questionnaire_submitted"));
        setState("success");
      } else if (result.error === "stale") setState("stale");
      else { setError(result.message ?? "Something went wrong."); setState("idle"); }
    } catch { setError("Network error. Please try again."); setState("idle"); }
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:border-transparent";
  const sections = [...new Set(visibleFields().map((f) => f.section))];

  if (state === "stale") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
        <p className="font-medium text-heading">This form was updated elsewhere</p>
        <p className="text-sm text-muted-foreground">Please reload the page to see the latest version, then continue.</p>
        <button type="button" className="text-sm underline" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  if (state === "success" || state === "already_submitted") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <CheckCircle className="mx-auto h-10 w-10" style={{ color: primary }} />
        <p className="font-heading text-xl text-heading">Thank you</p>
        <p className="text-sm text-muted-foreground">
          {kind === "post_event_feedback"
            ? "Your feedback is with our team."
            : "Your answers are with your venue team."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-3 text-center">
        {data.venue_logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.venue_logo_url} alt="" className="mx-auto h-12 object-contain" />
        )}
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: primary }}>{data.venue_name}</p>
        <h1 className="font-heading text-2xl text-heading">{master.welcomeTitle}</h1>
        {eventDate && <p className="text-sm text-muted-foreground">Your celebration is scheduled for {eventDate}.</p>}
        <div className="space-y-2 text-sm text-muted-foreground text-left">
          {master.welcomeBody.map((p) => <p key={p}>{p}</p>)}
        </div>
        {saveState === "saving" && <p className="text-xs text-muted-foreground">Saving…</p>}
        {saveState === "saved" && <p className="text-xs text-muted-foreground">Progress saved</p>}
      </header>

      {sections.map((section) => (
        <section key={section} className="space-y-4">
          <SectionHead>{section}</SectionHead>
          {visibleFields().filter((f) => f.section === section).map((f) => {
            if (f.type === "guest_count_confirm") {
              const known = data.event_guest_count;
              return (
                <div key={f.id} className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  {known != null ? (
                    <p className="text-sm text-heading">
                      We currently have <strong>{known}</strong> guests listed for your event. Is that still correct?
                    </p>
                  ) : (
                    <p className="text-sm text-heading">What is your current guest count for the event?</p>
                  )}
                  {known != null && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {(["yes", "no"] as const).map((v) => (
                        <label key={v} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="guest_confirm" checked={guestConfirm === v} onChange={() => setGuestConfirm(v)} />
                          {v === "yes" ? "Yes, that's right" : "No, I'd like to update it"}
                        </label>
                      ))}
                    </div>
                  )}
                  {(known == null || guestConfirm === "no") && (
                    <FieldShell label="Guest count" required>
                      <input className={inputCls} inputMode="numeric" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
                    </FieldShell>
                  )}
                </div>
              );
            }

            if (f.type === "known_timing_confirm") {
              return (
                <div key={f.id} className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-sm text-heading">{f.label}</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {data.ceremony_start_time && <li>Ceremony: {data.ceremony_start_time}{data.ceremony_location ? ` · ${data.ceremony_location}` : ""}</li>}
                    {data.reception_start_time && <li>Reception: {data.reception_start_time}{data.reception_location ? ` · ${data.reception_location}` : ""}</li>}
                    {!data.ceremony_start_time && !data.reception_start_time && (
                      <li>Your coordinator will keep your Timeline and Event Order current as details firm up.</li>
                    )}
                  </ul>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={timingChanging} onChange={(e) => setTimingChanging(e.target.checked)} />
                    Something is changing
                  </label>
                  {timingChanging && (
                    <textarea className={inputCls} rows={3} value={family.timing_change_notes ?? ""} onChange={(e) => setFamilyField("timing_change_notes", e.target.value)} placeholder="Tell us what should change" />
                  )}
                  {timingChanging && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldShell label="Ceremony start">
                        <input className={inputCls} type="time" value={columns.ceremony_start_time ?? ""} onChange={(e) => setColumns((c) => ({ ...c, ceremony_start_time: e.target.value }))} />
                      </FieldShell>
                      <FieldShell label="Reception start">
                        <input className={inputCls} type="time" value={columns.reception_start_time ?? ""} onChange={(e) => setColumns((c) => ({ ...c, reception_start_time: e.target.value }))} />
                      </FieldShell>
                    </div>
                  )}
                </div>
              );
            }

            if (f.type === "known_ceremony_confirm") {
              return (
                <div key={f.id} className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-sm text-heading">{f.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {[data.ceremony_location, data.ceremony_start_time].filter(Boolean).join(" · ") || "Ceremony details are on your Event Order / Timeline as your plans firm up."}
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={ceremonyChanging} onChange={(e) => setCeremonyChanging(e.target.checked)} />
                    Something is changing
                  </label>
                  {ceremonyChanging && (
                    <textarea className={inputCls} rows={3} value={family.ceremony_change_notes ?? ""} onChange={(e) => setFamilyField("ceremony_change_notes", e.target.value)} />
                  )}
                </div>
              );
            }

            if (f.type === "vendor_review") {
              return (
                <div key={f.id} className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-sm text-heading">{f.label}</p>
                  {(data.known_vendors?.length ?? 0) > 0 ? (
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {data.known_vendors!.map((v) => (
                        <li key={`${v.name}-${v.role}`}>{v.name}{v.role ? ` — ${v.role}` : ""}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No vendors are on file yet for this celebration.</p>
                  )}
                  <FieldShell label="Additions or corrections">
                    <textarea className={inputCls} rows={3} value={family.vendor_review ?? ""} onChange={(e) => setFamilyField("vendor_review", e.target.value)} />
                  </FieldShell>
                </div>
              );
            }

            const label = interpolate(f.label, data.venue_name);
            const value = f.destination === "column" && f.column
              ? (columns[f.column] ?? "")
              : (family[f.id] ?? "");

            if (f.type === "single_choice" || f.type === "rating_1_5") {
              return (
                <FieldShell key={f.id} label={label} hint={f.helper} required={required.has(f.id) || f.required}>
                  <div className="space-y-2">
                    {(f.options ?? []).map((opt) => (
                      <label key={opt.value} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name={f.id}
                          checked={value === opt.value}
                          onChange={() => {
                            if (f.destination === "column" && f.column) setColumns((c) => ({ ...c, [f.column!]: opt.value }));
                            else setFamilyField(f.id, opt.value);
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {f.id === "share_review" && value === "yes" && data.public_review_url && (
                    <a href={data.public_review_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline mt-2" style={{ color: primary }}>
                      Open review page <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {f.id === "share_review" && value === "yes" && !data.public_review_url && (
                    <p className="text-xs text-muted-foreground mt-2">Your venue will share a review link when they have one configured.</p>
                  )}
                </FieldShell>
              );
            }

            const isLong = f.type === "long_text" || f.type === "people_notes" || f.type === "conditional_long_text";
            return (
              <FieldShell key={f.id} label={label} hint={f.helper} required={required.has(f.id) || f.required}>
                {isLong ? (
                  <textarea
                    className={inputCls}
                    rows={4}
                    value={value}
                    onChange={(e) => {
                      if (f.destination === "column" && f.column) setColumns((c) => ({ ...c, [f.column!]: e.target.value }));
                      else setFamilyField(f.id, e.target.value);
                    }}
                  />
                ) : (
                  <input
                    className={inputCls}
                    value={value}
                    onChange={(e) => {
                      if (f.destination === "column" && f.column) setColumns((c) => ({ ...c, [f.column!]: e.target.value }));
                      else setFamilyField(f.id, e.target.value);
                    }}
                  />
                )}
              </FieldShell>
            );
          })}
        </section>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full rounded-lg px-4 py-3 text-sm font-medium text-white"
        style={{ background: primary }}
      >
        {state === "submitting" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Submit"}
      </button>
    </form>
  );
}
