"use client";

/**
 * Public venue inquiry experience — Request Information and Schedule a Tour.
 */

import * as React from "react";

import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";

import {
  RequestInformationConfirmation,
  ScheduleTourConfirmation,
} from "@/components/form/inquiry-confirmations";
import { TurnstileWidget } from "@/components/shared/turnstile-widget";
import {
  INQUIRY_API_ERRORS,
  PUBLIC_INQUIRY_EVENT_TYPES,
} from "@/lib/inquiry-form/constants";
import type {
  InquiryFormQuestion,
  InquiryMode,
  PublicInquiryFormConfig,
  TourBookingConfirmation,
} from "@/lib/inquiry-form/types";
import {
  fieldLabel,
  validateConfigurableFields,
  validateCustomAnswers,
} from "@/lib/inquiry-form/validation";
import type { TourSlot } from "@/lib/tours/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type FormState = "idle" | "submitting" | "success_info" | "success_tour" | "error";

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function ModeSelector({
  mode,
  onSelect,
  primary,
  tourEnabled,
}: {
  mode: InquiryMode | null;
  onSelect: (m: InquiryMode) => void;
  primary: string;
  tourEnabled: boolean;
}) {
  if (!tourEnabled) return null;
  const tourActive = mode === "schedule_tour";
  const infoActive = mode === "request_information";
  const inactiveBorder = "#DED6CA";
  const inactiveBg = "#F5F4F2";

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSelect("schedule_tour")}
        className="rounded-2xl border-2 p-4 text-center space-y-1.5 transition-colors"
        style={
          tourActive
            ? { borderColor: primary, background: `${primary}08` }
            : { borderColor: inactiveBorder, background: inactiveBg }
        }
      >
        <p className="text-2xl">📅</p>
        <p className="text-sm font-semibold" style={{ color: tourActive ? primary : "#374151" }}>
          Schedule a Tour
        </p>
        <p className="text-xs text-gray-500">Pick a date and time to visit us.</p>
      </button>
      <button
        type="button"
        onClick={() => onSelect("request_information")}
        className="rounded-2xl border-2 p-4 text-center space-y-1.5 transition-colors"
        style={
          infoActive
            ? { borderColor: primary, background: `${primary}08` }
            : { borderColor: inactiveBorder, background: inactiveBg }
        }
      >
        <p className="text-2xl">✉️</p>
        <p className="text-sm font-semibold" style={{ color: infoActive ? primary : "#374151" }}>
          Request Information
        </p>
        <p className="text-xs text-gray-500">Tell us about your event.</p>
      </button>
    </div>
  );
}

function AvailabilityCalendar({
  availableDates,
  selectedDate,
  onSelect,
  month,
  year,
  onMonthChange,
  primary,
}: {
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelect: (d: string) => void;
  month: number;
  year: number;
  onMonthChange: (m: number, y: number) => void;
  primary: string;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => (month === 0 ? onMonthChange(11, year - 1) : onMonthChange(month - 1, year))} aria-label="Previous month" className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-semibold text-gray-900">{MONTHS[month]} {year}</p>
        <button type="button" onClick={() => (month === 11 ? onMonthChange(0, year + 1) : onMonthChange(month + 1, year))} aria-label="Next month" className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS.map((d) => <p key={d} className="text-center text-[11px] font-medium text-gray-500 py-1">{d}</p>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const iso = isoDate(year, month, day);
          const isAvail = availableDates.has(iso);
          const isPast = new Date(year, month, day) < today;
          const isSel = iso === selectedDate;
          return (
            <button
              key={iso}
              type="button"
              disabled={!isAvail || isPast}
              onClick={() => onSelect(iso)}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${isSel ? "text-white" : isAvail && !isPast ? "text-gray-900 hover:bg-gray-100" : "text-gray-300"}`}
              style={isSel ? { background: primary } : isAvail && !isPast ? { background: `${primary}14` } : {}}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomQuestionField({
  q,
  value,
  onChange,
  error,
}: {
  q: InquiryFormQuestion;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  error?: string;
}) {
  const label = q.required ? `${q.questionText} *` : q.questionText;
  if (q.questionType === "long_answer") {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  if (q.questionType === "single_select") {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">Select…</option>
          {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  if (q.questionType === "multiple_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <p className="block text-sm font-medium text-gray-700">{label}</p>
        <div className="space-y-2">
          {q.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => {
                  onChange(e.target.checked ? [...selected, o] : selected.filter((x) => x !== o));
                }}
              />
              {o}
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function InquiryForm({
  embedKey,
  config,
  initialMode = null,
}: {
  embedKey: string;
  config: PublicInquiryFormConfig;
  initialMode?: InquiryMode | null;
}) {
  const { venue, inquiryFormFields: fields, inquiryEventDateMode, customQuestions, tourSchedulingEnabled, tourEmbedKey, acceptedEventTypes } = config;
  const primary = venue.primaryColor || "#5D6F5D";
  const eventTypeOptions = PUBLIC_INQUIRY_EVENT_TYPES.filter((t) => acceptedEventTypes.includes(t.value));

  const [mode, setMode] = React.useState<InquiryMode | null>(() => {
    if (initialMode) return initialMode;
    return tourSchedulingEnabled ? null : "request_information";
  });

  const [state, setState] = React.useState<FormState>("idle");
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [tourConfirmation, setTourConfirmation] = React.useState<TourBookingConfirmation | null>(null);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [partnerFirst, setPartnerFirst] = React.useState("");
  const [partnerLast, setPartnerLast] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [eventDate, setEventDate] = React.useState("");
  const [guestCount, setGuestCount] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [customAnswers, setCustomAnswers] = React.useState<Record<string, string | string[]>>({});

  const today = new Date();
  const [eventMonth, setEventMonth] = React.useState(today.getMonth());
  const [eventYear, setEventYear] = React.useState(today.getFullYear());
  const [availableEventDates, setAvailableEventDates] = React.useState<Set<string>>(new Set());
  const [loadingEventDates, setLoadingEventDates] = React.useState(false);

  const [tourMonth, setTourMonth] = React.useState(today.getMonth());
  const [tourYear, setTourYear] = React.useState(today.getFullYear());
  const [tourSlots, setTourSlots] = React.useState<TourSlot[]>([]);
  const [loadingTourSlots, setLoadingTourSlots] = React.useState(false);
  const [selectedTourDate, setSelectedTourDate] = React.useState<string | null>(null);
  const [selectedTourSlot, setSelectedTourSlot] = React.useState<TourSlot | null>(null);

  React.useEffect(() => {
    if (inquiryEventDateMode !== "choose_available" || fields.preferred_event_date === "hidden") return;
    setLoadingEventDates(true);
    const start = isoDate(eventYear, eventMonth, 1);
    const last = new Date(eventYear, eventMonth + 1, 0).getDate();
    const end = isoDate(eventYear, eventMonth, last);
    fetch(`/api/public/inquiry-available-dates?key=${embedKey}&start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d: { dates?: string[] }) => setAvailableEventDates(new Set(d.dates ?? [])))
      .catch(() => setAvailableEventDates(new Set()))
      .finally(() => setLoadingEventDates(false));
  }, [embedKey, eventMonth, eventYear, inquiryEventDateMode, fields.preferred_event_date]);

  React.useEffect(() => {
    if (mode !== "schedule_tour" || !tourEmbedKey) return;
    setLoadingTourSlots(true);
    const start = isoDate(tourYear, tourMonth, 1);
    const last = new Date(tourYear, tourMonth + 1, 0).getDate();
    const end = isoDate(tourYear, tourMonth, last);
    fetch(`/api/tours/slots?key=${tourEmbedKey}&start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d: { slots?: TourSlot[] }) => setTourSlots(d.slots ?? []))
      .catch(() => setTourSlots([]))
      .finally(() => setLoadingTourSlots(false));
  }, [mode, tourEmbedKey, tourMonth, tourYear]);

  const tourAvailableDates = new Set(tourSlots.map((s) => s.date));
  const tourSlotsForDate = selectedTourDate ? tourSlots.filter((s) => s.date === selectedTourDate) : [];

  function buildSourceData(inquiryMode: InquiryMode) {
    const urlParams = new URLSearchParams(window.location.search);
    const customAnswerEntries = customQuestions
      .map((q) => {
        const answer = customAnswers[q.id];
        if (answer == null || (typeof answer === "string" && !answer.trim()) || (Array.isArray(answer) && answer.length === 0)) {
          return null;
        }
        return { questionId: q.id, questionText: q.questionText, answer };
      })
      .filter(Boolean);
    return {
      source: "website_form",
      form_key: embedKey,
      inquiry_mode: inquiryMode,
      custom_answers: customAnswerEntries,
      utm_source: urlParams.get("utm_source") ?? undefined,
      utm_medium: urlParams.get("utm_medium") ?? undefined,
      utm_campaign: urlParams.get("utm_campaign") ?? undefined,
      utm_content: urlParams.get("utm_content") ?? undefined,
      utm_term: urlParams.get("utm_term") ?? undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.href,
      qr_campaign_id: urlParams.get("qr") ?? undefined,
    };
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = "First name is required.";
    if (!lastName.trim()) errors.lastName = "Last name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    if (!eventType) errors.eventType = "Event type is required.";
    Object.assign(errors, validateConfigurableFields(fields, {
      phone, partnerFirst, partnerLast, eventDate, guestCount, budget, message,
    }));
    Object.assign(errors, validateCustomAnswers(customQuestions, customAnswers));
    if (mode === "schedule_tour" && !selectedTourSlot) {
      errors.tourSlot = "Please select a tour date and time.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot || !mode) return;
    if (!validate()) return;

    setState("submitting");
    setError("");

    try {
      if (mode === "request_information") {
        const res = await fetch("/api/public/inquire", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            embedKey,
            firstName, lastName, email, phone,
            partnerFirst, partnerLast,
            eventType, eventDate,
            guestCount: guestCount ? parseInt(guestCount, 10) : null,
            estimatedBudget: budget ? parseFloat(budget.replace(/[$,]/g, "")) : null,
            message,
            sourceData: buildSourceData("request_information"),
            turnstileToken,
          }),
        });
        const data = await res.json();
        if (data.ok) setState("success_info");
        else {
          setError(INQUIRY_API_ERRORS[data.error] ?? data.message ?? "Something went wrong. Please try again.");
          setState("error");
        }
      } else if (mode === "schedule_tour" && selectedTourSlot && tourEmbedKey) {
        const qrCampaignId = new URLSearchParams(window.location.search).get("qr");
        const res = await fetch("/api/tours/book", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: tourEmbedKey,
            slotStart: selectedTourSlot.start,
            firstName, lastName,
            partnerName: [partnerFirst, partnerLast].filter(Boolean).join(" "),
            email, phone, eventType, eventDate,
            guestCount: guestCount ? parseInt(guestCount, 10) : null,
            notes: message,
            turnstileToken,
            qrCampaignId,
            sourceData: buildSourceData("schedule_tour"),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setTourConfirmation({
            scheduledAt: data.scheduledAt,
            duration: data.duration ?? 60,
            email,
            venueName: data.venueName ?? venue.name,
            venuePhone: data.venuePhone ?? venue.phone,
            addressLine1: data.addressLine1 ?? venue.addressLine1,
            city: data.city ?? venue.city,
            stateRegion: data.stateRegion ?? venue.stateRegion,
          });
          setState("success_tour");
        } else {
          setError(INQUIRY_API_ERRORS[data.error] ?? data.error ?? "Something went wrong. Please try again.");
          setState("error");
        }
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  if (state === "success_info") {
    return <RequestInformationConfirmation firstName={firstName} venueName={venue.name} primaryColor={primary} />;
  }
  if (state === "success_tour" && tourConfirmation) {
    return <ScheduleTourConfirmation firstName={firstName} confirmation={tourConfirmation} primaryColor={primary} />;
  }

  const showForm = mode !== null;
  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent";

  return (
    <div className="min-h-screen" style={{ backgroundColor: `${primary}08` }}>
      <div className="py-8 px-4 text-center" style={{ backgroundColor: primary }}>
        {venue.logoUrl && (
          <img src={venue.logoUrl} alt={venue.name} className="h-12 w-12 object-contain rounded-lg mx-auto mb-3" style={{ background: "rgba(255,255,255,0.15)" }} />
        )}
        <h1 className="text-white text-xl font-semibold">{venue.name}</h1>
        <p className="text-white/70 text-sm mt-1">Inquiry Form</p>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <ModeSelector mode={mode} onSelect={setMode} primary={primary} tourEnabled={tourSchedulingEnabled} />

        {!showForm && tourSchedulingEnabled && (
          <p className="text-center text-sm text-gray-500">Choose how you&apos;d like to connect with us.</p>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
            <input type="text" name="website_url" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" />

            {mode === "schedule_tour" && tourEmbedKey && (
              <div className="space-y-4 border-b border-gray-100 pb-5">
                <p className="text-sm font-semibold text-gray-900">Select your tour</p>
                {loadingTourSlots ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                ) : (
                  <AvailabilityCalendar
                    availableDates={tourAvailableDates}
                    selectedDate={selectedTourDate}
                    onSelect={(d) => { setSelectedTourDate(d); setSelectedTourSlot(null); }}
                    month={tourMonth}
                    year={tourYear}
                    onMonthChange={(m, y) => { setTourMonth(m); setTourYear(y); setSelectedTourDate(null); setSelectedTourSlot(null); }}
                    primary={primary}
                  />
                )}
                {selectedTourDate && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {tourSlotsForDate.map((slot) => {
                      const isSel = selectedTourSlot?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedTourSlot(slot)}
                          className="rounded-lg border py-2.5 text-sm font-medium"
                          style={isSel ? { background: primary, borderColor: primary, color: "white" } : { borderColor: "#DED6CA" }}
                        >
                          <Clock className="h-3.5 w-3.5 inline mr-1 opacity-60" />
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
                {fieldErrors.tourSlot && <p className="text-xs text-red-600">{fieldErrors.tourSlot}</p>}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">First name *</label>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} style={{ "--tw-ring-color": primary } as React.CSSProperties} />
                {fieldErrors.firstName && <p className="text-xs text-red-600">{fieldErrors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Last name *</label>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                {fieldErrors.lastName && <p className="text-xs text-red-600">{fieldErrors.lastName}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
              </div>
              {fields.phone !== "hidden" && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{fieldLabel("Phone", fields.phone)}</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
                  {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone}</p>}
                </div>
              )}
            </div>

            {fields.partner !== "hidden" && (
              <div className="border-t border-gray-100 pt-4 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fieldLabel("Partner / Co-host", fields.partner)}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input placeholder="Partner first name" value={partnerFirst} onChange={(e) => setPartnerFirst(e.target.value)} className={inputClass} />
                  <input placeholder="Partner last name" value={partnerLast} onChange={(e) => setPartnerLast(e.target.value)} className={inputClass} />
                </div>
                {fieldErrors.partner && <p className="text-xs text-red-600">{fieldErrors.partner}</p>}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Event type *</label>
                <select required value={eventType} onChange={(e) => setEventType(e.target.value)} className={`${inputClass} bg-white`}>
                  <option value="">Select event type</option>
                  {eventTypeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {fieldErrors.eventType && <p className="text-xs text-red-600">{fieldErrors.eventType}</p>}
              </div>

              {fields.preferred_event_date !== "hidden" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {fieldLabel("Preferred event date", fields.preferred_event_date)}
                  </label>
                  {inquiryEventDateMode === "choose_available" ? (
                    <div className="rounded-lg border border-gray-200 p-4">
                      {loadingEventDates ? (
                        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : (
                        <AvailabilityCalendar
                          availableDates={availableEventDates}
                          selectedDate={eventDate || null}
                          onSelect={setEventDate}
                          month={eventMonth}
                          year={eventYear}
                          onMonthChange={(m, y) => { setEventMonth(m); setEventYear(y); }}
                          primary={primary}
                        />
                      )}
                    </div>
                  ) : (
                    <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} />
                  )}
                  {fieldErrors.eventDate && <p className="text-xs text-red-600">{fieldErrors.eventDate}</p>}
                </div>
              )}

              {fields.guest_count !== "hidden" && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{fieldLabel("Guest count", fields.guest_count)}</label>
                  <input type="number" min="1" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} className={inputClass} />
                  {fieldErrors.guestCount && <p className="text-xs text-red-600">{fieldErrors.guestCount}</p>}
                </div>
              )}
              {fields.estimated_budget !== "hidden" && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{fieldLabel("Estimated budget", fields.estimated_budget)}</label>
                  <input value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass} />
                  {fieldErrors.budget && <p className="text-xs text-red-600">{fieldErrors.budget}</p>}
                </div>
              )}
            </div>

            {fields.event_details !== "hidden" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{fieldLabel("Tell us about your event", fields.event_details)}</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={`${inputClass} resize-none`} />
                {fieldErrors.message && <p className="text-xs text-red-600">{fieldErrors.message}</p>}
              </div>
            )}

            {customQuestions.map((q) => (
              <CustomQuestionField
                key={q.id}
                q={q}
                value={customAnswers[q.id] ?? (q.questionType === "multiple_select" ? [] : "")}
                onChange={(v) => setCustomAnswers((prev) => ({ ...prev, [q.id]: v }))}
                error={fieldErrors[q.id]}
              />
            ))}

            {(state === "error" || error) && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div className="flex justify-center">
              <TurnstileWidget onToken={setTurnstileToken} />
            </div>

            <button
              type="submit"
              disabled={state === "submitting"}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primary }}
            >
              {state === "submitting"
                ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                : mode === "schedule_tour" ? "Confirm Tour" : "Send Inquiry"}
            </button>

            <p className="text-center text-xs text-gray-400">Your information is used only to respond to your inquiry.</p>
          </form>
        )}
      </div>
    </div>
  );
}
