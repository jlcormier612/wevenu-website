import type { Questionnaire } from "@/lib/events/questionnaire";
import { resolveQuestionnaireFields } from "@/lib/questionnaire-family/resolve";

export function AnswerRows({ q }: { q: Questionnaire }) {
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
