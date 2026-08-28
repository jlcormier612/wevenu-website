"use client";

import * as React from "react";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  replaceInquiryFormQuestionsAction,
  updateInquiryFormSettingsAction,
} from "@/app/(app)/settings/inquiry-form-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PUBLIC_INQUIRY_EVENT_TYPES, STANDARD_FIELD_LABELS } from "@/lib/inquiry-form/constants";
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

export function InquiryFormConfigSection({
  initialEventDateMode,
  initialFields,
  initialAcceptedEventTypes,
  initialQuestions,
}: {
  initialEventDateMode: InquiryEventDateMode;
  initialFields: InquiryFormFieldsConfig;
  initialAcceptedEventTypes: string[];
  initialQuestions: InquiryFormQuestion[];
}) {
  const [eventDateMode, setEventDateMode] = React.useState(initialEventDateMode);
  const [fields, setFields] = React.useState(initialFields);
  const [acceptedEventTypes, setAcceptedEventTypes] = React.useState(initialAcceptedEventTypes);
  const [questions, setQuestions] = React.useState<DraftQuestion[]>(initialQuestions.map(toDraft));
  const [saving, startSave] = React.useTransition();

  function setFieldVisibility(key: StandardFieldKey, visibility: FieldVisibility) {
    setFields((prev) => ({ ...prev, [key]: visibility }));
  }

  function toggleEventType(value: string, checked: boolean) {
    setAcceptedEventTypes((prev) => {
      if (checked) return prev.includes(value) ? prev : [...prev, value];
      // Never allow unchecking the last remaining type — mirrors the
      // database's own non-empty constraint on this column.
      if (prev.length <= 1) return prev;
      return prev.filter((v) => v !== value);
    });
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { questionText: "", questionType: "short_answer", required: false, options: "" }]);
  }

  function updateQuestion(i: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    startSave(async () => {
      const settingsResult = await updateInquiryFormSettingsAction({
        inquiryEventDateMode: eventDateMode,
        inquiryFormFields: fields,
        acceptedEventTypes,
      });
      if (!settingsResult.ok) {
        toast.error("Could not save inquiry form settings.");
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
        toast.error("Could not save custom questions.");
        return;
      }
      toast.success("Inquiry form settings saved.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Preferred event date</p>
        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
            <input
              type="radio"
              name="eventDateMode"
              checked={eventDateMode === "choose_available"}
              onChange={() => setEventDateMode("choose_available")}
              className="mt-1"
            />
            <span>
              <span className="text-sm font-medium text-heading block">Let prospects choose from available dates</span>
              <span className="text-xs text-muted-foreground">Show available dates from your venue calendar on your inquiry form.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
            <input
              type="radio"
              name="eventDateMode"
              checked={eventDateMode === "request_preferred"}
              onChange={() => setEventDateMode("request_preferred")}
              className="mt-1"
            />
            <span>
              <span className="text-sm font-medium text-heading block">Let prospects request a preferred date</span>
              <span className="text-xs text-muted-foreground">Prospects can request the date they prefer. Availability is not shown.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Event types you accept</p>
        <p className="text-xs text-muted-foreground">
          Choose which event types appear in the Event Type dropdown on your public inquiry and Schedule Tour form. At least one must stay selected.
        </p>
        <div className="space-y-2">
          {PUBLIC_INQUIRY_EVENT_TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedEventTypes.includes(t.value)}
                onChange={(e) => toggleEventType(t.value, e.target.checked)}
                disabled={acceptedEventTypes.length === 1 && acceptedEventTypes.includes(t.value)}
              />
              <span className="text-sm text-heading">{t.label}</span>
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
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add question
          </Button>
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
                  className="flex-1 rounded-md border border-border px-2 py-1.5 text-sm"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(i)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={q.questionType}
                  onChange={(e) => updateQuestion(i, { questionType: e.target.value as InquiryQuestionType })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, { required: e.target.checked })} />
                  Required
                </label>
              </div>
              {(q.questionType === "single_select" || q.questionType === "multiple_select") && (
                <textarea
                  value={q.options}
                  onChange={(e) => updateQuestion(i, { options: e.target.value })}
                  placeholder="One option per line"
                  rows={3}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-xs"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save inquiry form settings"}
      </Button>
    </div>
  );
}
