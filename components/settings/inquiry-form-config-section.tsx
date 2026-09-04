"use client";

import * as React from "react";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  replaceInquiryFormQuestionsAction,
  updateInquiryFormSettingsAction,
} from "@/app/(app)/settings/inquiry-form-actions";
import { LibrarySaveStatus } from "@/components/library/library-save-status";
import { LIBRARY_LABELS, librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_ACCEPTED_EVENT_TYPES, EVENT_TYPES } from "@/lib/event-types/canonical";
import { STANDARD_FIELD_LABELS } from "@/lib/inquiry-form/constants";
import type {
  FieldVisibility,
  InquiryEventDateMode,
  InquiryFormFieldsConfig,
  InquiryFormQuestion,
  InquiryQuestionType,
  StandardFieldKey,
} from "@/lib/inquiry-form/types";

const VISIBILITY_OPTIONS: { value: FieldVisibility; label: string }[] = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "hidden", label: "Hidden" },
];

const QUESTION_TYPES: { value: InquiryQuestionType; label: string }[] = [
  { value: "short_answer", label: "Short answer" },
  { value: "long_answer", label: "Long answer" },
  { value: "single_select", label: "Single select" },
  { value: "multiple_select", label: "Multiple select" },
];

type DraftQuestion = {
  id?: string;
  questionText: string;
  questionType: InquiryQuestionType;
  required: boolean;
  options: string;
};

function toDraft(q: InquiryFormQuestion): DraftQuestion {
  return {
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    required: q.required,
    options: q.options.join("\n"),
  };
}

function serializeState(
  mode: InquiryEventDateMode,
  fields: InquiryFormFieldsConfig,
  accepted: string[],
  questions: DraftQuestion[],
): string {
  return JSON.stringify({
    mode,
    fields,
    accepted: [...accepted].sort(),
    questions: questions.map((q) => ({
      id: q.id ?? "",
      questionText: q.questionText,
      questionType: q.questionType,
      required: q.required,
      options: q.options,
    })),
  });
}

export function InquiryFormConfigSection({
  initialEventDateMode,
  initialFields,
  initialAcceptedEventTypes,
  initialQuestions,
  canEdit = true,
}: {
  initialEventDateMode: InquiryEventDateMode;
  initialFields: InquiryFormFieldsConfig;
  initialAcceptedEventTypes: string[];
  initialQuestions: InquiryFormQuestion[];
  /** Owner/Manager; when false, controls are read-only. */
  canEdit?: boolean;
}) {
  const [baseline, setBaseline] = React.useState(() =>
    serializeState(initialEventDateMode, initialFields, initialAcceptedEventTypes, initialQuestions.map(toDraft)),
  );
  const [eventDateMode, setEventDateMode] = React.useState(initialEventDateMode);
  const [fields, setFields] = React.useState(initialFields);
  const [acceptedEventTypes, setAcceptedEventTypes] = React.useState(
    initialAcceptedEventTypes.length ? initialAcceptedEventTypes : [...DEFAULT_ACCEPTED_EVENT_TYPES],
  );
  const [questions, setQuestions] = React.useState<DraftQuestion[]>(initialQuestions.map(toDraft));
  const [pending, startSave] = React.useTransition();
  const [justSaved, setJustSaved] = React.useState(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = serializeState(eventDateMode, fields, acceptedEventTypes, questions) !== baseline;
  useLibraryUnsavedGuard(dirty && canEdit);

  React.useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  React.useEffect(() => {
    if (dirty) setJustSaved(false);
  }, [dirty]);

  function setFieldVisibility(key: StandardFieldKey, visibility: FieldVisibility) {
    if (!canEdit) return;
    setFields((prev) => ({ ...prev, [key]: visibility }));
  }

  function toggleEventType(value: string, checked: boolean) {
    if (!canEdit) return;
    setAcceptedEventTypes((prev) => {
      if (checked) return prev.includes(value) ? prev : [...prev, value];
      if (prev.length <= 1) return prev;
      return prev.filter((v) => v !== value);
    });
  }

  function addQuestion() {
    if (!canEdit) return;
    setQuestions((prev) => [...prev, { questionText: "", questionType: "short_answer", required: false, options: "" }]);
  }

  function updateQuestion(i: number, patch: Partial<DraftQuestion>) {
    if (!canEdit) return;
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function removeQuestion(i: number) {
    if (!canEdit) return;
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    if (!canEdit || !dirty) return;
    startSave(async () => {
      const settingsResult = await updateInquiryFormSettingsAction({
        inquiryEventDateMode: eventDateMode,
        inquiryFormFields: fields,
        acceptedEventTypes,
      });
      if (!settingsResult.ok) {
        toast.error(
          settingsResult.error === "forbidden"
            ? "Only an Owner or Manager can change inquiry form settings."
            : "Could not save inquiry form settings.",
        );
        return;
      }

      const parsedQuestions = questions
        .filter((q) => q.questionText.trim())
        .map((q) => ({
          id: q.id ?? crypto.randomUUID(),
          questionText: q.questionText.trim(),
          questionType: q.questionType,
          required: q.required,
          options: q.questionType === "single_select" || q.questionType === "multiple_select"
            ? q.options.split("\n").map((o) => o.trim()).filter(Boolean)
            : [],
        }));

      const questionsResult = await replaceInquiryFormQuestionsAction(parsedQuestions);
      if (!questionsResult.ok) {
        toast.error(
          questionsResult.error === "forbidden"
            ? "Only an Owner or Manager can change inquiry form settings."
            : "Could not save custom questions.",
        );
        return;
      }

      setBaseline(serializeState(eventDateMode, fields, acceptedEventTypes, questions));
      setJustSaved(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setJustSaved(false), 2500);
      toast.success(librarySavedToastMessage());
    });
  }

  const saveStatus = pending
    ? ("saving" as const)
    : dirty
      ? ("dirty" as const)
      : justSaved
        ? ("saved" as const)
        : ("idle" as const);

  const saveBar = canEdit && (
    <div className="flex flex-wrap items-center gap-3">
      <LibrarySaveStatus status={saveStatus} model="explicit" className="mr-auto" />
      <Button type="button" onClick={handleSave} disabled={pending || !dirty}>
        {pending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{LIBRARY_LABELS.saving}</>
        ) : (
          LIBRARY_LABELS.saveChanges
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {canEdit && dirty && (
        <div className="sticky top-0 z-10 -mx-1 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {saveBar}
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Only an Owner or Manager can change inquiry form settings. You can view the current configuration here.
        </p>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Preferred event date</p>
        <p className="text-xs text-muted-foreground">
          Controls what prospects see on your public inquiry and Schedule Tour forms. Changes apply after you save.
        </p>
        <div className="space-y-2">
          <label className={`flex items-start gap-3 rounded-lg border border-border p-3 ${canEdit ? "cursor-pointer" : "opacity-80"}`}>
            <input
              type="radio"
              name="eventDateMode"
              checked={eventDateMode === "choose_available"}
              onChange={() => canEdit && setEventDateMode("choose_available")}
              disabled={!canEdit}
              className="mt-1"
            />
            <span>
              <span className="text-sm font-medium text-heading block">Let prospects choose from available dates</span>
              <span className="text-xs text-muted-foreground">Show open dates from your venue capacity calendar. Prospects cannot pick unavailable dates.</span>
            </span>
          </label>
          <label className={`flex items-start gap-3 rounded-lg border border-border p-3 ${canEdit ? "cursor-pointer" : "opacity-80"}`}>
            <input
              type="radio"
              name="eventDateMode"
              checked={eventDateMode === "request_preferred"}
              onChange={() => canEdit && setEventDateMode("request_preferred")}
              disabled={!canEdit}
              className="mt-1"
            />
            <span>
              <span className="text-sm font-medium text-heading block">Let prospects request a preferred date</span>
              <span className="text-xs text-muted-foreground">Prospects can request the date they prefer. Availability is not shown on the form.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Event types this venue accepts</p>
        <p className="text-xs text-muted-foreground">
          Choose which event types appear on your public inquiry and Schedule Tour forms. You are selecting the types this venue accepts — not toggling a fixed Hello to Cheers list. Start from the defaults (marked below), then add any other type from the full list or remove a default. At least one must stay selected.
        </p>
        <div className="space-y-2">
          {EVENT_TYPES.map((t) => (
            <label key={t.value} className={`flex items-center gap-3 rounded-lg border border-border px-3 py-2 ${canEdit ? "cursor-pointer" : "opacity-80"}`}>
              <input
                type="checkbox"
                checked={acceptedEventTypes.includes(t.value)}
                onChange={(e) => toggleEventType(t.value, e.target.checked)}
                disabled={!canEdit || (acceptedEventTypes.length === 1 && acceptedEventTypes.includes(t.value))}
              />
              <span className="text-sm text-heading">{t.label}</span>
              {DEFAULT_ACCEPTED_EVENT_TYPES.includes(t.value) && (
                <span className="text-[10px] text-muted-foreground">Default</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Standard fields</p>
        <p className="text-xs text-muted-foreground">First name, last name, email, and event type are always shown and required.</p>
        <div className="space-y-2">
          {(Object.keys(STANDARD_FIELD_LABELS) as StandardFieldKey[]).map((key) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <Label className="text-sm text-heading">{STANDARD_FIELD_LABELS[key]}</Label>
              <select
                value={fields[key]}
                onChange={(e) => setFieldVisibility(key, e.target.value as FieldVisibility)}
                disabled={!canEdit}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-heading">Custom questions</p>
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="mr-1 h-3.5 w-3.5" />Add question
            </Button>
          )}
        </div>
        {questions.length === 0 && (
          <p className="text-xs text-muted-foreground">No custom questions yet.</p>
        )}
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id ?? i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <input
                  value={q.questionText}
                  onChange={(e) => updateQuestion(i, { questionText: e.target.value })}
                  placeholder="Question text"
                  disabled={!canEdit}
                  className="flex-1 rounded-md border border-border px-2 py-1.5 text-sm"
                />
                {canEdit && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={q.questionType}
                  onChange={(e) => updateQuestion(i, { questionType: e.target.value as InquiryQuestionType })}
                  disabled={!canEdit}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={q.required} disabled={!canEdit} onChange={(e) => updateQuestion(i, { required: e.target.checked })} />
                  Required
                </label>
              </div>
              {(q.questionType === "single_select" || q.questionType === "multiple_select") && (
                <textarea
                  value={q.options}
                  onChange={(e) => updateQuestion(i, { options: e.target.value })}
                  placeholder="One option per line"
                  rows={3}
                  disabled={!canEdit}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-xs"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="border-t border-border pt-4">
          {saveBar}
        </div>
      )}
    </div>
  );
}
