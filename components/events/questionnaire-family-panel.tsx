"use client";

/**
 * Questionnaire Family — coordinator view on the booking workspace.
 * Select a prepared library template, preview as client, then Send now or Schedule send.
 * Templates are authored in Templates → Questionnaires & Feedback — not created here.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCircle, Copy, ExternalLink, Loader2, MessageSquareWarning, RotateCcw, Send, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import {
  applyQuestionnaireTemplateAction,
  cancelScheduledQuestionnaireSendAction,
  completeQuestionnaireAction,
  reopenQuestionnaireAction,
  requestQuestionnaireChangesAction,
  scheduleQuestionnaireSendAction,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Questionnaire, QuestionnaireActivity } from "@/lib/events/questionnaire";
import {
  isQuestionnaireNeedsVenueReview,
  QUESTIONNAIRE_STATUS_LABEL,
  questionnaireStatusLabel,
} from "@/lib/events/questionnaire-constants";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import {
  getQuestionnaireMasterByKind,
  kindLabel,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";
import { resolveQuestionnaireFields } from "@/lib/questionnaire-family/resolve";
import type { QuestionnaireTemplate } from "@/lib/questionnaire-templates/service";

const KINDS: QuestionnaireKind[] = ["client_planning", "final_details", "post_event_feedback"];

const STATUS_LABEL = QUESTIONNAIRE_STATUS_LABEL as Record<string, string>;

const SHARE_BODY: Record<QuestionnaireKind, string> = {
  client_planning: "Your Client Planning Questionnaire for {{event_name}} is ready. We already have your booking basics — this helps us learn more about your plans.",
  final_details: "Your Final Details form for {{event_name}} is ready. Please confirm what's still correct and fill in anything that's still open.",
  post_event_feedback: "Thank you for celebrating with us. When you have a moment, we'd love your Post-Event Feedback about how everything felt.",
};

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

function preferredTemplateId(kindTemplates: QuestionnaireTemplate[], draftTemplateId: string | null | undefined): string {
  if (draftTemplateId && kindTemplates.some((t) => t.id === draftTemplateId)) return draftTemplateId;
  if (kindTemplates.length === 1) return kindTemplates[0].id;
  const masterName = kindTemplates.find((t) => {
    const master = getQuestionnaireMasterByKind(t.kind);
    return t.name === master.name;
  });
  return masterName?.id ?? kindTemplates[0]?.id ?? "";
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
  onApplied,
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
  onApplied?: () => void;
}) {
  const master = getQuestionnaireMasterByKind(kind);
  const kindTemplates = templates.filter((t) => t.kind === kind && !t.isArchived);

  const [selectedTemplateId, setSelectedTemplateId] = React.useState(() =>
    preferredTemplateId(kindTemplates, initial?.templateId),
  );
  const [applying, startApply] = React.useTransition();
  const [reopening, startReopen] = React.useTransition();
  const [withdrawing, startWithdraw] = React.useTransition();
  const [requestingChanges, startRequestChanges] = React.useTransition();
  const [completing, startComplete] = React.useTransition();
  const [cancellingSchedule, startCancelSchedule] = React.useTransition();
  const [changeNote, setChangeNote] = React.useState("");
  const [showChangeForm, setShowChangeForm] = React.useState(false);
  const [formUrl, setFormUrl] = React.useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  React.useEffect(() => {
    setSelectedTemplateId(preferredTemplateId(kindTemplates, initial?.templateId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, initial?.templateId, kindTemplates.map((t) => t.id).join(",")]);

  const status = initial?.status ?? "draft";
  const needsReview = isQuestionnaireNeedsVenueReview(status);
  const isComplete = status === "complete";
  const isChangesRequested = status === "changes_requested";
  const isReviewSurface = needsReview || isComplete || isChangesRequested;
  const canWithdrawAccess = status === "sent" || status === "in_progress";
  const canApplyTemplate = !initial || status === "draft";
  const formPath = initial?.accessKey ? `/questionnaire/${initial.accessKey}` : null;
  const currentFormUrl = formUrl ?? formPath;
  const pendingSchedule = initial?.scheduledSendStatus === "scheduled" && initial.scheduledSendAt;

  function absoluteFormUrl() {
    if (!currentFormUrl) return "";
    if (/^https?:\/\//i.test(currentFormUrl)) return currentFormUrl;
    return `${window.location.origin}${currentFormUrl}`;
  }

  const waitingOn: WaitingOn =
    !initial?.sentAt || status === "draft" ? "venue"
    : isComplete ? "completed"
    : needsReview ? "venue"
    : isChangesRequested ? "client"
    : "client";
  const sentLabel = initial?.sentAt
    ? new Date(initial.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const shareRecipient = coupleName ? { name: coupleName, contact: coupleEmail ?? null, relationshipLabel: "Client" } : null;
  const shareMergeData = buildMergeData({ venueName: venueName ?? "Your venue", clientName: coupleName ?? "", coordinatorName: venueName ?? "", eventDate: null, eventName: eventName ?? "" });
  const shareDefaultMessage = mergeContent(SHARE_BODY[kind], shareMergeData);
  const sendConsequence = status === "sent" || status === "in_progress" || needsReview || isComplete || isChangesRequested
    ? "Emails a fresh link to the same form. Their previous link still works. This does not delete answers."
    : "Emails the client a secure link to complete this form. Until then only your venue can see this draft.";

  function applyTemplate(templateId: string, opts?: { silentIfSame?: boolean }) {
    if (!canApplyTemplate || !templateId) return;
    if (opts?.silentIfSame && initial?.templateId === templateId) {
      setSelectedTemplateId(templateId);
      return;
    }
    setSelectedTemplateId(templateId);
    startApply(async () => {
      const r = await applyQuestionnaireTemplateAction(templateId, eventId);
      if (r.ok) {
        toast.success("Library form applied to this draft.");
        onApplied?.();
      } else {
        toast.error(r.message ?? "Could not apply.");
      }
    });
  }

  async function handleShareSend(message: string) {
    if (!coupleEmail) return { ok: false, message: "Add their email to the client record first." };
    const result = await sendQuestionnaireAction(eventId, coupleEmail, coupleName ?? "there", eventName ?? "your event", undefined, message, kind);
    if (result.ok) {
      toast.success(initial?.sentAt ? "Questionnaire resent." : "Questionnaire sent.");
      if (result.formUrl) setFormUrl(result.formUrl);
    }
    return result;
  }

  async function handleSchedule(message: string, scheduledFor: string) {
    const result = await scheduleQuestionnaireSendAction(eventId, kind, scheduledFor, message);
    if (result.ok) {
      toast.success(
        result.scheduledFor
          ? `Scheduled for ${new Date(result.scheduledFor).toLocaleString()}.`
          : "Questionnaire send scheduled.",
      );
      // Do not refresh here — ShareDialog must paint the scheduled confirmation first.
      // Refresh when the sheet closes via onSent / Done.
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

  function handleRequestChanges() {
    startRequestChanges(async () => {
      const r = await requestQuestionnaireChangesAction(eventId, changeNote, kind);
      if (r.ok) {
        toast.success("Changes requested. The couple can edit and resubmit.");
        setShowChangeForm(false);
        setChangeNote("");
      } else toast.error(r.message ?? "Could not request changes.");
    });
  }

  if (isReviewSurface && initial) {
    const badgeVariant =
      isComplete ? "success"
      : isChangesRequested ? "warning"
      : "default";
    return (
      <div className="space-y-4" data-testid={`questionnaire-kind-panel-${kind}`}>
        <BusinessAssetHeader
          compact
          whatIsThis="Planning form"
          title={kindLabel(kind)}
          status={<Badge variant={badgeVariant}>{questionnaireStatusLabel(status)}</Badge>}
          waitingOn={waitingOn}
          lastUpdated={initial.updatedAt ? new Date(initial.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          relationship={eventName ? { name: eventName } : null}
          primaryAction={
            <div className="flex flex-wrap items-center gap-2">
              {needsReview && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowChangeForm((v) => !v)}
                    disabled={requestingChanges}
                  >
                    <MessageSquareWarning className="mr-1 h-3.5 w-3.5" />
                    Request Changes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={completing}
                    onClick={() => {
                      if (!confirm("Mark this questionnaire complete? The couple will no longer be able to edit it.")) return;
                      startComplete(async () => {
                        const r = await completeQuestionnaireAction(eventId, kind);
                        if (r.ok) toast.success("Marked complete.");
                        else toast.error(r.message ?? "Could not complete.");
                      });
                    }}
                  >
                    {completing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1 h-3.5 w-3.5" />}
                    Mark Complete
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!confirm(
                    "Administratively reopen this form?\n\n"
                    + "This sets it back to Sent without a change-request note.\n"
                    + "Prefer Request Changes when you want the couple to revise a submitted form.",
                  )) return;
                  startReopen(async () => {
                    const r = await reopenQuestionnaireAction(eventId, kind);
                    if (r.ok) toast.success("Reopened.");
                    else toast.error(r.message ?? "Could not reopen.");
                  });
                }}
                disabled={reopening}
              >
                {reopening ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                Reopen
              </Button>
            </div>
          }
        />
        {sentLabel && <p className="text-xs text-muted-foreground">Last sent {sentLabel}</p>}
        {isChangesRequested && (
          <div className="rounded-sm border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="font-medium text-heading">Waiting on client changes</p>
            {initial.changesRequestedNote && (
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{initial.changesRequestedNote}</p>
            )}
          </div>
        )}
        {needsReview && showChangeForm && (
          <div className="rounded-sm border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-medium text-heading">What should the couple change?</p>
            <p className="text-xs text-muted-foreground">
              They will see this note, edit the form, and resubmit. Prior submissions stay in history.
            </p>
            <Textarea
              rows={3}
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="e.g. Please update the emergency contact phone and confirm the final guest count."
            />
            <div className="flex flex-wrap gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowChangeForm(false)}>Cancel</Button>
              <Button type="button" size="sm" disabled={requestingChanges || !changeNote.trim()} onClick={handleRequestChanges}>
                {requestingChanges ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Send change request
              </Button>
            </div>
          </div>
        )}
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
    <div className="space-y-5" data-testid={`questionnaire-kind-panel-${kind}`}>
      <BusinessAssetHeader
        compact
        whatIsThis="Planning form"
        title={kindLabel(kind)}
        status={<Badge variant={status === "sent" || status === "in_progress" ? "default" : "muted"}>{STATUS_LABEL[status] ?? "Draft"}</Badge>}
        waitingOn={waitingOn}
        lastUpdated={initial?.updatedAt ? new Date(initial.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        relationship={eventName ? { name: eventName } : null}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            {coupleEmail && (
              <ShareDialog
                trigger={(
                  <Button type="button" size="sm" data-testid="questionnaire-send-entry">
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {initial?.sentAt ? "Resend Questionnaire" : LIBRARY_LABELS.sendQuestionnaire}
                  </Button>
                )}
                title={initial?.sentAt ? `Resend ${kindLabel(kind)}` : LIBRARY_LABELS.sendQuestionnaire}
                recipient={shareRecipient}
                whatHappensNext={sendConsequence}
                defaultMessage={shareDefaultMessage}
                sendLabel={initial?.sentAt ? "Send now" : "Send now"}
                onSend={handleShareSend}
                allowSchedule
                onSchedule={handleSchedule}
                scheduleLabel="Schedule send"
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

      {pendingSchedule ? (
        <div
          className="rounded-sm border border-border bg-muted/30 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
          data-testid="questionnaire-scheduled-banner"
        >
          <p className="text-sm text-foreground">
            Scheduled to send{" "}
            <span className="font-medium">
              {new Date(initial!.scheduledSendAt!).toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </span>
            . Nothing has been emailed yet.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cancellingSchedule}
            data-testid="questionnaire-cancel-schedule"
            onClick={() => {
              startCancelSchedule(async () => {
                const r = await cancelScheduledQuestionnaireSendAction(eventId, kind);
                if (r.ok) {
                  toast.success("Scheduled send cancelled.");
                  onApplied?.();
                } else toast.error(r.message ?? "Could not cancel.");
              });
            }}
          >
            {cancellingSchedule ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Cancel schedule
          </Button>
        </div>
      ) : null}

      <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {status === "draft" || !initial
              ? "Draft — not visible to the client until you send."
              : status === "in_progress"
                ? `In progress ${sentLabel ? `· sent ${sentLabel}` : ""} — client has opened or started the form.`
                : initial.openedAt
                  ? `Sent ${sentLabel ?? ""} — opened, awaiting submission.`
                  : `Sent ${sentLabel ?? ""} — waiting for the client to open it.`}
          </p>
          <a href={`/events/${eventId}/questionnaire-preview?kind=${encodeURIComponent(kind)}&from=event`}>
            <Button type="button" variant="ghost" size="sm" data-testid="questionnaire-preview-as-client">
              Preview as client
            </Button>
          </a>
        </div>
        {(currentFormUrl && (initial?.sentAt || formUrl)) && (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted border border-border px-3 py-1.5 text-xs font-mono truncate">{currentFormUrl}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => {
              if (!currentFormUrl) return;
              navigator.clipboard.writeText(absoluteFormUrl());
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

      {canApplyTemplate && (
        <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-2" data-testid="questionnaire-library-apply">
          <p className="text-xs font-medium text-heading">
            {initial?.templateId ? "Library form applied (draft only)" : "Apply a library form? (optional)"}
          </p>
          <p className="text-xs text-muted-foreground">
            Applies field configuration to this draft. Does not send or schedule anything.
          </p>
          {kindTemplates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedTemplateId || null}
                onValueChange={(v) => {
                  const id = v ?? "";
                  setSelectedTemplateId(id);
                  if (id) applyTemplate(id, { silentIfSame: true });
                }}
                items={kindTemplates.map((t) => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger className="w-64" data-testid={`questionnaire-template-select-${kind}`}>
                  <SelectValue placeholder={kindTemplates.length === 0 ? "No templates for this type" : "Select a template…"}>
                    {(value: string | null) => {
                      if (!value) return null;
                      const match = kindTemplates.find((t) => t.id === value);
                      if (match) return match.name;
                      if (kindTemplates.length === 0) return "Loading templates…";
                      return "Select a template…";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {kindTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {applying ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No library templates for this type yet.</p>
          )}
        </div>
      )}

      {/* Answers only after send / client progress — never expand the blank form inline on selection. */}
      {initial && (initial.status === "sent" || initial.status === "in_progress" || initial.additional?.family) && (
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
  const router = useRouter();
  const [active, setActive] = React.useState<QuestionnaireKind>("client_planning");
  const [applyTick, setApplyTick] = React.useState(0);
  const byKind = Object.fromEntries(questionnaires.map((q) => [q.kind, q])) as Partial<Record<QuestionnaireKind, Questionnaire>>;
  const activeTemplates = templates.filter((t) => !t.isArchived);
  function refreshAfterApply() {
    setApplyTick((n) => n + 1);
    router.refresh();
  }

  // Extra library templates beyond the three kind tabs (same kind, different name).
  const primaryByKind = Object.fromEntries(
    KINDS.map((k) => {
      const ofKind = activeTemplates.filter((t) => t.kind === k);
      const master = getQuestionnaireMasterByKind(k);
      const named = ofKind.find((t) => t.name === master.name);
      return [k, named ?? ofKind[0] ?? null];
    }),
  ) as Record<QuestionnaireKind, QuestionnaireTemplate | null>;
  const additionalTemplates = activeTemplates.filter((t) => {
    const primary = primaryByKind[t.kind];
    return primary && t.id !== primary.id;
  });

  function selectKind(kind: QuestionnaireKind, templateId?: string) {
    setActive(kind);
    const ofKind = activeTemplates.filter((t) => t.kind === kind);
    const id = templateId ?? preferredTemplateId(ofKind, byKind[kind]?.templateId);
    // Defer apply to KindPanel mount via selecting template — KindPanel applies on dropdown change.
    // Also apply immediately here so tab click selects + applies without expanding content.
    if (id && (!byKind[kind] || byKind[kind]?.status === "draft")) {
      if (byKind[kind]?.templateId === id) return;
      void applyQuestionnaireTemplateAction(id, eventId).then((r) => {
        if (r.ok) {
          toast.success("Library form applied to this draft.");
          refreshAfterApply();
        } else if (r.message) {
          toast.error(r.message);
        }
      });
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-md border border-border/70 bg-muted/15 px-3 py-2 text-sm text-muted-foreground leading-relaxed"
        data-testid="questionnaire-delivery-guidance"
      >
        {"Manage questionnaire delivery by sending immediately or schedule sending them below. If they have already been attached to tasks or requested elsewhere, this step can be skipped or used to resend them if desired."}
      </div>
      <div className="flex flex-wrap gap-2" data-testid="questionnaire-kind-tabs">
        {KINDS.map((k) => {
          const q = byKind[k];
          const status = q?.status ?? "draft";
          const selected = active === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => selectKind(k)}
              className={`rounded-full border px-3 py-1.5 text-xs ${selected ? "border-primary bg-primary/10 font-medium" : "border-border"}`}
              data-testid={`questionnaire-kind-tab-${k}`}
            >
              {kindLabel(k)}
              {status === "complete" ? " · Complete"
                : status === "submitted" || status === "resubmitted" ? " · Review"
                : status === "changes_requested" ? " · Changes"
                : status === "sent" || status === "in_progress" ? " · Sent"
                : ""}
            </button>
          );
        })}
        {additionalTemplates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectKind(t.kind, t.id)}
            className={`rounded-full border px-3 py-1.5 text-xs ${active === t.kind && byKind[t.kind]?.templateId === t.id ? "border-primary bg-primary/10 font-medium" : "border-border"}`}
            data-testid={`questionnaire-extra-template-${t.id}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="questionnaire-create-in-templates-guidance">
        Want to create another questionnaire? Go to{" "}
        <Link href="/library/questionnaire-templates" className="underline underline-offset-2 text-heading">
          Questionnaires &amp; Feedback
        </Link>{" "}
        in your Templates tab. New questionnaires you create there will appear here as additional sending options.
      </p>
      <KindPanel
        key={`${active}-${applyTick}`}
        kind={active}
        eventId={eventId}
        initial={byKind[active] ?? null}
        templates={templates}
        activities={byKind[active] ? (activitiesById[byKind[active]!.id] ?? []) : []}
        coupleEmail={coupleEmail}
        coupleName={coupleName}
        eventName={eventName}
        venueName={venueName}
        onApplied={refreshAfterApply}
      />
    </div>
  );
}
