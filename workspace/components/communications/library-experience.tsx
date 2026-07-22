"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Panel, StatusPill } from "@/components/shared/ui";
import { DEFAULT_SEQUENCE_TIMEZONE } from "@/lib/program3/schedule";
import type {
  BrandingConfig,
  ScheduleMode,
  Sequence,
  SequenceStep,
  SequenceTargeting,
  Template,
  TemplateCategory,
} from "@/lib/program3/types";

function emptyStep(): SequenceStep {
  return {
    id: `ss_${Math.random().toString(36).slice(2, 10)}`,
    templateId: "",
    delayHours: 0,
    scheduleMode: "relative",
    label: "",
  };
}

export function LibraryExperience({
  templates,
  sequences,
  categories,
  branding,
}: {
  templates: Template[];
  sequences: Sequence[];
  categories: TemplateCategory[];
  branding: BrandingConfig;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"templates" | "sequences" | "branding">("templates");
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const [subject, setSubject] = useState(selected?.subject ?? "");
  const [body, setBody] = useState(selected?.body ?? "");
  const [name, setName] = useState(selected?.name ?? "");
  const [categoryId, setCategoryId] = useState(selected?.categoryId ?? categories[0]?.id ?? "");
  const [approval, setApproval] = useState(selected?.approval ?? "draft");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [seqId, setSeqId] = useState(sequences[0]?.id ?? "");
  const initialSeq = sequences.find((s) => s.id === seqId) ?? sequences[0];
  const [seqName, setSeqName] = useState(initialSeq?.name ?? "");
  const [seqDesc, setSeqDesc] = useState(initialSeq?.description ?? "");
  const [seqCategory, setSeqCategory] = useState(
    initialSeq?.categoryId ?? categories[0]?.id ?? "",
  );
  const [seqTargeting, setSeqTargeting] = useState<SequenceTargeting>(
    initialSeq?.targeting ?? "any",
  );
  const [seqTimezone, setSeqTimezone] = useState(
    initialSeq?.timezone ?? DEFAULT_SEQUENCE_TIMEZONE,
  );
  const [seqApproval, setSeqApproval] = useState(initialSeq?.approval ?? "draft");
  const [seqActive, setSeqActive] = useState(initialSeq?.active !== false);
  const [seqSteps, setSeqSteps] = useState<SequenceStep[]>(
    initialSeq?.steps?.length ? initialSeq.steps : [emptyStep()],
  );

  const [fromName, setFromName] = useState(branding.fromName);
  const [fromEmail, setFromEmail] = useState(branding.fromEmail);
  const [replyTo, setReplyTo] = useState(branding.replyToEmail);
  const [signature, setSignature] = useState(branding.signatureHtml);

  function loadTemplate(t: Template) {
    setSelectedId(t.id);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
    setCategoryId(t.categoryId);
    setApproval(t.approval);
    setMessage(null);
  }

  function loadSequence(s: Sequence) {
    setSeqId(s.id);
    setSeqName(s.name);
    setSeqDesc(s.description);
    setSeqCategory(s.categoryId);
    setSeqTargeting(s.targeting ?? "any");
    setSeqTimezone(s.timezone || DEFAULT_SEQUENCE_TIMEZONE);
    setSeqApproval(s.approval);
    setSeqActive(s.active !== false);
    setSeqSteps(s.steps.length ? structuredClone(s.steps) : [emptyStep()]);
    setMessage(null);
  }

  async function saveTemplate() {
    if (!selected) return;
    setMessage(null);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_template",
        template: {
          id: selected.id,
          name,
          subject,
          body,
          approval,
          categoryId,
          publishStatus: approval === "approved" ? "published" : "draft",
          variables: selected.variables,
        },
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage("Template saved (version recorded if content changed)");
    startTransition(() => router.refresh());
  }

  async function createTemplate() {
    setMessage(null);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_template",
        template: {
          name: "New template",
          subject: "Hello {{owner_first_name}} — {{venue_name}}",
          body: `Hi {{owner_first_name}},\n\n`,
          categoryId: categories[0]?.id ?? "cat_prospect_nurture",
        },
      }),
    });
    const data = (await res.json()) as { error?: string; template?: Template };
    if (!res.ok || !data.template) {
      setMessage(data.error || "Create failed");
      return;
    }
    setMessage("Template created");
    startTransition(() => {
      router.refresh();
      loadTemplate(data.template!);
    });
  }

  async function saveSequence() {
    setMessage(null);
    const steps = seqSteps
      .filter((s) => s.templateId)
      .map((s) => ({
        ...s,
        delayHours: Number(s.delayHours) || 0,
        scheduleMode: (s.scheduleMode ?? "relative") as ScheduleMode,
        absoluteAt: s.scheduleMode === "absolute" ? s.absoluteAt : undefined,
        timezone:
          s.scheduleMode === "absolute"
            ? s.timezone || seqTimezone || DEFAULT_SEQUENCE_TIMEZONE
            : undefined,
      }));
    if (steps.length === 0) {
      setMessage("Add at least one step with a template");
      return;
    }
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_sequence",
        sequence: {
          id: seqId || undefined,
          name: seqName,
          description: seqDesc,
          categoryId: seqCategory,
          targeting: seqTargeting,
          timezone: seqTimezone,
          approval: seqApproval,
          active: seqActive,
          steps,
        },
      }),
    });
    const data = (await res.json()) as { error?: string; sequence?: Sequence };
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    if (data.sequence) setSeqId(data.sequence.id);
    setMessage("Sequence saved");
    startTransition(() => router.refresh());
  }

  async function createSequence() {
    const blank: Sequence = {
      id: "",
      name: "New sequence",
      description: "",
      categoryId: categories[0]?.id ?? "cat_prospect_nurture",
      targeting: "prospects",
      timezone: DEFAULT_SEQUENCE_TIMEZONE,
      approval: "draft",
      active: true,
      steps: [emptyStep()],
      createdAt: "",
      updatedAt: "",
    };
    setSeqId("");
    setSeqName(blank.name);
    setSeqDesc("");
    setSeqCategory(blank.categoryId);
    setSeqTargeting("prospects");
    setSeqTimezone(DEFAULT_SEQUENCE_TIMEZONE);
    setSeqApproval("draft");
    setSeqActive(true);
    setSeqSteps([emptyStep()]);
    setMessage("Draft a new sequence — Save to persist");
  }

  function updateStep(index: number, patch: Partial<SequenceStep>) {
    setSeqSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  async function saveBranding() {
    setMessage(null);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_branding",
        branding: {
          fromName,
          fromEmail,
          replyToEmail: replyTo,
          signatureHtml: signature,
        },
      }),
    });
    if (!res.ok) {
      setMessage("Branding save failed");
      return;
    }
    setMessage("Branding saved — used for Resend / dry-run sends");
    startTransition(() => router.refresh());
  }

  const tabs = [
    { id: "templates" as const, label: "Templates" },
    { id: "sequences" as const, label: "Sequences" },
    { id: "branding" as const, label: "Branding" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]"
                  : "rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)]"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link
          href="/sequences"
          className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
        >
          Active enrollments →
        </Link>
      </div>

      {message ? <p className="mb-4 text-sm ws-muted">{message}</p> : null}

      {tab === "templates" ? (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <Panel
            title="Library"
            action={
              <button
                type="button"
                onClick={() => void createTemplate()}
                className="text-xs text-[var(--heritage-sage)] hover:underline"
              >
                New
              </button>
            }
          >
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => loadTemplate(t)}
                    className={`w-full rounded-sm px-2 py-2 text-left text-sm ${
                      selected?.id === t.id
                        ? "bg-[var(--soft-sage)]/40"
                        : "hover:bg-[var(--header-linen)]"
                    }`}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="mt-0.5 block text-xs ws-muted">
                      {categories.find((c) => c.id === t.categoryId)?.name ?? "—"} ·{" "}
                      {t.approval}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          {selected ? (
            <Panel
              title={selected.name}
              action={
                <div className="flex gap-2">
                  <StatusPill tone={selected.approval === "approved" ? "good" : "muted"}>
                    {selected.approval}
                  </StatusPill>
                  <StatusPill tone="neutral">
                    {selected.sentCount} sent · {selected.openCount} opens
                  </StatusPill>
                </div>
              }
            >
              <div className="space-y-4">
                <label className="block text-sm">
                  Name
                  <input
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Category
                  <select
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Subject
                  <input
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Body
                  <textarea
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2 font-mono text-[0.9rem]"
                    rows={10}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <p className="text-xs ws-muted">
                  Variables:{" "}
                  {`{{venue_name}}, {{owner_first_name}}, {{plan}}, {{owner_email}}, {{city}}, {{state}}`}
                </p>
                <label className="block text-sm">
                  Approval
                  <select
                    className="mt-1 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={approval}
                    onChange={(e) =>
                      setApproval(e.target.value as "draft" | "approved")
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void saveTemplate()}
                  className="rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
                >
                  Save template
                </button>
                {selected.versions.length > 0 ? (
                  <div className="border-t border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] pt-4">
                    <p className="ws-eyebrow mb-2">Version history</p>
                    <ul className="space-y-2 text-sm">
                      {[...selected.versions].reverse().map((v) => (
                        <li key={v.id} className="ws-muted">
                          v{v.version}
                          {v.note ? ` — ${v.note}` : ""} · {v.createdAt.slice(0, 10)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === "sequences" ? (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <Panel
            title="Sequences"
            action={
              <button
                type="button"
                onClick={() => createSequence()}
                className="text-xs text-[var(--heritage-sage)] hover:underline"
              >
                New
              </button>
            }
          >
            <ul className="space-y-2">
              {sequences.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => loadSequence(s)}
                    className={`w-full rounded-sm px-2 py-2 text-left text-sm ${
                      seqId === s.id
                        ? "bg-[var(--soft-sage)]/40"
                        : "hover:bg-[var(--header-linen)]"
                    }`}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="mt-0.5 block text-xs ws-muted">
                      {s.targeting} · {s.steps.length} steps
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={seqName || "Sequence builder"}>
            <div className="space-y-4">
              <label className="block text-sm">
                Name
                <input
                  className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                  value={seqName}
                  onChange={(e) => setSeqName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Description
                <textarea
                  className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                  rows={2}
                  value={seqDesc}
                  onChange={(e) => setSeqDesc(e.target.value)}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Category
                  <select
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={seqCategory}
                    onChange={(e) => setSeqCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Targeting
                  <select
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={seqTargeting}
                    onChange={(e) =>
                      setSeqTargeting(e.target.value as SequenceTargeting)
                    }
                  >
                    <option value="prospects">Prospects (before Subscribed)</option>
                    <option value="customers">Customers (Subscribed+)</option>
                    <option value="any">Any relationship</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Default timezone
                  <input
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={seqTimezone}
                    onChange={(e) => setSeqTimezone(e.target.value)}
                    placeholder={DEFAULT_SEQUENCE_TIMEZONE}
                  />
                </label>
                <label className="block text-sm">
                  Approval
                  <select
                    className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                    value={seqApproval}
                    onChange={(e) =>
                      setSeqApproval(e.target.value as "draft" | "approved")
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={seqActive}
                  onChange={(e) => setSeqActive(e.target.checked)}
                />
                Active (enrollable)
              </label>

              <div className="border-t border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] pt-4">
                <p className="ws-eyebrow mb-3">Steps</p>
                <ol className="space-y-4">
                  {seqSteps.map((step, index) => (
                    <li
                      key={step.id}
                      className="rounded-sm bg-[var(--header-linen)]/60 px-4 py-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs ws-muted">Step {index + 1}</p>
                        <button
                          type="button"
                          className="text-xs text-[var(--heritage-sage)] hover:underline"
                          onClick={() =>
                            setSeqSteps((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm sm:col-span-2">
                          Label
                          <input
                            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                            value={step.label ?? ""}
                            onChange={(e) =>
                              updateStep(index, { label: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          Template
                          <select
                            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                            value={step.templateId}
                            onChange={(e) =>
                              updateStep(index, { templateId: e.target.value })
                            }
                          >
                            <option value="">Select template…</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          Schedule
                          <select
                            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                            value={step.scheduleMode ?? "relative"}
                            onChange={(e) =>
                              updateStep(index, {
                                scheduleMode: e.target.value as ScheduleMode,
                              })
                            }
                          >
                            <option value="relative">Relative delay</option>
                            <option value="absolute">Absolute date/time</option>
                          </select>
                        </label>
                        {(step.scheduleMode ?? "relative") === "relative" ? (
                          <label className="block text-sm">
                            Delay (hours)
                            <input
                              type="number"
                              min={0}
                              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                              value={step.delayHours}
                              onChange={(e) =>
                                updateStep(index, {
                                  delayHours: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </label>
                        ) : (
                          <>
                            <label className="block text-sm">
                              Send at
                              <input
                                type="datetime-local"
                                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                                value={(step.absoluteAt ?? "").slice(0, 16)}
                                onChange={(e) =>
                                  updateStep(index, { absoluteAt: e.target.value })
                                }
                              />
                            </label>
                            <label className="block text-sm sm:col-span-2">
                              Timezone (IANA)
                              <input
                                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                                value={step.timezone || seqTimezone}
                                onChange={(e) =>
                                  updateStep(index, { timezone: e.target.value })
                                }
                                placeholder={DEFAULT_SEQUENCE_TIMEZONE}
                              />
                            </label>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="mt-3 text-sm text-[var(--heritage-sage)] hover:underline"
                  onClick={() => setSeqSteps((prev) => [...prev, emptyStep()])}
                >
                  + Add step
                </button>
              </div>

              <button
                type="button"
                disabled={pending}
                onClick={() => void saveSequence()}
                className="rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
              >
                Save sequence
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === "branding" ? (
        <Panel title="Send branding">
          <p className="mb-4 text-sm ws-muted">
            From / reply used when sending via Resend. Without RESEND_API_KEY, sends
            dry-run and still log timeline <code className="text-xs">email_sent</code>.
          </p>
          <div className="grid max-w-lg gap-4">
            <label className="block text-sm">
              From name
              <input
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              From email
              <input
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Reply-to
              <input
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Signature
              <textarea
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                rows={3}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() => void saveBranding()}
              className="w-fit rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)]"
            >
              Save branding
            </button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
