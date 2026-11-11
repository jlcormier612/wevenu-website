import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CLOSED_DRAFT_HYDRATION,
  draftRecordKey,
  isScheduledDateFillOnly,
  markDraftEdited,
  planDraftHydration,
  type DraftHydrationState,
} from "@/lib/booking-journey/confirmation-hydration";
import { toConfirmedBookingOccupancy } from "@/lib/booking-journey/confirmed-occupancy";
import { materializeMissingScheduledDates, type EventSpaceAssignmentInput } from "@/lib/venue-spaces/assignments";

type Draft = {
  leadId: string | null;
  eventDate: string;
  eventEndDate: string;
  startTime: string;
  endTime: string;
  spaceId: string;
  assignments: EventSpaceAssignmentInput[];
};

type Fields = Omit<Draft, "leadId">;

const EMPTY: Fields = { eventDate: "", eventEndDate: "", startTime: "", endTime: "", spaceId: "", assignments: [] };

/** Mirrors the dialog: the draft effect, user edits, close, and submit. */
class DialogModel {
  open = false;
  fields: Fields = { ...EMPTY };
  hydration: DraftHydrationState = CLOSED_DRAFT_HYDRATION;
  formError: string | null = null;
  availabilityBlocked = false;

  show() {
    this.open = true;
  }

  close() {
    this.open = false;
    this.hydration = CLOSED_DRAFT_HYDRATION;
  }

  receiveDraft(draft: Draft) {
    if (!this.open) return;
    const plan = planDraftHydration(this.hydration, draftRecordKey(draft));
    this.hydration = plan.next;
    if (!plan.apply) return;
    this.fields = {
      eventDate: draft.eventDate,
      eventEndDate: draft.eventEndDate,
      startTime: draft.startTime,
      endTime: draft.endTime,
      spaceId: draft.spaceId,
      assignments: draft.assignments.map((r) => ({ ...r })),
    };
    if (plan.firstForRecord) {
      this.formError = null;
      this.availabilityBlocked = false;
    }
  }

  edit<K extends keyof Fields>(key: K, value: Fields[K]) {
    this.hydration = markDraftEdited(this.hydration);
    this.fields = { ...this.fields, [key]: value };
  }

  editorChange(next: EventSpaceAssignmentInput[]) {
    if (isScheduledDateFillOnly(this.fields.assignments, next)) {
      this.fields = { ...this.fields, assignments: next };
      return;
    }
    this.edit("assignments", next);
  }

  submit() {
    return toConfirmedBookingOccupancy({ ...this.fields, weddingFamily: true });
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function row(useKey: string, spaceId: string, start: string | null, end: string | null, date: string | null): EventSpaceAssignmentInput {
  return { useKey, useLabel: useKey, spaceId, startTime: start, endTime: end, scheduledDate: date };
}

const pageDraft: Draft = {
  leadId: "lead-a",
  eventDate: "",
  eventEndDate: "",
  startTime: "",
  endTime: "",
  spaceId: "",
  assignments: [],
};

const liveDraft: Draft = {
  leadId: "lead-a",
  eventDate: "2028-05-20",
  eventEndDate: "",
  startTime: "",
  endTime: "",
  spaceId: "",
  assignments: [row("ceremony", "barn", "15:00", "15:30", "2028-05-20")],
};

const typed: EventSpaceAssignmentInput[] = [
  row("ceremony", "barn", "16:00", "16:45", "2028-04-12"),
  row("cocktail_hour", "patio", "17:00", "18:00", "2028-04-12"),
  row("reception", "ballroom", "18:00", "23:00", "2028-04-12"),
];

describe("Mark as Booked dialog — background draft does not wipe entries", () => {
  it("fills an untouched form from the fetched draft", async () => {
    const dialog = new DialogModel();
    const fetch = deferred<Draft>();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.receiveDraft(await (fetch.resolve(liveDraft), fetch.promise));
    assert.equal(dialog.fields.eventDate, "2028-05-20");
    assert.deepEqual(dialog.fields.assignments, liveDraft.assignments);
  });

  it("keeps values typed before the fetch resolves", async () => {
    const dialog = new DialogModel();
    const fetch = deferred<Draft>();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.edit("eventDate", "2028-04-12");
    dialog.editorChange(typed);
    fetch.resolve(liveDraft);
    dialog.receiveDraft(await fetch.promise);
    assert.equal(dialog.fields.eventDate, "2028-04-12");
    assert.deepEqual(dialog.fields.assignments, typed);
  });

  it("a second fetch or a re-run of the draft effect does not erase edits", async () => {
    const dialog = new DialogModel();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.edit("eventDate", "2028-04-12");
    dialog.editorChange(typed);
    const first = deferred<Draft>();
    const second = deferred<Draft>();
    first.resolve(liveDraft);
    dialog.receiveDraft(await first.promise);
    dialog.receiveDraft({ ...pageDraft });
    second.resolve({ ...liveDraft, eventDate: "2029-01-01" });
    dialog.receiveDraft(await second.promise);
    assert.equal(dialog.fields.eventDate, "2028-04-12");
    assert.deepEqual(dialog.fields.assignments, typed);
  });

  it("editing one field leaves the other edited fields alone", () => {
    const dialog = new DialogModel();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.edit("eventDate", "2028-04-12");
    dialog.editorChange(typed);
    const changed = typed.map((r) => (r.useKey === "reception" ? { ...r, endTime: "22:30" } : r));
    dialog.editorChange(changed);
    dialog.receiveDraft(liveDraft);
    assert.equal(dialog.fields.eventDate, "2028-04-12");
    assert.deepEqual(dialog.fields.assignments, changed);
  });

  it("closing and reopening for another record starts from that record's draft", async () => {
    const dialog = new DialogModel();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.edit("eventDate", "2028-04-12");
    dialog.editorChange(typed);
    dialog.close();

    const leadB: Draft = { ...liveDraft, leadId: "lead-b", eventDate: "2030-10-10", assignments: [row("reception", "pavilion", null, null, "2030-10-10")] };
    const fetchB = deferred<Draft>();
    dialog.show();
    fetchB.resolve(leadB);
    dialog.receiveDraft(await fetchB.promise);
    assert.equal(dialog.fields.eventDate, "2030-10-10");
    assert.deepEqual(dialog.fields.assignments, leadB.assignments);
  });

  it("a draft for a different record replaces edits even within one open", () => {
    const dialog = new DialogModel();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.edit("eventDate", "2028-04-12");
    dialog.receiveDraft({ ...liveDraft, leadId: "lead-b", eventDate: "2030-10-10" });
    assert.equal(dialog.fields.eventDate, "2030-10-10");
  });

  it("submits exactly what the form shows", async () => {
    const dialog = new DialogModel();
    const fetch = deferred<Draft>();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.edit("eventDate", "2028-04-12");
    dialog.editorChange(typed);
    fetch.resolve(liveDraft);
    dialog.receiveDraft(await fetch.promise);
    const occupancy = dialog.submit();
    assert.equal(occupancy.eventDate, "2028-04-12");
    assert.equal(occupancy.startTime, "16:00");
    assert.equal(occupancy.endTime, "23:00");
    assert.deepEqual(
      occupancy.assignments.map((r) => [r.useKey, r.spaceId, r.startTime, r.endTime, r.scheduledDate]),
      [
        ["ceremony", "barn", "16:00", "16:45", "2028-04-12"],
        ["cocktail_hour", "patio", "17:00", "18:00", "2028-04-12"],
        ["reception", "ballroom", "18:00", "23:00", "2028-04-12"],
      ],
    );
  });

  it("the editor's own date fill is not treated as an edit", () => {
    const dialog = new DialogModel();
    dialog.show();
    dialog.receiveDraft({ ...pageDraft, eventDate: "2028-04-12", assignments: [row("ceremony", "barn", null, null, null)] });
    const { next, changed } = materializeMissingScheduledDates(dialog.fields.assignments, dialog.fields.eventDate);
    assert.equal(changed, true);
    dialog.editorChange(next);
    assert.equal(dialog.hydration.edited, false);
    dialog.receiveDraft(liveDraft);
    assert.equal(dialog.fields.eventDate, "2028-05-20");
  });

  it("availability and validation state reset only for a new record, not on refresh", () => {
    const dialog = new DialogModel();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    dialog.availabilityBlocked = true;
    dialog.formError = "Choose a space.";
    dialog.receiveDraft({ ...pageDraft });
    assert.equal(dialog.availabilityBlocked, true);
    assert.equal(dialog.formError, "Choose a space.");
    dialog.close();
    dialog.show();
    dialog.receiveDraft(pageDraft);
    assert.equal(dialog.availabilityBlocked, false);
    assert.equal(dialog.formError, null);
  });
});

describe("isScheduledDateFillOnly", () => {
  it("accepts only blank dates being filled", () => {
    const before = [row("ceremony", "barn", "16:00", "16:45", null)];
    assert.equal(isScheduledDateFillOnly(before, [row("ceremony", "barn", "16:00", "16:45", "2028-04-12")]), true);
    assert.equal(isScheduledDateFillOnly(before, before), false);
    assert.equal(isScheduledDateFillOnly(before, [row("ceremony", "barn", "16:00", "17:00", "2028-04-12")]), false);
    assert.equal(isScheduledDateFillOnly(before, [row("ceremony", "ballroom", "16:00", "16:45", "2028-04-12")]), false);
    assert.equal(isScheduledDateFillOnly([row("ceremony", "barn", null, null, "2028-04-11")], [row("ceremony", "barn", null, null, "2028-04-12")]), false);
    assert.equal(isScheduledDateFillOnly(before, []), false);
  });
});

describe("dialog and board wiring", () => {
  const dialog = readFileSync(join(process.cwd(), "components/leads/pipeline-booked-confirm-dialog.tsx"), "utf8");
  const board = readFileSync(join(process.cwd(), "components/leads/pipeline-board.tsx"), "utf8");

  it("the draft effect asks planDraftHydration before writing the form", () => {
    const effect = dialog.slice(dialog.indexOf("if (!open || !draft) return;"));
    assert.ok(effect.indexOf("planDraftHydration(") < effect.indexOf("setEventDate(draft.eventDate)"));
    assert.match(effect, /if \(!plan\.apply\) return;/);
    assert.match(dialog, /hydrationRef\.current = CLOSED_DRAFT_HYDRATION;/);
  });

  it("every form control the venue edits marks the form edited", () => {
    for (const setter of ["setEventDate", "setEventEndDate", "setStartTime", "setEndTime", "setSpaceId", "setAssignments"]) {
      assert.match(dialog, new RegExp(`edit\\(${setter}\\)`), setter);
    }
    assert.doesNotMatch(dialog, /onChange=\{\(e\) => set(EventDate|EventEndDate|StartTime|EndTime)\(/);
  });

  it("the board ignores a draft that arrives for a lead it is no longer booking", () => {
    assert.match(board, /bookingDraftLeadRef\.current = leadId;/);
    assert.match(board, /if \(bookingDraftLeadRef\.current !== leadId\) return;/);
  });
});
