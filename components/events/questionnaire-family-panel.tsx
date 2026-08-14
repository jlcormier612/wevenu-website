"use client";

/**
 * Questionnaire Family — coordinator view on the booking workspace.
 * Three customer-facing forms: Client Planning, Final Details, Post-Event Feedback.
 */

import * as React from "react";

import { CheckCircle, Copy, ExternalLink, Loader2, RotateCcw, Send, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import {
  applyQuestionnaireTemplateAction,
  reopenQuestionnaireAction,
  saveQuestionnaireAction,
  sendQuestionnaireAction,
  withdrawQuestionnaireAccessAction,
} from "@/app/(app)/events/[id]/questionnaire-actions";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Badge } from "@/components/ui/badge";
import type { WaitingOn } from "@/components/business-assets/waiting-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Questionnaire, QuestionnaireActivity } from "@/lib/events/questionnaire";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import {
  getQuestionnaireMasterByKind,
  kindLabel,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";
import { resolveQuestionnaireFields } from "@/lib/questionnaire-family/resolve";
import type { QuestionnaireTemplate } from "@/lib/questionnaire-templates/service";

const KINDS: QuestionnaireKind[] = ["client_planning", "final_details", "post_event_feedback"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", submitted: "Submitted", reviewed: "Submitted",
};

const SHARE_BODY: Record<QuestionnaireKind, string> = {
  client_planning: "Your Client Planning Questionnaire for {{event_name}} is ready. We already have your booking basics — this helps us learn more about your plans.",
  final_details: "Your Final Details form for {{event_name}} is ready. Please confirm what's still correct and fill in anything that's still open.",
  post_event_feedback: "Thank you for celebrating with us. When you have a moment, we'd love your Post-Event Feedback about how everything felt.",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-heading">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function AnswerRows({ q }: { q: Questionnaire }) {
  const family = q.additional?.family ?? {};
  const fields = resolveQuestionnaireFields({
    kind: q.kind,
    includedFields: q.includedFields,
    requiredFields: q.requiredFields,
    customFields: q.customFields,
    masterOverrides: q.masterOverrides,
    fieldOrder: q.fieldOrder,
  });
  const columns: Record<string, string | number | null | undefined> = {
    meal_notes: q.mealNotes,
    processional_song: q.processionalSong,
    recessional_song: q.recessionalSong,
    first_dance_song: q.firstDanceSong,
    parent_dances: q.parentDances,
    emergency_contact_name: q.emergencyContactName,
    emergency_contact_phone: q.emergencyContactPhone,
    special_requests: q.specialRequests,
    vendor_notes: q.vendorNotes,
    ceremony_start_time: q.ceremonyStartTime,
    reception_start_time: q.receptionStartTime,
    ceremony_location: q.ceremonyLocation,
    reception_location: q.receptionLocation,
    final_guest_count: q.finalGuestCount,
  };
  const shown = new Set<string>();

  return (
    <div className="rounded-sm border border-border bg-card p-4 space-y-0">
      {q.kind === "final_details" && q.finalGuestCount != null && (
        <div className="flex gap-4 py-2 border-b border-border">
          <span className="w-52 shrink-0 text-xs text-muted-foreground">Guest count</span>
          <span className="text-sm text-foreground">{q.finalGuestCount}</span>
        </div>
      )}
      {fields.map((f) => {
        let value: string | number | null | undefined;
        if (f.destination === "column" && f.column) value = columns[f.column];
        else if (f.destination === "event_guest_count") value = q.finalGuestCount;
        else if (f.destination === "family") value = family[f.id];
        else return null;
        if (value == null || value === "") return null;
        shown.add(f.id);
        return (
          <div key={f.id} className="flex gap-4 py-2 border-b border-border last:border-0">
            <span className="w-52 shrink-0 text-xs text-muted-foreground">{f.label}</span>
            <span className="text-sm text-foreground whitespace-pre-wrap">{String(value)}</span>
          </div>
        );
      })}
      {Object.entries(family).filter(([k]) => !shown.has(k)).map(([k, v]) => (
        v ? (
          <div key={k} className="flex gap-4 py-2 border-b border-border last:border-0">
            <span className="w-52 shrink-0 text-xs text-muted-foreground">{k.replace(/_/g, " ")}</span>
            <span className="text-sm text-foreground whitespace-pre-wrap">{v}</span>
          </div>
        ) : null
      ))}
    </div>
  );
}

function KindPanel({
  kind,
  eventId,
  initial,
  templates,
  activities,
  coupleEmail,
  coupleName,
  eventName,
  venueName,
}: {
  kind: QuestionnaireKind;
  eventId: string;
  initial: Questionnaire | null;
  templates: QuestionnaireTemplate[];
  activities: QuestionnaireActivity[];
  coupleEmail?: string | null;
  coupleName?: string | null;
  eventName?: string | null;
  venueName?: string;
}) {
  const master = getQuestionnaireMasterByKind(kind);
  const kindTemplates = templates.filter((t) => t.kind === kind && !t.isArchived);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [applying, startApply] = React.useTransition();
  const [reopening, startReopen] = React.useTransition();
  const [withdrawing, startWithdraw] = React.useTransition();
  const [saving, startSave] = React.useTransition();
  const [formUrl, setFormUrl] = React.useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = React.useState(initial?.updatedAt);
  const [notes, setNotes] = React.useState({
    mealNotes: initial?.mealNotes ?? "",
    emergencyContactName: initial?.emergencyContactName ?? "",
    emergencyContactPhone: initial?.emergencyContactPhone ?? "",
    specialRequests: initial?.specialRequests ?? "",
    vendorNotes: initial?.vendorNotes ?? "",
    finalGuestCount: initial?.finalGuestCount ?? undefined as number | undefined,
    ceremonyStartTime: initial?.ceremonyStartTime ?? "",
    receptionStartTime: initial?.receptionStartTime ?? "",
  });

  const isSubmitted = initial?.status === "submitted" || initial?.status === "reviewed";
  /** Withdraw is sent → draft only; submitted forms use Reopen. */
  const canWithdrawAccess = initial?.status === "sent";
  const canApplyTemplate = !initial || initial.status === "draft";
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const currentFormUrl = formUrl ?? (initial?.accessKey ? `${appUrl}/questionnaire/${initial.accessKey}` : null);
  const waitingOn: WaitingOn = !initial?.sentAt || initial.status === "draft" ? "venue" : isSubmitted ? "completed" : "client";
  const sentLabel = initial?.sentAt
    ? new Date(initial.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const shareRecipient = coupleName ? { name: coupleName, contact: coupleEmail ?? null, relationshipLabel: "Client" } : null;
  const shareMergeData = buildMergeData({ venueName: venueName ?? "Your venue", clientName: coupleName ?? "", coordinatorName: venueName ?? "", eventDate: null, eventName: eventName ?? "" });
  const shareDefaultMessage = mergeContent(SHARE_BODY[kind], shareMergeData);
  const sendConsequence = initial?.status === "sent" || isSubmitted
    ? "Emails a fresh link to the same form. Their previous link still works. This does not delete answers."
    : "Emails the client a secure link to complete this form. Until then only your venue can see this draft.";

  async function handleShareSend(message: string) {
    if (!coupleEmail) return { ok: false, message: "Add their email to the client record first." };
    const result = await sendQuestionnaireAction(eventId, coupleEmail, coupleName ?? "there", eventName ?? "your event", undefined, message, kind);
    if (result.ok) {
      toast.success(initial?.status === "sent" || isSubmitted ? "Questionnaire resent." : "Questionnaire sent.");
      if (result.formUrl) setFormUrl(result.formUrl);
    }
    return result;
  }

  function handleWithdraw() {
    if (!confirm(
      "Stop client access to this form?\n\n"
      + "The public link will stop working. Answers already saved stay on the event.\n\n"
      + "This does not recall or delete emails already delivered.",
    )) return;
    startWithdraw(async () => {
      const r = await withdrawQuestionnaireAccessAction(eventId, kind);
      if (r.ok) toast.success("Client access stopped. The form is a draft again.");
      else toast.error(r.message ?? "Could not stop access.");
    });
  }

  if (isSubmitted && initial) {
    return (
      <div className="space-y-4">
        <BusinessAssetHeader
          compact
          whatIsThis="Planning form"
          title={kindLabel(kind)}
          status={<Badge variant="success">{STATUS_LABEL[initial.status]}</Badge>}
          waitingOn="completed"
          lastUpdated={initial.updatedAt ? new Date(initial.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          relationship={eventName ? { name: eventName } : null}
          primaryAction={
            <Button type="button" size="sm" variant="outline" onClick={() => {
              if (!confirm("Reopen so the couple can make changes? This sets the form back to Sent so they can use the link again.")) return;
              startReopen(async () => {
                const r = await reopenQuestionnaireAction(eventId, kind);
                if (r.ok) toast.success("Reopened.");
                else toast.error(r.message ?? "Could not reopen.");
              });
            }} disabled={reopening}>
              {reopening ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
              Reopen
            </Button>
          }
        />
        {sentLabel && <p className="text-xs text-muted-foreground">Last sent {sentLabel}</p>}
        <AnswerRows q={initial} />
        {activities.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Activity</p>
            <ActivityTimeline activities={activities} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BusinessAssetHeader
        compact
        whatIsThis="Planning form"
        title={kindLabel(kind)}
        status={<Badge variant={initial?.status === "sent" ? "default" : "muted"}>{STATUS_LABEL[initial?.status ?? "draft"]}</Badge>}
        waitingOn={waitingOn}
        lastUpdated={initial?.updatedAt ? new Date(initial.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        relationship={eventName ? { name: eventName } : null}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            {coupleEmail && (
              <ShareDialog
                trigger={(
                  <Button type="button" size="sm">
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {initial?.status === "sent" ? "Resend Questionnaire" : LIBRARY_LABELS.sendQuestionnaire}
                  </Button>
                )}
                title={initial?.status === "sent" ? `Resend ${kindLabel(kind)}` : LIBRARY_LABELS.sendQuestionnaire}
                recipient={shareRecipient}
                whatHappensNext={sendConsequence}
                defaultMessage={shareDefaultMessage}
                sendLabel={initial?.status === "sent" ? "Resend Questionnaire" : LIBRARY_LABELS.sendQuestionnaire}
                onSend={handleShareSend}
              />
            )}
            {canWithdrawAccess && (
              <Button type="button" size="sm" variant="outline" onClick={handleWithdraw} disabled={withdrawing}>
                {withdrawing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="mr-1 h-3.5 w-3.5" />}
                {LIBRARY_LABELS.stopClientAccess}
              </Button>
            )}
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">{master.description}</p>

      <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {initial?.status === "draft" || !initial
              ? "Draft — not visible to the client until you send."
              : initial.openedAt
                ? `Sent ${sentLabel ?? ""} — opened, awaiting submission.`
                : `Sent ${sentLabel ?? ""} — waiting for the client to open it.`}
          </p>
          <a href={`/events/${eventId}/questionnaire-preview?kind=${kind}`} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="ghost" size="sm">Preview as client</Button>
          </a>
        </div>
        {(currentFormUrl && (initial?.sentAt || formUrl)) && (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted border border-border px-3 py-1.5 text-xs font-mono truncate">{currentFormUrl}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => {
              if (!currentFormUrl) return;
              navigator.clipboard.writeText(currentFormUrl);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2000);
            }}>
              {copiedUrl ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <a href={currentFormUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
            </a>
          </div>
        )}
      </div>

      {canApplyTemplate && kindTemplates.length > 0 && (
        <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-heading">{initial?.templateId ? "Library form applied (draft only)" : "Apply a library form? (optional)"}</p>
          <p className="text-xs text-muted-foreground">Applies field configuration to this draft. Does not send anything to the client.</p>
          <div className="flex items-center gap-2">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} items={kindTemplates.map((t) => ({ value: t.id, label: t.name }))}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{kindTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" disabled={!selectedTemplateId || applying}
              onClick={() => {
                const tmpl = kindTemplates.find((t) => t.id === selectedTemplateId);
                if (!confirm(
                  `Create draft questionnaire from "${tmpl?.name ?? "this template"}"?\n\n`
                  + "This updates the draft form on this event only. It does not email the client.",
                )) return;
                startApply(async () => {
                  const r = await applyQuestionnaireTemplateAction(selectedTemplateId, eventId);
                  if (r.ok) toast.success("Draft questionnaire created.");
                  else toast.error(r.message ?? "Could not apply.");
                });
              }}>
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : LIBRARY_LABELS.createQuestionnaire}
            </Button>
          </div>
        </div>
      )}

      {/* Coordinator can still edit operational Final Details columns. */}
      {kind === "final_details" && (
        <div className="space-y-4">
          <Field label="Guest count" required>
            <Input type="number" min={1} className="w-32" value={notes.finalGuestCount ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, finalGuestCount: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ceremony start">
              <Input type="time" value={notes.ceremonyStartTime} onChange={(e) => setNotes((n) => ({ ...n, ceremonyStartTime: e.target.value }))} />
            </Field>
            <Field label="Reception start">
              <Input type="time" value={notes.receptionStartTime} onChange={(e) => setNotes((n) => ({ ...n, receptionStartTime: e.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day-of emergency contact" required>
              <Input value={notes.emergencyContactName} onChange={(e) => setNotes((n) => ({ ...n, emergencyContactName: e.target.value }))} />
            </Field>
            <Field label="Emergency phone" required>
              <Input value={notes.emergencyContactPhone} onChange={(e) => setNotes((n) => ({ ...n, emergencyContactPhone: e.target.value }))} />
            </Field>
          </div>
          <Field label="Meal / dietary notes">
            <Textarea rows={3} value={notes.mealNotes} onChange={(e) => setNotes((n) => ({ ...n, mealNotes: e.target.value }))} />
          </Field>
          <Field label="Vendor arrival notes">
            <Textarea rows={2} value={notes.vendorNotes} onChange={(e) => setNotes((n) => ({ ...n, vendorNotes: e.target.value }))} />
          </Field>
          <Field label="Anything else">
            <Textarea rows={3} value={notes.specialRequests} onChange={(e) => setNotes((n) => ({ ...n, specialRequests: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => startSave(async () => {
              const r = await saveQuestionnaireAction(eventId, notes, false, { expectedUpdatedAt, kind });
              if (r.ok) { toast.success("Saved."); if (r.updatedAt) setExpectedUpdatedAt(r.updatedAt); }
              else if (r.reason === "stale") toast.error("Someone else updated this form. Refresh first.");
              else toast.error(r.message ?? "Could not save.");
            })}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Save draft
            </Button>
            <Button type="button" disabled={saving} onClick={() => {
              if (!confirm("Mark Final Details as submitted?")) return;
              startSave(async () => {
                const r = await saveQuestionnaireAction(eventId, notes, true, {
                  expectedUpdatedAt, kind, requiredFields: initial?.requiredFields,
                });
                if (r.ok) toast.success("Marked submitted.");
                else if (r.reason === "stale") toast.error("Someone else updated this form. Refresh first.");
                else toast.error(r.message ?? "Could not submit.");
              });
            }}>
              Mark as submitted
            </Button>
          </div>
        </div>
      )}

      {initial && (initial.status === "sent" || initial.additional?.family) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Answers so far</p>
          <AnswerRows q={initial} />
        </div>
      )}

      {activities.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Activity</p>
          <ActivityTimeline activities={activities} />
        </div>
      )}
    </div>
  );
}

export function QuestionnaireFamilyPanel({
  eventId,
  questionnaires,
  templates,
  activitiesById,
  coupleEmail,
  coupleName,
  eventName,
  venueName,
}: {
  eventId: string;
  questionnaires: Questionnaire[];
  templates: QuestionnaireTemplate[];
  activitiesById: Record<string, QuestionnaireActivity[]>;
  coupleEmail?: string | null;
  coupleName?: string | null;
  eventName?: string | null;
  venueName?: string;
}) {
  const [active, setActive] = React.useState<QuestionnaireKind>("client_planning");
  const byKind = Object.fromEntries(questionnaires.map((q) => [q.kind, q])) as Partial<Record<QuestionnaireKind, Questionnaire>>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const q = byKind[k];
          const status = q?.status ?? "draft";
          const selected = active === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              className={`rounded-full border px-3 py-1.5 text-xs ${selected ? "border-primary bg-primary/10 font-medium" : "border-border"}`}
            >
              {kindLabel(k)}
              {status === "submitted" || status === "reviewed" ? " · Done" : status === "sent" ? " · Sent" : ""}
            </button>
          );
        })}
      </div>
      <KindPanel
        kind={active}
        eventId={eventId}
        initial={byKind[active] ?? null}
        templates={templates}
        activities={byKind[active] ? (activitiesById[byKind[active]!.id] ?? []) : []}
        coupleEmail={coupleEmail}
        coupleName={coupleName}
        eventName={eventName}
        venueName={venueName}
      />
    </div>
  );
}
