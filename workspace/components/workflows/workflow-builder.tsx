"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PIPELINE_COLUMNS } from "@/lib/pipeline";
import type { Workflow, WorkflowStep, WorkflowStepType } from "@/lib/program3/types";
import { STATUS_LABELS } from "@/lib/utils";

const STEP_TYPES: { value: WorkflowStepType; label: string }[] = [
  { value: "delay", label: "Delay" },
  { value: "wait_condition", label: "Wait for status" },
  { value: "send_email", label: "Send email" },
  { value: "timed_send", label: "Timed send" },
  { value: "internal_reminder", label: "Internal reminder" },
  { value: "create_task", label: "Create task" },
  { value: "assign_owner", label: "Assign owner" },
  { value: "notify_team", label: "Notify team" },
  { value: "pause", label: "Pause run" },
  { value: "exit", label: "Exit workflow" },
];

function emptyStep(): WorkflowStep {
  return {
    id: `wfs_${Math.random().toString(36).slice(2, 10)}`,
    type: "send_email",
    label: "New step",
    delayHours: 0,
  };
}

export function WorkflowBuilder({
  initial,
  templates,
  sequences,
  teamMembers,
}: {
  initial?: Workflow;
  templates: { id: string; name: string }[];
  sequences: { id: string; name: string }[];
  teamMembers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [triggerType, setTriggerType] = useState<"manual" | "status_enter">(
    initial?.trigger.type === "status_enter" ? "status_enter" : "manual",
  );
  const [triggerStatus, setTriggerStatus] = useState(
    initial?.trigger.type === "status_enter" ? initial.trigger.status : "inquiry",
  );
  const [steps, setSteps] = useState<WorkflowStep[]>(
    initial?.steps?.length ? initial.steps : [emptyStep()],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(steps[0]?.id ?? null);

  function updateStep(id: string, patch: Partial<WorkflowStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function save() {
    setMessage(null);
    const workflow = {
      id: initial?.id,
      createdAt: initial?.createdAt,
      name,
      description,
      active,
      trigger:
        triggerType === "manual"
          ? ({ type: "manual" } as const)
          : ({ type: "status_enter", status: triggerStatus } as const),
      steps,
    };
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", workflow }),
    });
    const data = (await res.json()) as { error?: string; workflow?: Workflow };
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage("Saved");
    startTransition(() => {
      if (data.workflow && !initial?.id) {
        router.push(`/workflows/${data.workflow.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="ws-panel space-y-4 p-6">
        <p className="ws-eyebrow">Basics</p>
        <label className="block text-sm">
          Name
          <input
            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Trigger
            <select
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2"
              value={triggerType}
              onChange={(e) =>
                setTriggerType(e.target.value as "manual" | "status_enter")
              }
            >
              <option value="manual">Manual</option>
              <option value="status_enter">When entering status</option>
            </select>
          </label>
          {triggerType === "status_enter" ? (
            <label className="block text-sm">
              Status
              <select
                className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2"
                value={triggerStatus}
                onChange={(e) =>
                  setTriggerStatus(e.target.value as typeof triggerStatus)
                }
              >
                {PIPELINE_COLUMNS.map((c) => (
                  <option key={c.status} value={c.status}>
                    {STATUS_LABELS[c.status]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="ws-eyebrow">Steps</p>
            <h2 className="font-heading text-2xl">Progressive path</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              const step = emptyStep();
              setSteps((prev) => [...prev, step]);
              setExpanded(step.id);
            }}
            className="rounded-sm px-3 py-1.5 text-sm ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] hover:bg-[var(--header-linen)]"
          >
            Add step
          </button>
        </div>

        {steps.map((step, index) => {
          const open = expanded === step.id;
          return (
            <div key={step.id} className="ws-panel overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--header-linen)]/40"
                onClick={() => setExpanded(open ? null : step.id)}
              >
                <div>
                  <p className="text-xs ws-muted">Step {index + 1}</p>
                  <p className="font-heading text-lg">{step.label}</p>
                  <p className="text-sm ws-muted">
                    {STEP_TYPES.find((t) => t.value === step.type)?.label}
                    {step.delayHours ? ` · +${step.delayHours}h` : null}
                  </p>
                </div>
                <span className="text-sm ws-muted">{open ? "Hide" : "Edit"}</span>
              </button>
              {open ? (
                <div className="space-y-3 border-t border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] px-5 py-4">
                  <label className="block text-sm">
                    Label
                    <input
                      className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                      value={step.label}
                      onChange={(e) => updateStep(step.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    Type
                    <select
                      className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                      value={step.type}
                      onChange={(e) =>
                        updateStep(step.id, {
                          type: e.target.value as WorkflowStepType,
                        })
                      }
                    >
                      {STEP_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Delay hours (before this step)
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                      value={step.delayHours ?? 0}
                      onChange={(e) =>
                        updateStep(step.id, {
                          delayHours: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  {step.type === "send_email" || step.type === "timed_send" ? (
                    <>
                      <label className="block text-sm">
                        Template
                        <select
                          className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                          value={step.templateId ?? ""}
                          onChange={(e) =>
                            updateStep(step.id, {
                              templateId: e.target.value || undefined,
                              sequenceId: undefined,
                            })
                          }
                        >
                          <option value="">Select template</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        Or sequence
                        <select
                          className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                          value={step.sequenceId ?? ""}
                          onChange={(e) =>
                            updateStep(step.id, {
                              sequenceId: e.target.value || undefined,
                              templateId: undefined,
                            })
                          }
                        >
                          <option value="">None</option>
                          {sequences.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                  {step.type === "wait_condition" ? (
                    <label className="block text-sm">
                      Wait until status
                      <select
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                        value={step.waitUntilStatus ?? "live"}
                        onChange={(e) =>
                          updateStep(step.id, {
                            waitUntilStatus: e.target.value as typeof step.waitUntilStatus,
                          })
                        }
                      >
                        {PIPELINE_COLUMNS.map((c) => (
                          <option key={c.status} value={c.status}>
                            {STATUS_LABELS[c.status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {step.type === "create_task" ? (
                    <label className="block text-sm">
                      Task title
                      <input
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                        value={step.taskTitle ?? ""}
                        onChange={(e) =>
                          updateStep(step.id, { taskTitle: e.target.value })
                        }
                      />
                    </label>
                  ) : null}
                  {step.type === "internal_reminder" || step.type === "notify_team" ? (
                    <label className="block text-sm">
                      Message
                      <textarea
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                        rows={2}
                        value={step.message ?? ""}
                        onChange={(e) =>
                          updateStep(step.id, { message: e.target.value })
                        }
                      />
                    </label>
                  ) : null}
                  {step.type === "assign_owner" || step.type === "notify_team" ? (
                    <label className="block text-sm">
                      Team member
                      <select
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                        value={step.teamMemberId ?? ""}
                        onChange={(e) =>
                          updateStep(step.id, {
                            teamMemberId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Select</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {step.type === "exit" ? (
                    <label className="block text-sm">
                      Exit reason
                      <input
                        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] px-3 py-2"
                        value={step.exitReason ?? ""}
                        onChange={(e) =>
                          updateStep(step.id, { exitReason: e.target.value })
                        }
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="text-sm text-[var(--heritage-sage)] hover:underline"
                    onClick={() =>
                      setSteps((prev) => prev.filter((s) => s.id !== step.id))
                    }
                  >
                    Remove step
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() => void save()}
          className="rounded-sm bg-[var(--forest-sage)] px-5 py-2.5 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)] disabled:opacity-60"
        >
          Save workflow
        </button>
        {message ? <p className="text-sm ws-muted">{message}</p> : null}
      </div>
    </div>
  );
}
