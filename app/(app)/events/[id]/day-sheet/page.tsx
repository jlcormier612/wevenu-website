import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DaySheetDocument } from "@/components/events/day-sheet/day-sheet-document";
import { PrintButton } from "@/components/events/day-sheet/print-button";
import { Button } from "@/components/ui/button";
import { getEvent } from "@/lib/events/service";
import { getQuestionnaire } from "@/lib/events/questionnaire";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: event ? `Day-of Sheet · ${event.name}` : "Day-of Sheet" };
}

/**
 * Day-of Sheet — printable / saveable event document.
 *
 * On screen: preview card + toolbar (Back, Print).
 * On print:  sidebar, header, toolbar all hidden; document fills the page.
 *
 * "Print / Save as PDF" uses the browser's native print dialog.
 * No external PDF library is needed — every modern browser supports
 * saving as PDF from the print dialog.
 */
export default async function DaySheetPage({ params }: Props) {
  const { id } = await params;
  const [event, venue, questionnaire] = await Promise.all([getEvent(id), getCurrentVenue(), getQuestionnaire(id)]);
  if (!event || !venue) notFound();

  return (
    <>
      {/* Print CSS — hides workspace chrome, sets page margins */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.55in; }
          aside, header { display: none !important; }
          .no-print  { display: none !important; }
          main { background: white !important; padding: 0 !important; }
          main > div { padding: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="min-h-svh bg-muted/40 print:bg-white">
        {/* Screen-only toolbar */}
        <div className="no-print sticky top-0 z-50 border-b bg-background px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/events/${event.id}`} />}
          >
            ← Back to Event
          </Button>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-muted-foreground sm:block">
              Preview · Print or use browser "Save as PDF"
            </p>
            <PrintButton />
          </div>
        </div>

        {/* Document — Letter-width preview on screen, full-page on print */}
        <div className="flex justify-center py-8 px-4 print:p-0 print:block">
          <div className="w-full max-w-[794px] overflow-hidden rounded-xl shadow-xl print:rounded-none print:shadow-none">
            <DaySheetDocument event={event} venue={venue} questionnaire={questionnaire} />
          </div>
        </div>
      </div>
    </>
  );
}
