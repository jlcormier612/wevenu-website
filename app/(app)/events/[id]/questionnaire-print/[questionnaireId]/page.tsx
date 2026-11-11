import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { PrintButton } from "@/app/(app)/events/[id]/floor-plan-print/print-button";
import { AnswerRows } from "@/components/events/questionnaire-answer-rows";
import { getEvent } from "@/lib/events/service";
import { getQuestionnaires } from "@/lib/events/questionnaire";
import { questionnaireStatusLabel } from "@/lib/events/questionnaire-constants";
import { kindLabel } from "@/lib/questionnaire-family/definitions";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string; questionnaireId: string }> };

export const metadata: Metadata = { title: "Questionnaire — Print" };

function fmtDate(iso: string): string {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Paper is always light, whatever theme the venue uses on screen. */
const LIGHT_TOKENS = {
  "--card": "#ffffff",
  "--foreground": "#2A2622",
  "--muted-foreground": "#6B6459",
  "--border": "#E5E0D4",
} as CSSProperties;

/** Print-friendly questionnaire answers, one questionnaire by its own id. */
export default async function QuestionnairePrintPage({ params }: Props) {
  const { id, questionnaireId } = await params;
  const [event, venue, questionnaires] = await Promise.all([getEvent(id), getCurrentVenue(), getQuestionnaires(id)]);
  const q = questionnaires.find((x) => x.id === questionnaireId);
  if (!event || !venue || !q) notFound();

  const title = kindLabel(q.kind);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
        }
        body { background: #f5f4f2; font-family: sans-serif; }
      `}</style>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px", ...LIGHT_TOKENS }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <PrintButton />
        </div>

        <div data-testid="questionnaire-print" style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", color: "#2A2622" }}>
          <div style={{ background: venue.primaryColor, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "white" }}>
              {venue.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={venue.logoUrl} alt="" style={{ height: 36, width: 36, borderRadius: 8, objectFit: "contain", background: "rgba(255,255,255,0.15)" }} />
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>{title}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{venue.name}</div>
              </div>
            </div>
            <div style={{ color: "white", textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{event.name}</div>
              {event.eventDate && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{fmtDate(event.eventDate)}</div>}
            </div>
          </div>

          <div style={{ padding: "16px 24px 0", fontSize: 12, color: "#6B6459" }}>
            {questionnaireStatusLabel(q.status)}
            {q.submittedAt ? ` · Submitted ${fmtDate(q.submittedAt)}` : ""}
          </div>
          <div style={{ padding: 24 }}>
            <AnswerRows q={q} />
          </div>
        </div>
      </div>
    </>
  );
}
