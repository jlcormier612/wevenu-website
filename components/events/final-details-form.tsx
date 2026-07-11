"use client";

/**
 * FinalDetailsForm — the event questionnaire.
 *
 * Coordinator fills this in before the event. Eventually (Sprint 34+)
 * this can be sent to the client as a public form for them to complete.
 * For Sprint 33: coordinator-facing only.
 */

import * as React from "react";

import { CheckCircle, Copy, ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { saveQuestionnaireAction, sendQuestionnaireAction } from "@/app/(app)/events/[id]/questionnaire-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Questionnaire } from "@/lib/events/questionnaire";

type QFields = Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt">>;

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">{children}</p>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-heading">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function FinalDetailsForm({
  eventId,
  initial,
  coupleEmail,
  coupleName,
  eventName,
}: {
  eventId: string;
  initial: Questionnaire | null;
  coupleEmail?: string | null;
  coupleName?: string | null;
  eventName?: string | null;
}) {
  const [fields, setFields] = React.useState<QFields>({
    ceremonyStartTime:    initial?.ceremonyStartTime    ?? "",
    receptionStartTime:   initial?.receptionStartTime   ?? "",
    ceremonyLocation:     initial?.ceremonyLocation     ?? "",
    receptionLocation:    initial?.receptionLocation    ?? "",
    finalGuestCount:      initial?.finalGuestCount      ?? undefined,
    mealNotes:            initial?.mealNotes            ?? "",
    processionalSong:     initial?.processionalSong     ?? "",
    recessionalSong:      initial?.recessionalSong      ?? "",
    firstDanceSong:       initial?.firstDanceSong       ?? "",
    parentDances:         initial?.parentDances         ?? "",
    emergencyContactName: initial?.emergencyContactName ?? "",
    emergencyContactPhone:initial?.emergencyContactPhone?? "",
    vendorNotes:          initial?.vendorNotes          ?? "",
    specialRequests:      initial?.specialRequests      ?? "",
  });
  const [saving, startSave] = React.useTransition();
  const [submitting, startSubmit] = React.useTransition();
  const [sending, startSend] = React.useTransition();
  const [formUrl, setFormUrl] = React.useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const isSubmitted = initial?.status === "submitted" || initial?.status === "reviewed";

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const currentFormUrl = formUrl ?? (initial?.accessKey ? `${appUrl}/questionnaire/${initial.accessKey}` : null);

  function handleSend() {
    if (!coupleEmail) return;
    startSend(async () => {
      const result = await sendQuestionnaireAction(eventId, coupleEmail, coupleName ?? "there", eventName ?? "your event");
      if (result.ok) {
        toast.success("Questionnaire link sent!");
        if (result.formUrl) setFormUrl(result.formUrl);
      } else toast.error(result.message ?? "Could not send.");
    });
  }

  function handleCopyUrl() {
    if (!currentFormUrl) return;
    navigator.clipboard.writeText(currentFormUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  const set = (key: keyof QFields, value: string | number | undefined) =>
    setFields((p) => ({ ...p, [key]: value }));

  function handleSave() {
    startSave(async () => {
      const result = await saveQuestionnaireAction(eventId, fields, false);
      if (result.ok) toast.success("Final details saved.");
      else toast.error(result.message ?? "Could not save.");
    });
  }

  function handleSubmit() {
    if (!confirm("Mark these final details as submitted? This signals that planning is complete.")) return;
    startSubmit(async () => {
      const result = await saveQuestionnaireAction(eventId, fields, true);
      if (result.ok) toast.success("Final details submitted. Planning Progress updated.");
      else toast.error(result.message ?? "Could not submit.");
    });
  }

  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-success shrink-0" />
          <div>
            <p className="text-sm font-medium text-heading">Final details submitted</p>
            {initial?.submittedAt && (
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(initial.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
        <QuestionnaireDisplay q={initial!} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Status + Send banner */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        {/* Status row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-heading">Questionnaire status</p>
            <p className="text-xs text-muted-foreground">
              {!initial?.sentAt ? "Not yet sent to the client."
                : initial.openedAt ? `Opened${initial.status === "submitted" ? " and submitted" : " — awaiting submission"}.`
                : "Sent — waiting for the client to open it."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {coupleEmail && initial?.status !== "submitted" && initial?.status !== "reviewed" && (
              <Button type="button" size="sm" onClick={handleSend} disabled={sending}>
                {sending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Sending…</> : <><Send className="mr-1 h-3.5 w-3.5" />Send to client</>}
              </Button>
            )}
          </div>
        </div>
        {/* Form URL (shown after sending or if already sent) */}
        {(currentFormUrl && (initial?.sentAt || formUrl)) && (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted border border-border px-3 py-1.5 text-xs font-mono truncate text-foreground">
              {currentFormUrl}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={handleCopyUrl}>
              {copiedUrl ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <a href={currentFormUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
            </a>
          </div>
        )}
        {!coupleEmail && (
          <p className="text-xs text-muted-foreground">Add their email to the client record to send the questionnaire link.</p>
        )}
      </div>

      {/* Logistics */}
      <SectionHeader>Day-of logistics</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ceremony start time">
          <Input type="time" value={fields.ceremonyStartTime ?? ""}
            onChange={(e) => set("ceremonyStartTime", e.target.value)} />
        </Field>
        <Field label="Reception start time">
          <Input type="time" value={fields.receptionStartTime ?? ""}
            onChange={(e) => set("receptionStartTime", e.target.value)} />
        </Field>
        <Field label="Ceremony location / room">
          <Input value={fields.ceremonyLocation ?? ""}
            onChange={(e) => set("ceremonyLocation", e.target.value)} placeholder="Garden Terrace, Chapel…" />
        </Field>
        <Field label="Reception location / room">
          <Input value={fields.receptionLocation ?? ""}
            onChange={(e) => set("receptionLocation", e.target.value)} placeholder="Ballroom, Main Hall…" />
        </Field>
      </div>

      <Separator />
      {/* Guest & meal details */}
      <SectionHeader>Guests & meals</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Final guest count">
          <Input type="number" min="1" value={fields.finalGuestCount ?? ""}
            onChange={(e) => set("finalGuestCount", e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="175" className="w-32" />
        </Field>
      </div>
      <Field label="Meal notes" hint="Entrée counts, dietary requirements, children's meals, etc.">
        <Textarea value={fields.mealNotes ?? ""} onChange={(e) => set("mealNotes", e.target.value)}
          placeholder="Chicken: 85 · Fish: 45 · Vegan: 12 · Children's: 8…" rows={3} />
      </Field>

      <Separator />
      {/* Music */}
      <SectionHeader>Music & programme</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Processional song">
          <Input value={fields.processionalSong ?? ""}
            onChange={(e) => set("processionalSong", e.target.value)} placeholder="Canon in D — Pachelbel" />
        </Field>
        <Field label="Recessional song">
          <Input value={fields.recessionalSong ?? ""}
            onChange={(e) => set("recessionalSong", e.target.value)} placeholder="Signed, Sealed, Delivered" />
        </Field>
        <Field label="First dance song">
          <Input value={fields.firstDanceSong ?? ""}
            onChange={(e) => set("firstDanceSong", e.target.value)} placeholder="At Last — Etta James" />
        </Field>
        <Field label="Parent dances" hint="Optional — mother/father dances">
          <Input value={fields.parentDances ?? ""}
            onChange={(e) => set("parentDances", e.target.value)} placeholder="My Girl · Wind Beneath My Wings" />
        </Field>
      </div>

      <Separator />
      {/* Vendors & emergency */}
      <SectionHeader>Vendors & emergency contact</SectionHeader>
      <Field label="Vendor arrival notes" hint="Any specific arrival time requirements or logistics notes for vendors.">
        <Textarea value={fields.vendorNotes ?? ""} onChange={(e) => set("vendorNotes", e.target.value)}
          placeholder="Florist: 10am. Band load-in: 2pm. Caterer: 3pm service entrance…" rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Emergency contact (day-of)">
          <Input value={fields.emergencyContactName ?? ""}
            onChange={(e) => set("emergencyContactName", e.target.value)} placeholder="Emily Carter" />
        </Field>
        <Field label="Emergency phone">
          <Input type="tel" value={fields.emergencyContactPhone ?? ""}
            onChange={(e) => set("emergencyContactPhone", e.target.value)} placeholder="(615) 555-0100" />
        </Field>
      </div>

      <Separator />
      {/* Special requests */}
      <SectionHeader>Special requests</SectionHeader>
      <Field label="Anything else the team should know">
        <Textarea value={fields.specialRequests ?? ""} onChange={(e) => set("specialRequests", e.target.value)}
          placeholder="Allergy alerts, accessibility needs, surprises, personal touches…" rows={4} />
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={handleSave} disabled={saving || submitting}>
          {saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save draft"}
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={saving || submitting}>
          {submitting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Submitting…</> : "Mark as submitted"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        Submitting marks this questionnaire complete in your Planning Progress checklist.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-4 py-2 border-b border-border last:border-0">
      <span className="w-44 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{String(value)}</span>
    </div>
  );
}

function QuestionnaireDisplay({ q }: { q: Questionnaire }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Row label="Ceremony time" value={q.ceremonyStartTime} />
      <Row label="Reception time" value={q.receptionStartTime} />
      <Row label="Ceremony room" value={q.ceremonyLocation} />
      <Row label="Reception room" value={q.receptionLocation} />
      <Row label="Final guest count" value={q.finalGuestCount} />
      <Row label="Meal notes" value={q.mealNotes} />
      <Row label="Processional song" value={q.processionalSong} />
      <Row label="Recessional song" value={q.recessionalSong} />
      <Row label="First dance" value={q.firstDanceSong} />
      <Row label="Parent dances" value={q.parentDances} />
      <Row label="Vendor notes" value={q.vendorNotes} />
      <Row label="Emergency contact" value={q.emergencyContactName} />
      <Row label="Emergency phone" value={q.emergencyContactPhone} />
      <Row label="Special requests" value={q.specialRequests} />
    </div>
  );
}
