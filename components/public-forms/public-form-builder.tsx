"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  archivePublicFormAction,
  createQrForPublicFormAction,
  deactivatePublicFormAction,
  duplicatePublicFormAction,
  publishPublicFormAction,
  replacePublicFormQuestionsAction,
  updatePublicFormAction,
} from "@/app/(app)/library/public-forms/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PUBLIC_FORM_FIELD_LABELS } from "@/lib/public-forms/constants";
import { publicFormPath } from "@/lib/public-forms/public-url";
import type {
  FieldVisibility,
  InquiryQuestionType,
  PublicForm,
  PublicFormFieldConfig,
  PublicFormFieldKey,
  PublicFormLeadSummary,
  PublicFormQrSummary,
} from "@/lib/public-forms/types";

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

function toDraft(q: PublicForm["questions"][number]): DraftQuestion {
  return {
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    required: q.required,
    options: q.options.join("\n"),
  };
}

export function PublicFormBuilder({
  form,
  appUrl,
  canEdit = true,
  qrCodes = [],
  leads = [],
  returnTo = null,
}: {
  form: PublicForm;
  appUrl: string;
  canEdit?: boolean;
  qrCodes?: PublicFormQrSummary[];
  leads?: PublicFormLeadSummary[];
  /** When set (e.g. from QR create), show an explicit return action. */
  returnTo?: string | null;
}) {
  const router = useRouter();
  const [internalName, setInternalName] = React.useState(form.internalName);
  const [publicTitle, setPublicTitle] = React.useState(form.publicTitle);
  const [description, setDescription] = React.useState(form.description);
  const [fieldConfig, setFieldConfig] = React.useState<PublicFormFieldConfig>(form.fieldConfig);
  const [questions, setQuestions] = React.useState<DraftQuestion[]>(form.questions.map(toDraft));
  const [status, setStatus] = React.useState(form.status);
  const [pending, startTransition] = React.useTransition();
  const [qrName, setQrName] = React.useState("");
  const returningToQr = Boolean(returnTo?.startsWith("/library/qr-campaigns"));

  const publicPath = publicFormPath(form.publicKey);
  const publicUrl = `${appUrl}${publicPath}`;

  function addQuestion() {
    if (!canEdit) return;
    setQuestions((prev) => [
      ...prev,
      { questionText: "", questionType: "short_answer", required: false, options: "" },
    ]);
  }

  function updateQuestion(i: number, patch: Partial<DraftQuestion>) {
    if (!canEdit) return;
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function removeQuestion(i: number) {
    if (!canEdit) return;
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveQuestion(i: number, dir: -1 | 1) {
    if (!canEdit) return;
    setQuestions((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }

  function handleSave() {
    if (!canEdit) return;
    startTransition(async () => {
      const settingsResult = await updatePublicFormAction(form.id, {
        internalName,
        publicTitle,
        description,
        fieldConfig,
      });
      if (!settingsResult.ok) {
        toast.error(
          settingsResult.error === "forbidden"
            ? "Only an Owner or Manager can edit public forms."
            : "Could not save form settings.",
        );
        return;
      }

      const parsedQuestions = questions
        .filter((q) => q.questionText.trim())
        .map((q) => ({
          id: q.id,
          questionText: q.questionText.trim(),
          questionType: q.questionType,
          required: q.required,
          options:
            q.questionType === "single_select" || q.questionType === "multiple_select"
              ? q.options.split("\n").map((o) => o.trim()).filter(Boolean)
              : [],
        }));

      const qResult = await replacePublicFormQuestionsAction(form.id, parsedQuestions);
      if (!qResult.ok) {
        toast.error(
          qResult.error === "forbidden"
            ? "Only an Owner or Manager can edit public forms."
            : "Could not save questions.",
        );
        return;
      }

      toast.success("Public form saved.");
      router.refresh();
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const result = await publishPublicFormAction(form.id);
      if (!result.ok) {
        toast.error("Could not publish form.");
        return;
      }
      setStatus("published");
      toast.success("Form published — public URL is live.");
      router.refresh();
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivatePublicFormAction(form.id);
      if (!result.ok) {
        toast.error("Could not deactivate form.");
        return;
      }
      setStatus("draft");
      toast.success("Form deactivated — public URL no longer accepts submissions.");
      router.refresh();
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archivePublicFormAction(form.id);
      if (!result.ok) {
        toast.error("Could not archive form.");
        return;
      }
      setStatus("archived");
      toast.success("Form archived. Existing leads and QR codes are kept.");
      router.push("/library/public-forms");
    });
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(publicUrl).then(
      () => toast.success("Link copied."),
      () => toast.error("Could not copy link."),
    );
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicatePublicFormAction(form.id);
      if (!result.ok) {
        toast.error("Could not duplicate form.");
        return;
      }
      toast.success("Duplicate created as a draft.");
      router.push(`/library/public-forms/${result.id}`);
    });
  }

  function handleCreateQr() {
    const name = qrName.trim();
    if (!name) {
      toast.error("Enter a name for this QR code.");
      return;
    }
    startTransition(async () => {
      const result = await createQrForPublicFormAction(form.id, name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("QR code created for this form.");
      setQrName("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === "published" ? "default" : "muted"}>
          {status === "published" ? "Published" : status === "archived" ? "Archived" : "Draft"}
        </Badge>
        {status === "published" && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Open form <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {returnTo && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(returnTo)}
          >
            {returningToQr ? "Return to QR creation" : "Back"}
          </Button>
        )}
      </div>
      {returningToQr && status !== "published" && status !== "archived" && (
        <p className="text-xs text-muted-foreground">
          Publish this form when you are ready, then return to QR creation. The QR will not be live until the form is published.
        </p>
      )}
      {returningToQr && status === "published" && (
        <p className="text-xs text-muted-foreground">
          This form is published. Return to QR creation to finish saving the QR code.
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Internal name</Label>
          <Input
            value={internalName}
            onChange={(e) => setInternalName(e.target.value)}
            placeholder="Wedding Expo — September 2026"
            disabled={!canEdit}
          />
          <p className="text-[11px] text-muted-foreground">Staff-only label. Not shown on the public form.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Public title</Label>
          <Input
            value={publicTitle}
            onChange={(e) => setPublicTitle(e.target.value)}
            placeholder="Welcome to our Wedding Expo!"
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description / instructions</Label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us what you're looking for and we'll follow up."
            disabled={!canEdit}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-heading">Standard fields</p>
        <p className="text-xs text-muted-foreground">
          Name and email are always required. Venue branding is inherited automatically.
        </p>
        {(Object.keys(PUBLIC_FORM_FIELD_LABELS) as PublicFormFieldKey[]).map((key) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">{PUBLIC_FORM_FIELD_LABELS[key]}</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={fieldConfig[key]}
              disabled={!canEdit}
              onChange={(e) =>
                setFieldConfig((prev) => ({
                  ...prev,
                  [key]: e.target.value as FieldVisibility,
                }))
              }
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-heading">Questions</p>
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add question
            </Button>
          )}
        </div>
        {questions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No custom questions yet.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id ?? `new-${i}`} className="space-y-2 rounded-md border border-border/80 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={q.questionText}
                    onChange={(e) => updateQuestion(i, { questionText: e.target.value })}
                    placeholder="Question text"
                    disabled={!canEdit}
                    className="flex-1"
                  />
                  <select
                    className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                    value={q.questionType}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateQuestion(i, { questionType: e.target.value as InquiryQuestionType })
                    }
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={q.required}
                      disabled={!canEdit}
                      onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  {canEdit && (
                    <>
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(i, 1)}
                        disabled={i === questions.length - 1}
                      >
                        Down
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                {(q.questionType === "single_select" || q.questionType === "multiple_select") && (
                  <textarea
                    rows={3}
                    value={q.options}
                    onChange={(e) => updateQuestion(i, { options: e.target.value })}
                    placeholder={"One option per line"}
                    disabled={!canEdit}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-heading">Share</p>
        {status === "published" ? (
          <>
            <code className="block break-all text-xs text-muted-foreground">{publicUrl}</code>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
                Copy link
              </Button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] hover:bg-muted"
              >
                Open form
              </a>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Publish this form to share the link. Drafts and archived forms do not accept new responses.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-heading">QR codes</p>
        <p className="text-xs text-muted-foreground">
          Several QR codes can point to this same form. Each keeps its own name and scan history.
        </p>
        {qrCodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No QR codes point to this form yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {qrCodes.map((qr) => (
              <li key={qr.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {qr.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {qr.status === "archived" ? "archived" : "active"} · {qr.scans} scans · {qr.conversions} leads
                  </span>
                </span>
                <a
                  href={`/library/qr-campaigns`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Open QR list
                </a>
              </li>
            ))}
          </ul>
        )}
        {canEdit && status === "published" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <Label className="text-xs">New QR code name</Label>
              <Input
                value={qrName}
                onChange={(e) => setQrName(e.target.value)}
                placeholder="Entrance"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleCreateQr} disabled={pending}>
              Create QR code
            </Button>
          </div>
        )}
        {canEdit && status !== "published" && (
          <p className="text-xs text-muted-foreground">Publish this form before creating a QR code.</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-heading">Leads from this form</p>
        {leads.length === 0 ? (
          <p className="text-xs text-muted-foreground">No leads captured from this form yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {leads.map((lead) => (
              <li key={lead.id}>
                <a href={`/leads/${lead.id}`} className="hover:underline">
                  {lead.firstName} {lead.lastName}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  {lead.email ?? ""}
                  {lead.qrCampaignId ? " · from a QR code" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          {status !== "published" && status !== "archived" && (
            <Button type="button" variant="outline" onClick={handlePublish} disabled={pending}>
              Publish
            </Button>
          )}
          {status === "published" && (
            <Button type="button" variant="outline" onClick={handleDeactivate} disabled={pending}>
              Deactivate
            </Button>
          )}
          {status !== "archived" && (
            <Button type="button" variant="ghost" onClick={handleArchive} disabled={pending}>
              Archive
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={handleDuplicate} disabled={pending}>
            Duplicate
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/library/public-forms")}>
            Back to list
          </Button>
        </div>
      )}
    </div>
  );
}
