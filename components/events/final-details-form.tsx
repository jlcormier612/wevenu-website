"use client";

/**
 * FinalDetailsForm — the event questionnaire's coordinator-facing view:
 * apply a template, send the link, watch its status, view/edit the
 * couple's answers, reopen if they need to change something after
 * submitting.
 */

import * as React from "react";

import { CheckCircle, Copy, ExternalLink, Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import {
  applyQuestionnaireTemplateAction, reopenQuestionnaireAction,
  saveQuestionnaireAction, sendQuestionnaireAction,
} from "@/app/(app)/events/[id]/questionnaire-actions";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Badge } from "@/components/ui/badge";
import type { WaitingOn } from "@/components/business-assets/waiting-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Questionnaire, QuestionnaireActivity } from "@/lib/events/questionnaire";
import { CONFIGURABLE_FIELDS, type ConfigurableField } from "@/lib/events/questionnaire-constants";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import type { QuestionnaireTemplate } from "@/lib/questionnaire-templates/service";

type QFields = Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt" | "templateId" | "includedFields" | "requiredFields">>;

const FIELD_KEY_TO_QFIELD: Record<ConfigurableField, keyof QFields> = {
  meal_notes: "mealNotes", processional_song: "processionalSong", recessional_song: "recessionalSong",
  first_dance_song: "firstDanceSong", parent_dances: "parentDances", special_requests: "specialRequests",
};

// "reviewed" is a real value in the status column but no code path ever
// sets it (BA2 finding) — treated identically to "submitted" here, same as
// every other real consumer in this codebase already does.
const QUESTIONNAIRE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", submitted: "Submitted", reviewed: "Submitted",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">{children}</p>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-heading">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
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
  venueName,
  templates,
  activities,
}: {
  eventId: string;
  initial: Questionnaire | null;
  coupleEmail?: string | null;
  coupleName?: string | null;
  eventName?: string | null;
  venueName?: string;
  templates: QuestionnaireTemplate[];
  activities: QuestionnaireActivity[];
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
  // Work Package D5D — optimistic concurrency token: the row's own
  // updated_at, refreshed after every successful save so the *next* save
  // still detects a real conflict rather than false-positiving against
  // its own prior write.
  const [expectedUpdatedAt, setExpectedUpdatedAt] = React.useState<string | undefined>(initial?.updatedAt);
  const [saving, startSave] = React.useTransition();
  const [submitting, startSubmit] = React.useTransition();
  const [reopening, startReopen] = React.useTransition();
  const [applyingTemplate, startApplyTemplate] = React.useTransition();
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const [formUrl, setFormUrl] = React.useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const isSubmitted = initial?.status === "submitted" || initial?.status === "reviewed";
  const requiredFields = initial?.requiredFields ?? [];
  const includedFields = initial?.includedFields ?? [...CONFIGURABLE_FIELDS];
  const canApplyTemplate = !initial || initial.status === "draft";

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const currentFormUrl = formUrl ?? (initial?.accessKey ? `${appUrl}/questionnaire/${initial.accessKey}` : null);

  function handleApplyTemplate() {
    if (!selectedTemplateId) return;
    startApplyTemplate(async () => {
      const result = await applyQuestionnaireTemplateAction(selectedTemplateId, eventId);
      if (result.ok) toast.success("Template applied.");
      else toast.error(result.message ?? "Could not apply template.");
    });
  }

  // Work Package D5E — unified Share experience. sendQuestionnaireAction
  // itself already tells first-send from resend apart (lib/events/questionnaire.ts
  // sendQuestionnaireToCouple's isResend check) — this dialog is shown for
  // both cases with the same trigger, matching the couple's own single
  // working questionnaire either way.
  const shareRecipient = coupleName ? { name: coupleName, contact: coupleEmail ?? null, relationshipLabel: "Client" } : null;
  const shareMergeData = buildMergeData({ venueName: venueName ?? "Your venue", clientName: coupleName ?? "", coordinatorName: venueName ?? "", eventDate: null, eventName: eventName ?? "" });
  const shareDefaultMessage = mergeContent(
    "Your final details form for {{event_name}} is ready! Please take a few minutes to fill in your guest count, song selections, meal preferences, and any special requests.",
    shareMergeData,
  );
  async function handleShareSend(message: string) {
    if (!coupleEmail) return { ok: false, message: "Add their email to the client record first." };
    const result = await sendQuestionnaireAction(eventId, coupleEmail, coupleName ?? "there", eventName ?? "your event", undefined, message);
    if (result.ok) {
      toast.success(initial?.sentAt ? "Questionnaire resent." : "Questionnaire sent.");
      if (result.formUrl) setFormUrl(result.formUrl);
    }
    return result;
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
      const result = await saveQuestionnaireAction(eventId, fields, false, { expectedUpdatedAt });
      if (result.ok) { toast.success("Final details saved."); if (result.updatedAt) setExpectedUpdatedAt(result.updatedAt); }
      else if (result.reason === "stale") toast.error("The couple updated this form while you were editing. Refresh the page to see their latest answers before saving.");
      else toast.error(result.message ?? "Could not save.");
    });
  }

  function handleSubmit() {
    // Work Package D5/D5D — client-side echo of the server's own dynamic
    // required-field rule (lib/events/questionnaire.ts findMissingRequiredFields);
    // the server enforces this regardless, this just avoids a round-trip.
    const missing: string[] = [];
    if (fields.finalGuestCount == null) missing.push("Final guest count");
    if (!fields.emergencyContactName?.trim()) missing.push("Emergency contact name");
    if (!fields.emergencyContactPhone?.trim()) missing.push("Emergency contact phone");
    for (const key of requiredFields) {
      const qField = FIELD_KEY_TO_QFIELD[key as ConfigurableField];
      if (qField && !String(fields[qField] ?? "").trim()) missing.push(key.replace(/_/g, " "));
    }
    if (missing.length > 0) {
      toast.error(`Add these before submitting: ${missing.join(", ")}.`);
      return;
    }
    if (!confirm("Mark these final details as submitted? This signals that planning is complete.")) return;
    startSubmit(async () => {
      const result = await saveQuestionnaireAction(eventId, fields, true, { requiredFields, expectedUpdatedAt });
      if (result.ok) { toast.success("Final details submitted. Planning Progress updated."); if (result.updatedAt) setExpectedUpdatedAt(result.updatedAt); }
      else if (result.reason === "stale") toast.error("The couple updated this form while you were editing. Refresh the page to see their latest answers before submitting.");
      else toast.error(result.message ?? "Could not submit.");
    });
  }

  function handleReopen() {
    if (!confirm("Reopen this questionnaire so the couple can make changes? It'll return to \"Sent\" until they resubmit.")) return;
    startReopen(async () => {
      const result = await reopenQuestionnaireAction(eventId);
      if (result.ok) toast.success("Reopened for editing.");
      else toast.error(result.message ?? "Could not reopen.");
    });
  }

  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <BusinessAssetHeader
          compact
          whatIsThis="Questionnaire"
          title="Final Details"
          status={<Badge variant="success">{QUESTIONNAIRE_STATUS_LABEL[initial?.status ?? "submitted"]}</Badge>}
          waitingOn="completed"
          lastUpdated={initial?.updatedAt ? new Date(initial.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          relationship={eventName ? { name: eventName } : null}
          primaryAction={
            <Button type="button" size="sm" variant="outline" onClick={handleReopen} disabled={reopening}>
              {reopening ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Reopening…</> : <><RotateCcw className="mr-1 h-3.5 w-3.5" />Reopen for editing</>}
            </Button>
          }
        />
        <div className="flex items-center gap-2 rounded-sm border border-success/30 bg-success/5 px-4 py-3">
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
        {activities.length > 0 && (
          <div className="pt-2">
            <SectionHeader>Activity</SectionHeader>
            <div className="pt-2"><ActivityTimeline activities={activities} /></div>
          </div>
        )}
      </div>
    );
  }

  const waitingOn: WaitingOn = !initial?.sentAt ? "venue" : initial.status === "submitted" ? "completed" : "client";
  const statusSentence = !initial?.sentAt ? "Not yet sent to the client."
    : initial.openedAt ? `Opened${initial.status === "submitted" ? " and submitted" : " — awaiting submission"}.`
    : "Sent — waiting for the client to open it.";

  return (
    <div className="space-y-5">
      <BusinessAssetHeader
        compact
        whatIsThis="Questionnaire"
        title="Final Details"
        status={<Badge variant={initial?.status === "submitted" ? "success" : initial?.sentAt ? "default" : "muted"}>{QUESTIONNAIRE_STATUS_LABEL[initial?.status ?? "draft"]}</Badge>}
        waitingOn={waitingOn}
        lastUpdated={initial?.updatedAt ? new Date(initial.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        relationship={eventName ? { name: eventName } : null}
        primaryAction={coupleEmail && initial?.status !== "submitted" && initial?.status !== "reviewed" && (
          <ShareDialog
            trigger={<Button type="button" size="sm"><Send className="mr-1 h-3.5 w-3.5" />{initial?.sentAt ? "Resend" : "Send to client"}</Button>}
            title={initial?.sentAt ? "Resend Questionnaire" : "Send Questionnaire"}
            recipient={shareRecipient}
            whatHappensNext="They'll complete the questionnaire."
            defaultMessage={shareDefaultMessage}
            sendLabel={initial?.sentAt ? "Resend" : "Send"}
            onSend={handleShareSend}
          />
        )}
      />

      {/* Status + Send banner */}
      <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{statusSentence}</p>
          <a href={`/events/${eventId}/questionnaire-preview`} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Button type="button" variant="ghost" size="sm">Preview as client</Button>
          </a>
        </div>
        {!coupleEmail && (
          <p className="text-xs text-muted-foreground">Add their email to the client record to send the questionnaire link.</p>
        )}
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
      </div>

      {/* Work Package D5D — apply a template to configure which optional
          questions this event's couple sees/must answer. Only while still
          a draft (not yet sent) — a template changing what's required out
          from under a couple mid-form would be confusing, not helpful. */}
      {canApplyTemplate && templates.length > 0 && (
        <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-heading">
            {initial?.templateId ? "Questionnaire template applied" : "Use a template? (optional)"}
          </p>
          <div className="flex items-center gap-2">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} items={templates.map((t) => ({ value: t.id, label: t.name }))}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choose a template…" /></SelectTrigger>
              <SelectContent>{templates.filter((t) => !t.isArchived).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={handleApplyTemplate} disabled={!selectedTemplateId || applyingTemplate}>
              {applyingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </div>
      )}

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
        <Field label="Final guest count" required>
          <Input type="number" min="1" value={fields.finalGuestCount ?? ""}
            onChange={(e) => set("finalGuestCount", e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="175" className="w-32" />
        </Field>
      </div>
      <Field label="Meal notes" required={requiredFields.includes("meal_notes")}
        hint={!includedFields.includes("meal_notes") ? "Not asked in the couple's form." : "Entrée counts, dietary requirements, children's meals, etc."}>
        <Textarea value={fields.mealNotes ?? ""} onChange={(e) => set("mealNotes", e.target.value)}
          placeholder="Chicken: 85 · Fish: 45 · Vegan: 12 · Children's: 8…" rows={3} />
      </Field>

      <Separator />
      {/* Music */}
      <SectionHeader>Music & programme</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Processional song" required={requiredFields.includes("processional_song")}
          hint={!includedFields.includes("processional_song") ? "Not asked in the couple's form." : undefined}>
          <Input value={fields.processionalSong ?? ""}
            onChange={(e) => set("processionalSong", e.target.value)} placeholder="Canon in D — Pachelbel" />
        </Field>
        <Field label="Recessional song" required={requiredFields.includes("recessional_song")}
          hint={!includedFields.includes("recessional_song") ? "Not asked in the couple's form." : undefined}>
          <Input value={fields.recessionalSong ?? ""}
            onChange={(e) => set("recessionalSong", e.target.value)} placeholder="Signed, Sealed, Delivered" />
        </Field>
        <Field label="First dance song" required={requiredFields.includes("first_dance_song")}
          hint={!includedFields.includes("first_dance_song") ? "Not asked in the couple's form." : undefined}>
          <Input value={fields.firstDanceSong ?? ""}
            onChange={(e) => set("firstDanceSong", e.target.value)} placeholder="At Last — Etta James" />
        </Field>
        <Field label="Parent dances" required={requiredFields.includes("parent_dances")}
          hint={!includedFields.includes("parent_dances") ? "Not asked in the couple's form." : "Optional — mother/father dances"}>
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
        <Field label="Emergency contact (day-of)" required>
          <Input value={fields.emergencyContactName ?? ""}
            onChange={(e) => set("emergencyContactName", e.target.value)} placeholder="Emily Carter" />
        </Field>
        <Field label="Emergency phone" required>
          <Input type="tel" value={fields.emergencyContactPhone ?? ""}
            onChange={(e) => set("emergencyContactPhone", e.target.value)} placeholder="(615) 555-0100" />
        </Field>
      </div>

      <Separator />
      {/* Special requests */}
      <SectionHeader>Special requests</SectionHeader>
      <Field label="Anything else the team should know" required={requiredFields.includes("special_requests")}
        hint={!includedFields.includes("special_requests") ? "Not asked in the couple's form." : undefined}>
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

      {activities.length > 0 && (
        <div className="pt-2">
          <SectionHeader>Activity</SectionHeader>
          <div className="pt-2"><ActivityTimeline activities={activities} /></div>
        </div>
      )}
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
    <div className="rounded-sm border border-border bg-card p-4">
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
