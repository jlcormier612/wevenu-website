"use client";

import { useEffect, useState } from "react";

import { CoupleFamilyQuestionnaireForm, type FamilyQuestionnaireData } from "@/components/form/couple-family-questionnaire-form";
import { kindLabel, type QuestionnaireKind } from "@/lib/questionnaire-family/definitions";

/**
 * Questionnaire section in the client portal — lists each open form by name
 * (Client Planning / Final Details / Post-Event Feedback).
 */
export function QuestionnairePortalSection({ token }: { token: string }) {
  const [rows, setRows] = useState<FamilyQuestionnaireData[] | null | undefined>(undefined);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portal/questionnaire?token=${token}`)
      .then((r) => r.json())
      .then((d: { questionnaires?: FamilyQuestionnaireData[] }) => {
        const list = (d.questionnaires ?? []).map((q) => ({
          ...q,
          kind: (q.kind || "final_details") as QuestionnaireKind,
        }));
        setRows(list);
        const open = list.find((q) => q.status === "sent") ?? list[0];
        setActiveKey(open?.access_key ?? open?.questionnaire_id ?? null);
      })
      .catch(() => setRows(null));
  }, [token]);

  if (rows === undefined) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-pulse">Loading…</div></div>;
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-sm font-medium text-heading">Nothing waiting yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          When your venue sends a questionnaire, Final Details, or feedback request, it will appear here.
        </p>
      </div>
    );
  }

  const active = rows.find((r) => (r.access_key ?? r.questionnaire_id) === activeKey) ?? rows[0];

  return (
    <div id="portal-focus-questionnaire-form" className="space-y-4">
      {rows.length > 1 && (
        <div className="flex flex-wrap gap-2 px-4 pt-4">
          {rows.map((r) => {
            const key = r.access_key ?? r.questionnaire_id;
            const selected = key === (active.access_key ?? active.questionnaire_id);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveKey(key)}
                className={`rounded-full border px-3 py-1.5 text-xs ${selected ? "border-primary bg-primary/10 font-medium" : "border-border"}`}
              >
                {kindLabel(r.kind)}{r.status === "submitted" || r.status === "reviewed" ? " · Done" : ""}
              </button>
            );
          })}
        </div>
      )}
      <CoupleFamilyQuestionnaireForm
        accessKey={active.access_key as string}
        data={active}
      />
    </div>
  );
}
