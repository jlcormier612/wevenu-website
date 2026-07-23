"use client";

import { useEffect, useState } from "react";

import { CoupleQuestionnaireForm } from "@/components/form/couple-questionnaire-form";

/**
 * Questionnaire, surfaced inside the portal itself (Client Collaboration
 * Workspace, 2026-07-22) — the venue assigns it, the couple sees and
 * completes it without ever leaving their workspace or needing an emailed
 * link. Reuses CoupleQuestionnaireForm unchanged; only the entry point
 * (resolved via portal session) is new.
 */
export function QuestionnairePortalSection({ token }: { token: string }) {
  const [data, setData] = useState<Record<string, unknown> | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/portal/questionnaire?token=${token}`)
      .then((r) => r.json())
      .then((d: { questionnaire: Record<string, unknown> | null }) => setData(d.questionnaire))
      .catch(() => setData(null));
  }, [token]);

  if (data === undefined) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-pulse">Loading…</div></div>;
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm font-medium text-heading">Nothing waiting yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your venue will send your final details form (guest count, songs, meal preferences) closer to your event — it'll appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <CoupleQuestionnaireForm
      accessKey={data.access_key as string}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data={data as any}
    />
  );
}
